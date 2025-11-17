import { Log } from '../utils/logger';
import { ValidationError, InternalServerError, NotFoundError } from '../errors';
import type { ActService } from './services/act-service';
import type { CarnivalQueryService } from './services/carnival-query-service';
import type {
	ActCreateRequestBody,
	ActCreateData,
	ActQueryParams,
	AnalyticsData,
	APIRequest,
	APIResponse,
	CarnivalAct,
	CarnivalStatus,
	LogContext,
	PaginationMeta,
	SearchRequestBody,
	SearchResponse,
	TerritoriesListData,
	TerritoryInfo
} from '../types/public';

const apiLogger: LogContext = {
  context: 'External API Service',
  path: '/.obsidian/plugins/carnival-network/network/external-api-service'
};

/**
 * 🎪 External API Service - RESTful endpoints for external clients
 * 
 * Provides HTTP endpoints for external systems to interact with the
 * Carnival Network. Handles acts CRUD, search, and network status.
 */
export class ExternalAPIService {
	constructor(
		private readonly actService: ActService,
		private readonly queryService: CarnivalQueryService
	) {
		Log.log(apiLogger, '🎪 External API Service initialized');
	}

	/**
	 * ========================================================================
	 * ACTS ENDPOINTS
	 * ========================================================================
	 */

	/**
	 * Query acts with pagination and filtering
	 * GET /api/acts?territory=backstage&type=changelog&limit=10&offset=0
	 */
	async handleActsQuery(request: APIRequest): Promise<APIResponse<{
		acts: CarnivalAct[];
		pagination: PaginationMeta;
	}>> {
		try {
			const params = this.parseActQueryParams(request.query);
			
			// Validate pagination
			if (params.limit < 1 || params.limit > 100) {
				throw new ValidationError(
				'Invalid pagination parameters',
				{ limit: 'Must be between 1 and 100' }
				);
			}

			if (params.offset < 0) {
				throw new ValidationError(
				'Invalid pagination parameters',
				{ offset: 'Must be non-negative' }
				);
			}

			// Query acts
			const acts = await this.actService.queryActs(params);
			const total = await this.actService.countActs({
				territory: params.territory,
				type: params.type
			});

			return {
				status: 'success',
				data: {
					acts,
					pagination: {
						limit: params.limit,
						offset: params.offset,
						total,
						hasNext: (params.offset + params.limit) < total,
						hasPrevious: params.offset > 0
					}
				},
				timestamp: new Date().toISOString()
			};

		} catch (error) {
			Log.error(apiLogger, 'Records query failed:', error);
			throw this.handleAPIError(error);
		}
	}

	/**
	 * Create a new act
	 * POST /api/acts
	 */
	async handleActCreate(request: APIRequest): Promise<APIResponse<ActCreateData>> {
		try {
			const body = this.parseActCreateBody(request.body);
			
			// Validate required fields
			this.validateActCreate(body);

			// Create act
			const act = await this.actService.createAct({
				title: body.title,
				territory: body.territory,
				actType: body.type,
				content: body.content || '',
				metadata: {
					...body.metadata,
					createdVia: 'external-api',
					createdAt: new Date().toISOString()
					},
				createdAt: new Date(),
				status: 'active',
				syncPreferences: {
					requireAck: body.requireAck ?? true,
					broadcastToAll: body.broadcastToAll ?? false,
					targetTerritories: body.targetTerritories || [body.territory]
				}
			});

			// Broadcast if requested
			if (body.broadcast !== false) {
				await this.actService.broadcastAct(act);
			}

			return {
				status: 'success',
				data: {
					id: act.id,
					title: act.title,
					territory: act.territory,
					createdAt: act.createdAt
					},
				message: 'Act created successfully',
				timestamp: new Date().toISOString()
			};

		} catch (error) {
		Log.error(apiLogger, 'Act creation failed:', error);``
		throw this.handleAPIError(error);
		}
	}

	/**
	 * Get a specific act by ID
	 * GET /api/acts/:id
	 */
	async handleActGet(request: APIRequest): Promise<APIResponse<CarnivalAct>> {
		try {
			const id = this.extractIdParam(request);
			
			if (!id) {
				throw new ValidationError('Act ID is required', { id: 'Missing act ID' });
			}

			const act = await this.actService.getAct(id);
			
			if (!act) {
				throw new NotFoundError('Act', id);
			}

			return {
				status: 'success',
				data: act,
				timestamp: new Date().toISOString()
			};

		} catch (error) {
			Log.error(apiLogger, 'Act get failed:', error);
			throw this.handleAPIError(error);
		}
	}

	/**
	 * ========================================================================
	 * SEARCH ENDPOINT
	 * ========================================================================
	 */

	/**
	 * Search across carnival acts
	 * POST /api/search
	 */
	async handleSearch(request: APIRequest): Promise<APIResponse<SearchResponse>> {
		try {
			const body = this.parseSearchBody(request.body);
			
			// Validate search query
			if (!body.query || body.query.trim().length < 2) {
				throw new ValidationError(
				'Invalid search parameters',
				{ query: 'Query must be at least 2 characters' }
				);
			}

			if (body.query.length > 200) {
				throw new ValidationError(
				'Invalid search parameters',
				{ query: 'Query must not exceed 200 characters' }
				);
			}

			const limit = Math.min(body.limit || 20, 100);

			// Perform search
			const results = await this.actService.performSearch({
				query: body.query.trim(),
				territories: body.territories || [],
				limit
			});

			return {
				status: 'success',
				data: {
					query: body.query.trim(),
					results,
					resultCount: results.length,
					hasMore: results.length === limit
					},
				timestamp: new Date().toISOString()
			};

		} catch (error) {
			Log.error(apiLogger, 'Search failed:', error);
			throw this.handleAPIError(error);
		}
	}

	/**
	 * ========================================================================
	 * NETWORK STATUS ENDPOINTS
	 * ========================================================================
	 */

	/**
	 * Get network status and health
	 * GET /api/network/status
	 */
	handleCarnivalStatus(): APIResponse<CarnivalStatus> {
		try {
			const topology = this.queryService.getCarnivalTopology();
			const uptime = this.queryService.getUptimeMs();
			const connectedPerformers = this.queryService.getConnectedPerformersCount();

			return {
				status: 'success',
				data: {
				health: 'operational',
				uptime: {
					milliseconds: uptime,
					formatted: this.formatUptime(uptime)
				},
				network: {
					totalPerformers: topology.totalPerformers,
					connectedPerformers,
					territories: Object.keys(topology.territories).length,
					activeRegistries: topology.activeRegistries
				},
				capabilities: topology.capabilities
				},
				timestamp: new Date().toISOString()
			};

		} catch (error) {
			Log.error(apiLogger, 'Network status query failed:', error);
			throw this.handleAPIError(error);
		}
	}

	/**
	 * Get territories list
	 * GET /api/territories
	 */
	handleTerritoriesList(): APIResponse<TerritoriesListData> {
		try {
			const topology = this.queryService.getCarnivalTopology();
			
			const territories: TerritoryInfo[] = Object.entries(topology.territories).map(([name, performerCount]) => ({
				name,
				performerCount,
				status: performerCount > 0 ? 'active' as const : 'inactive' as const
			}));

			return {
				status: 'success',
				data: {
				territories,
				total: territories.length,
				active: territories.filter(t => t.status === 'active').length
				},
				timestamp: new Date().toISOString()
			};

		} catch (error) {
			Log.error(apiLogger, 'Territories list failed:', error);
			throw this.handleAPIError(error);
		}
	}

	/**
	 * Get network analytics
	 * GET /api/analytics?metrics=acts,activity,capabilities
	 */
	handleAnalytics(request: APIRequest): APIResponse<AnalyticsData> {
		try {
			const params = request.query as { metrics?: string; timeframe?: string };
			const metrics = this.parseMetricsParam(params.metrics);
			const timeframe = params.timeframe || '7d';

			const data = this.queryService.generateAnalytics(metrics);

			return {
				status: 'success',
				data: {
				timeframe,
				...data
				},
				timestamp: new Date().toISOString()
			};

		} catch (error) {
			Log.error(apiLogger, 'Analytics query failed:', error);
			throw this.handleAPIError(error);
		}
	}

	/**
	 * ========================================================================
	 * HELPER METHODS
	 * ========================================================================
	 */

	private parseActQueryParams(query: Record<string, unknown>): ActQueryParams & { limit: number; offset: number } {
		return {
			territory: typeof query.territory === 'string' ? query.territory : undefined,
			type: typeof query.type === 'string' ? query.type as 'changelog' | 'conversation' : undefined,
			limit: typeof query.limit === 'string' ? parseInt(query.limit, 10) : 10,
			offset: typeof query.offset === 'string' ? parseInt(query.offset, 10) : 0
		};
	}

	private parseActCreateBody(body: unknown): ActCreateRequestBody {
		if (!body || typeof body !== 'object') {
			throw new ValidationError('Request body must be an object', {});
		}

		const parsed = body as Record<string, unknown>;

		return {
			title: typeof parsed.title === 'string' ? parsed.title : '',
			territory: typeof parsed.territory === 'string' ? parsed.territory : '',
			type: typeof parsed.type === 'string' ? parsed.type as 'changelog' | 'conversation' : 'changelog',
			content: typeof parsed.content === 'string' ? parsed.content : undefined,
			metadata: parsed.metadata && typeof parsed.metadata === 'object' 
				? parsed.metadata as Record<string, unknown>
				: undefined,

			// sync preferences
			requireAck: typeof parsed.requireAck === 'boolean' ? parsed.requireAck : undefined,
			broadcastToAll: typeof parsed.broadcastToAll === 'boolean' ? parsed.broadcastToAll : undefined,
			targetTerritories: Array.isArray(parsed.targetTerritories) 
				? parsed.targetTerritories.filter(t => typeof t === 'string')
				: undefined,
			
			// API-only
			broadcast: typeof parsed.broadcast === 'boolean' ? parsed.broadcast : true
		};
	}

	private parseSearchBody(body: unknown): SearchRequestBody {
		if (!body || typeof body !== 'object') {
			throw new ValidationError('Request body must be an object', {});
		}

		const parsed = body as Record<string, unknown>;

		return {
			query: typeof parsed.query === 'string' ? parsed.query : '',
			territories: Array.isArray(parsed.territories) 
				? parsed.territories.filter(t => typeof t === 'string')
				: undefined,
			limit: typeof parsed.limit === 'number' ? parsed.limit : 20
		};
	}

	private validateActCreate(body: ActCreateRequestBody): void {
		const errors: Record<string, string> = {};

		if (!body.title || body.title.trim().length === 0) {
			errors.title = 'Title is required';
		} else if (body.title.length > 500) {
			errors.title = 'Title must not exceed 500 characters';
		}

		if (!body.territory || body.territory.trim().length === 0) {
			errors.territory = 'Territory is required';
		}

		if (!body.type || !['changelog', 'conversation'].includes(body.type)) {
			errors.type = 'Type must be "changelog" or "conversation"';
		}

		if (body.content && body.content.length > 50000) {
			errors.content = 'Content must not exceed 50,000 characters';
		}

		if (Object.keys(errors).length > 0) {
			throw new ValidationError('Invalid act data', errors);
		}
	}

	private parseMetricsParam(metrics?: string): Array<'acts' | 'activity' | 'capabilities' | 'performance'> {
		if (!metrics) {
			return ['acts', 'activity'];
		}

		const requested = metrics.split(',').map(m => m.trim());
		const valid = requested.filter(m => 
			['acts', 'activity', 'capabilities', 'performance'].includes(m)
		) as Array<'acts' | 'activity' | 'capabilities' | 'performance'>;

		return valid.length > 0 ? valid : ['acts', 'activity'];
	}

	private extractIdParam(request: APIRequest): string | undefined {
		// Try to extract ID from path (e.g., /api/acts/123)
		const pathParts = request.path.split('/');
		return pathParts[pathParts.length - 1];
	}

	private formatUptime(ms: number): string {
		const seconds = Math.floor(ms / 1000);
		const minutes = Math.floor(seconds / 60);
		const hours = Math.floor(minutes / 60);
		const days = Math.floor(hours / 24);

		if (days > 0) {
			return `${days}d ${hours % 24}h`;
		} else if (hours > 0) {
			return `${hours}h ${minutes % 60}m`;
		} else if (minutes > 0) {
			return `${minutes}m ${seconds % 60}s`;
		} else {
			return `${seconds}s`;
		}
	}

	private handleAPIError(error: unknown): Error {
		if (error instanceof ValidationError || 
			error instanceof NotFoundError ||
			error instanceof InternalServerError) {
			return error;
		}

		if (error instanceof Error) {
			return new InternalServerError('API request failed', error);
		}

		return new InternalServerError('Unknown API error', error);
	}
}