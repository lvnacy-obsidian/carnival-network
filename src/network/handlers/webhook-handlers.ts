// handlers/webhook-handlers.ts
import {
	AuthenticationError,
	InternalServerError,
	ValidationError
} from '../../errors';
import { Log } from '../../utils/logger';
import type {
	APIRequest,
	BeehiivPostData,
	BeehiivWebhookPayload,
	CrossVaultRecord,
	GitHubWebhookPayload,
	LogContext,
	WebhookResponse
} from '../../types/public';
import type { ActService } from '../services/act-service';
import type { WebhookVerifier } from '../services/webhook-verifier';

const webhookLogger: LogContext = {
	context: 'Webhook Handlers',
	path: '/.obsidian/plugins/carnival-records/network/handlers/webhooks'
};

export class WebhookHandlers {
	constructor(
		private readonly actService: ActService,
		private readonly verifier: WebhookVerifier
	) {}

	/**
	 * Handle GitHub webhook
	 * POST /api/webhooks/github
	 */
	async handleGitHub(request: APIRequest): Promise<WebhookVerifier> {
		// Verify GitHub signature
		if (!this.verifier.verifyGitHub(request)) {
			throw new AuthenticationError(
				'Invalid GitHub webhook signature',
				{ hint: 'Check webhook secret configuration' }
			);
		}

		const payload = this.parseGitHubPayload(request.body);
		
		if (!payload.action || !payload.repository) {
			throw new ValidationError(
				'Invalid GitHub webhook payload',
				{
					action: payload.action ? undefined : 'Required field missing',
					repository: payload.repository ? undefined : 'Required field missing'
				}
			);
		}
		
		try {
			switch (payload.action) {
				case 'opened':
					if (payload.pull_request) {
						await this.handleGitHubPullRequest(payload);
					} else if (payload.issue) {
						await this.handleGitHubIssue(payload);
					}
					break;
				
				case 'closed':
					// Handle closures
					break;
				
				default:
					Log.log(webhookLogger, `Unhandled GitHub action: ${payload.action}`);
			}

			return { 
				message: 'Webhook processed successfully',
				action: payload.action,
				repository: payload.repository.full_name 
			};
		} catch (error) {
			Log.error(webhookLogger, 'GitHub webhook processing failed:', error);
			throw new InternalServerError('Webhook processing failed', error);
		}
	}

	/**
	 * Handle Beehiiv webhook
	 * POST /api/webhooks/beehiiv
	 */
	async handleBeehiiv(request: APIRequest): Promise<WebhookResponse> {
		if (!this.verifier.verifyBeehiiv(request)) {
			throw new AuthenticationError(
				'Invalid beehiiv webhook signature',
				{ hint: 'Check webhook secret configuration' }
			);
		}

		const payload = this.parseBeehiivPayload(request.body);
		
		try {
			switch (payload.event) {
				case 'post.published':
					await this.handleBeehiivPostPublished(payload);
					break;
				
				case 'subscriber.created':
					await this.handleBeehiivSubscriberCreated(payload);
					break;
				
				default:
					Log.log(webhookLogger, `Unhandled beehiiv event: ${ payload.event }`);
			}

			return { 
				message: 'beehiiv webhook processed successfully',
				event: payload.event 
			};
		} catch (error) {
			Log.error(webhookLogger, 'Beehiiv webhook processing failed:', error);
			throw new InternalServerError('Webhook processing failed', error);
		}
	}

	private async handleGitHubPullRequest(payload: GitHubWebhookPayload): Promise<void> {
		
		if (!payload.pull_request || !payload.repository) {
			throw new ValidationError(
				'Invalid GitHub pull request payload',
				{
					pull_request: payload.pull_request ? undefined : 'Required field missing',
					repository: payload.repository ? undefined : 'Required field missing'
				}
			);
		}
		
		const pr = payload.pull_request;
		const repo = payload.repository;
		
		const record: CrossVaultRecord = {
			id: `github-pr-${ repo.id }-${ pr.number }-${ Date.now() }`,
			title: `GitHub PR: ${pr.title}`,
			territory: 'github-integrations',
			actType: 'changelog',
			content: `
				Pull Request opened in ${ repo.full_name }
				
				**Author**: ${ pr.user.login }
				**Branch**: ${ pr.head.ref }
				**Description**: ${ pr.body ?? 'No description provided' }
			`,
			metadata: {
				source: 'github',
				eventType: 'pull_request',
				repository: repo.full_name,
				prNumber: pr.number,
				author: pr.user.login,
				githubUrl: pr.html_url,
				createdBy: 'github-webhook',
				createdVia: 'external-api'
			},
			createdAt: pr.created_at ?? new Date().toISOString(),
			status: 'active',
			syncPreferences: {
				requireAck: false,
				broadcastToAll: false,
				targetTerritories: ['github-integrations']
			}
		};
		
		await this.actService.broadcastAct(record);
		Log.log(webhookLogger, `GitHub PR record created: ${ pr.title } (PR #${ pr.number })`);
	}

	private async handleGitHubIssue(payload: GitHubWebhookPayload): Promise<void> {

		if (!payload.issue || !payload.repository) {
			throw new ValidationError(
				'Invalid GitHub pull request payload',
				{
					pull_request: payload.pull_request ? undefined : 'Required field missing',
					repository: payload.repository ? undefined : 'Required field missing'
				}
			);
		}

		const { issue } = payload;
		const repo = payload.repository;

		const record: CrossVaultRecord = {
			id: `github-issue-${ repo.id }-${ issue.number }-${ Date.now() }`,
			title: `GitHub Issue: ${ issue.title }`,
			territory: 'github-integrations',
			actType: 'changelog',
			content: `
				Issue opened in ${ repo.full_name }
				
				**Author**: ${ issue.user.login }
				**Description**: ${ issue.body ?? 'No description provided' }
			`,
			metadata: {
				source: 'github',
				eventType: 'issues',
				repository: repo.full_name,
				issueNumber: issue.number,
				author: issue.user.login,
				labels: issue.labels?.map(l => l.name) ?? [],
				githubUrl: issue.html_url,
				createdBy: 'github-webhook',
				createdVia: 'external-api'
			},
			createdAt: issue.created_at ?? new Date().toISOString(),
			status: 'active',
			syncPreferences: {
				requireAck: false,
				broadcastToAll: false,
				targetTerritories: ['github-integrations']
			}
		};
		
		await this.actService.broadcastAct(record);
		Log.log(webhookLogger, `GitHub issue record created: ${ issue.title } (Issue #${ issue.number })`);
	}

	private async handleBeehiivPostPublished(payload: BeehiivWebhookPayload): Promise<void> {

		const data = payload.data as BeehiivPostData;

		const record = this.actService.createAct({
			id: `beehiiv-post-${data.post.id}-${Date.now()}`,
			title: `Newsletter: ${data.post.title}`,
			territory: 'newsletter-publishing',
			actType: 'conversation',
			content: `
				Newsletter post published on beehiiv

				**Title**: ${data.post.title}
				**Published**: ${ data.published_at ?? 'Just now'}
				**Subscribers**: ${data.subscriber_count ?? 'Unknown' }
				
				${ data.post.content?.substring(0, 500) ?? '' }...
			`,
			metadata: {
				source: 'beehiiv',
				eventType: 'post_published',
				postId: data.post.id,
				publicationId: data.publication_id,
				subscriberCount: data.subscriber_count,
				beehiivUrl: data.post.url,
				createdBy: 'beehiiv-webhook',
				createdVia: 'external-api'
			},
			createdAt: data.published_at ?? new Date().toISOString(),
			status: 'active',
			syncPreferences: {
				requireAck: false,
				broadcastToAll: true,
				targetTerritories: []
			}
		});
		
		await this.actService.broadcastAct(record);
		Log.log(webhookLogger, `Beehiiv post published: ${ data.post.title }`);
	}

	private async handleBeehiivSubscriberCreated(data: any): Promise<void> {
		const record: CrossVaultRecord = {
			id: `beehiiv-subscriber-${ data.subscriber.id }-${ Date.now() }`,
			title: `New Subscriber: ${ data.subscriber.email }`,
			territory: 'newsletter-growth',
			actType: 'changelog',
			content: `
				New subscriber joined
				
				**Email**: ${ data.subscriber.email }
				**Joined**: ${ data.created_at ?? 'Just now' }
				**Source**: ${ data.subscriber.source ?? 'Direct' }
			`,
			metadata: {
				source: 'beehiiv',
				eventType: 'subscriber_created',
				subscriberId: data.subscriber.id,
				email: data.subscriber.email,
				referralSource: data.subscriber.source,
				publicationId: data.publication_id,
				createdBy: 'beehiiv-webhook',
				createdVia: 'external-api'
			},
			createdAt: data.created_at ?? new Date().toISOString(),
			status: 'active',
			syncPreferences: {
				requireAck: false,
				broadcastToAll: false,
				targetTerritories: ['newsletter-growth']
			}
		};
		
		await this.actService.broadcastAct(record);
		Log.log(webhookLogger, `Beehiiv subscriber created: ${data.subscriber.email}`);
	}

	private parseGitHubPayload(body: unknown): GitHubWebhookPayload {
		if (!body || typeof body !== 'object') {
			throw new ValidationError('Invalid webhook payload', {});
		}
		return body as GitHubWebhookPayload;
	}

	private parseBeehiivPayload(body: unknown): BeehiivWebhookPayload {
		if (!body || typeof body !== 'object') {
			throw new ValidationError('Invalid webhook payload', {});
		}
		return body as BeehiivWebhookPayload;
	}
}