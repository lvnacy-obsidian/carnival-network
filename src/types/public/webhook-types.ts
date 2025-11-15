/**
 * ============================================================================
 * WEBHOOK TYPES
 * ============================================================================
 * 
 * Types for webhook payloads and responses
 * 
 * Index of exports:
 * - BeehiivPost
 * - BeehiivPostData
 * - BeehiivSubscriber
 * - BeehiivSubscriberData
 * - BeehiivWebhookPayload
 * - GitHubIssue
 * - GitHubPullRequest
 * - GitHubRepository
 * - GitHubUser
 * - GitHubWebhookPayload
 * - WebhookHandlerInterface
 * - WebhookPayload
 * - WebhookResponse
 */

import { CarnivalRecord } from './records-types';

export interface BeehiivPost {
	id: string;
	title: string;
	content?: string;
	url: string;
}

export interface BeehiivPostData {
	post: BeehiivPost;
	publication_id: string;
	published_at?: string;
	subscriber_count?: number;
}

export interface BeehiivSubscriber {
	id: string;
	email: string;
	source?: string;
}

export interface BeehiivSubscriberData {
	subscriber: BeehiivSubscriber;
	publication_id: string;
	created_at?: string;
}

export interface BeehiivWebhookPayload {
	event: string;
	data: BeehiivPostData | BeehiivSubscriberData;
}

export interface GitHubIssue {
	number: number;
	title: string;
	body?: string;
	user: GitHubUser;
	labels?: Array<{ name: string }>;
	html_url: string;
	created_at?: string;
}

export interface GitHubPullRequest {
	number: number;
	title: string;
	body?: string;
	user: GitHubUser;
	head: {
		ref: string;
	};
	html_url: string;
	created_at?: string;
}

export interface GitHubRepository {
	id: number;
	name: string;
	full_name: string;
	html_url: string;
}

export interface GitHubUser {
	login: string;
	id: number;
}

export interface GitHubWebhookPayload {
	action: string;
	repository: GitHubRepository;
	pull_request?: GitHubPullRequest;
	issue?: GitHubIssue;
}

/**
 * Webhook handler interface - implement this for custom webhook integrations
 */
export interface WebhookHandlerInterface {
	handleIncoming(payload: unknown): Promise<void>;
	formatOutgoing(record: CarnivalRecord): unknown;
	verify(payload: unknown, signature: string): boolean;
}

/**
 * Webhook payload (generic)
 */
export interface WebhookPayload {
	event: string;
	timestamp: string;
	data: unknown;
	source: {
		pluginId: string;
		performerId: string;
		territory: string;
	};
}

export interface WebhookResponse {
	message: string;
	[key: string]: unknown;
}