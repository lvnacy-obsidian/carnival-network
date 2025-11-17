// handlers/discord-handlers.ts
import {
	InternalServerError,
	ValidationError
} from '../../errors';
import { Log } from '../../utils/logger';
import type { ActService } from '../services/act-service';
import type { CarnivalQueryService } from '../services/carnival-query-service';
import { ValidationError as  ValidationErrorsType } from '../../errors';
import type {
	APIRequest,
	CarnivalAct,
	ExternalClient,
	LogContext,
	NetworkStatusResponse,
	RecordCreateResponse,
	ActCreateRequestBody,
	ActQueryParams,
	RecordQueryResponse,
	TerritoriesResponse
} from '../../types/public';

const discordLogger: LogContext = {
	context: 'Discord Handlers',
	path: '/.obsidian/plugins/carnival-network/src/network/handlers/discord'
};

export class DiscordHandlers {
	constructor(
		private readonly actService: ActService,
		private readonly networkService: CarnivalQueryService
	) {}

	/**
	 * Handle network status query
	 * GET /api/discord/network/status
	 */
	handleNetworkStatus(): NetworkStatusResponse {
		try {

			const connectedPerformers = this.networkService.getConnectedPerformersCount();
			const recentActivity = this.networkService.getRecentActivity(24);

			return {
				status: 'operational',
				uptime: this.networkService.getUptimeMs(),
				connectedPerformers,
				recentActivity,
				capabilities: ['record_sync', 'cross_vault_messaging', 'external_api']
			};
		} catch (error) {
			Log.error(discordLogger, 'Network status query failed:', error);
			throw new InternalServerError('Failed to get network status', error);
		}
	}

	/**
	 * Handle acts query request
	 * GET /api/discord/acts
	 */

	/* eslint-disable require-await */
	async handleRecordsQuery(
		request: APIRequest,
		_client: ExternalClient
	): Promise<RecordQueryResponse> {

		const params = request.query as ActQueryParams;
		const {
			territory,
			type,
			limit = '10',
			offset = '0'
		} = params;
		
		const limitNum = parseInt(String(limit), 10);
		const offsetNum = parseInt(String(offset), 10);

		// Validate query parameters
		if (isNaN(limitNum) || limitNum < 1 || limitNum > 50) {
			throw new ValidationError(
				'Invalid pagination parameters',
				{ limit: 'Must be between 1 and 50' }
			);
		}

		if (isNaN(offsetNum) || offsetNum < 0) {
			throw new ValidationError(
				'Invalid pagination parameters',
				{ offset: 'Must be non-negative' }
			);
		}
		
		try {
			const acts = this.actService.queryActs({
				territory: territory ? String(territory) : '',
				type: type as 'changelog' | 'conversation' || '',
				limit: Math.min(limitNum, 50),
				offset: offsetNum
			});

			const newActs: Array<CarnivalAct> = acts.map(act => {
				if (typeof act.actType === 'string') {
					act.actType = '' as 'changelog' | 'conversation';
				} else {
					act.actType = act.actType;
				}

				return act;
			});

			const formattedRecords = newActs.map(act => ({
				id: act.id,
				title: act.title,
				territory: act.territory,
				type: act.actType as 'changelog' | 'conversation',
				created: act.createdAt,
				status: act.status,
				summary: this.actService.generateSummary(act)
			}));

			const total = this.actService.countActs({ 
				territory: territory ? String(territory) : '',
				type: type ? String(type) : ''
			});

			return {
				acts: formattedRecords,
				pagination: {
					total,
					limit: limitNum,
					offset: offsetNum,
					hasNext: formattedRecords.length === limitNum
				}
			};
		} catch (error) {
			if (!(error instanceof ValidationError)) {
				Log.error(discordLogger, 'Records query failed:', error);
				throw new InternalServerError('Failed to query acts', error);
			}
			throw error;
		}
	}
	/* eslint-enable require-await */

	/**
	 * Handle act creation request
	 * POST /api/discord/acts
	 */
	async handleRecordCreate(
		request: APIRequest,
		client: ExternalClient
	): Promise<RecordCreateResponse> {
		const body = this.parseRecordCreateBody(request.body);
		
		// Detailed validation
		const validationErrors: ValidationErrorsType = {};
		
		if (!body.territory || body.territory.trim().length === 0) {
			validationErrors.territory = 'Territory is required and must be a non-empty string';
		}
		
		if (!body.type || !['changelog', 'conversation'].includes(body.type)) {
			validationErrors.type = 'Type must be either "changelog" or "conversation"';
		}
		
		if (!body.title || body.title.trim().length === 0) {
			validationErrors.title = 'Title is required and must be a non-empty string';
		} else if (body.title.length > 500) {
			validationErrors.title = 'Title must not exceed 500 characters';
		}
		
		if (body.content && body.content.length > 50000) {
			validationErrors.content = 'Content must not exceed 50,000 characters';
		}
		
		if (Object.keys(validationErrors).length > 0) {
			throw new ValidationError('Invalid act data', validationErrors);
		}

		try {
			const act: CarnivalAct = {
				id: this.actService.generateActId(),
				title: body.title.trim(),
				territory: body.territory.trim(),
				actType: body.type,
				content: body.content?.trim() ?? '',
				metadata: {
					...body.metadata,
					createdBy: 'discord-bot',
					createdVia: 'external-api',
					clientId: client.id
				},
				createdAt: new Date().toISOString(),
				status: 'active',
				syncPreferences: {
					requireAck: true,
					broadcastToAll: false,
					targetTerritories: [body.territory.trim()]
				}
			};

			await this.actService.broadcastAct(act);

			return {
				actId: act.id,
				message: `Record created in ${ body. territory } territory`,
				territory: act.territory,
				createdAt: act.createdAt
			};
		} catch (error) {
			Log.error(discordLogger, 'Record creation failed:', error);
			throw new InternalServerError('Failed to create act', error);
		}
	}

	/**
	 * Handle territories query
	 * GET /api/discord/territories
	 */
	handleTerritoriesQuery(
		_request: APIRequest,
		_client: ExternalClient
	): TerritoriesResponse {
		try {
			const topology = this.networkService.getNetworkTopology();

			let topologyStatus;
			if (topology.territories.performerCount > 0) {
				topologyStatus = 'active' as 'active' | 'inactive';
			} else {
				topologyStatus = 'inactive' as 'active' | 'inactive';
			}
			
			const territories = Object.entries(topology.territories).map(([name, performerCount]) => ({
				name,
				performerCount,
				status: topologyStatus
			}));

			return {
				territories,
				totalPerformers: topology.totalPerformers,
				activeRegistries: topology.activeRegistries,
				capabilities: topology.capabilities,
				lastUpdated: topology.lastUpdated
			};
		} catch (error) {
			Log.error(discordLogger, 'Territories query failed:', error);
			throw new InternalServerError('Failed to query territories', error);
		}
	}

	/**
	 * Parse and validate act creation body
	 */
	private parseRecordCreateBody(body: unknown): ActCreateRequestBody {
		if (!body || typeof body !== 'object') {
			throw new ValidationError('Request body must be an object', {});
		}

		const parsed = body as Record<string, unknown>;

		return {
			territory: typeof parsed.territory === 'string' ? parsed.territory : '',
			type: typeof parsed.type === 'string' ? parsed.type as 'changelog' | 'conversation' : 'changelog',
			title: typeof parsed.title === 'string' ? parsed.title : '',
			content: typeof parsed.content === 'string' ? parsed.content : '',
			metadata: parsed.metadata && typeof parsed.metadata === 'object' 
				? parsed.metadata as Record<string, unknown>
				: {}
		};
	}
}