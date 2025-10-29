// handlers/discord-handlers.ts
import {
	InternalServerError,
	ValidationError
} from '../../errors';
import { Log } from '../../utils/logger';
import type {
	ApiRequest,
	CrossVaultRecord,
	ExternalClient,
	LogContext,
	NetworkStatusResponse,
	RecordCreateResponse,
	RecordCreateRequestBody,
	RecordQueryParams,
	RecordQueryResponse,
	ValidationErrors as ValidationErrorsType,
	TerritoriesResponse
} from '../../types/public';
import type { RecordService } from '../services/act-service';
import type { NetworkQueryService } from '../services/carnival-query-service';

const discordLogger: LogContext = {
	context: 'Discord Handlers',
	path: '/.obsidian/plugins/carnival-records/network/handlers/discord'
};

export class DiscordHandlers {
	constructor(
		private readonly recordService: RecordService,
		private readonly networkService: NetworkQueryService
	) {}

	/**
	 * Handle network status query
	 * GET /api/discord/network/status
	 */
	handleNetworkStatus(): NetworkStatusResponse {
		try {

			const connectedNodes = this.networkService.getConnectedNodesCount();
			const recentActivity = this.networkService.getRecentActivity(24);

			return {
				status: 'operational',
				uptime: this.networkService.getUptimeMs(),
				connectedNodes,
				recentActivity,
				capabilities: ['record_sync', 'cross_vault_messaging', 'external_api']
			};
		} catch (error) {
			Log.error(discordLogger, 'Network status query failed:', error);
			throw new InternalServerError('Failed to get network status', error);
		}
	}

	/**
	 * Handle records query request
	 * GET /api/discord/records
	 */
	async handleRecordsQuery(
		request: ApiRequest,
		_client: ExternalClient
	): Promise<RecordQueryResponse> {

		const params = request.query as RecordQueryParams;
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
			const records = await this.recordService.queryRecords({
				territory: territory ? String(territory) : '',
				type: type as 'changelog' | 'conversation' || '',
				limit: Math.min(limitNum, 50),
				offset: offsetNum
			});

			const newRecords: Array<CrossVaultRecord> = records.map(record => {
				if (typeof record.recordType === 'string') {
					record.recordType = '' as 'changelog' | 'conversation';
				} else {
					record.recordType = record.recordType;
				}

				return record;
			});

			const formattedRecords = newRecords.map(record => ({
				id: record.id,
				title: record.title,
				territory: record.territory,
				type: record.recordType as 'changelog' | 'conversation',
				created: record.createdAt,
				status: record.status,
				summary: this.recordService.generateSummary(record)
			}));

			const total = await this.recordService.countRecords({ 
				territory: territory ? String(territory) : '',
				type: type ? String(type) : ''
			});

			return {
				records: formattedRecords,
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
				throw new InternalServerError('Failed to query records', error);
			}
			throw error;
		}
	}

	/**
	 * Handle record creation request
	 * POST /api/discord/records
	 */
	async handleRecordCreate(
		request: ApiRequest,
		client: ExternalClient
	): Promise<RecordCreateResponse> {
		/* eslint-disable @typescript-eslint/prefer-optional-chain */

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
			throw new ValidationError('Invalid record data', validationErrors);
		}

		try {
			const record: CrossVaultRecord = {
				id: this.recordService.generateRecordId(),
				title: body.title.trim(),
				territory: body.territory.trim(),
				recordType: body.type,
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

			await this.recordService.broadcastRecord(record);

			return {
				recordId: record.id,
				message: `Record created in ${ body. territory } territory`,
				territory: record.territory,
				createdAt: record.createdAt
			};
		} catch (error) {
			Log.error(discordLogger, 'Record creation failed:', error);
			throw new InternalServerError('Failed to create record', error);
		}
	}

	/**
	 * Handle territories query
	 * GET /api/discord/territories
	 */
	handleTerritoriesQuery(
		_request: ApiRequest,
		_client: ExternalClient
	): TerritoriesResponse {
		try {
			const topology = this.networkService.getNetworkTopology();

			let topologyStatus;
			if (topology.territories.nodeCount > 0) {
				topologyStatus = 'active' as 'active' | 'inactive';
			} else {
				topologyStatus = 'inactive' as 'active' | 'inactive';
			}
			
			const territories = Object.entries(topology.territories).map(([name, nodeCount]) => ({
				name,
				nodeCount,
				status: topologyStatus
			}));

			return {
				territories,
				totalNodes: topology.totalNodes,
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
	 * Parse and validate record creation body
	 */
	private parseRecordCreateBody(body: unknown): RecordCreateRequestBody {
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