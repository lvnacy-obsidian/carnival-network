/**
 * ============================================================================
 * 🎪 EXTERNAL API SERVICE - RESTful Endpoints for External Clients 🎪
 * ============================================================================
 * 
 * Provides HTTP REST API endpoints for external systems to interact with the
 * Carnival Network. Routes to the correct performer(s) based on territory and
 * aggregates results across all active performers.
 * 
 * Core Responsibilities:
 * - Act CRUD operations (create, query, get by ID)
 * - Cross-performer search
 * - Network status and topology
 * - Territory enumeration
 * - Analytics generation
 * - Request validation and error handling
 * 
 * Architecture:
 * - Routes requests to appropriate performer(s) based on territory
 * - Aggregates results from multiple performers when territory not specified
 * - Validates all incoming requests
 * - Returns consistent APIResponse<T> wrapper
 * - Handles errors gracefully with proper HTTP status codes
 * 
 * Territory Routing:
 * - Territory specified: Query each performer, filter by territory
 * - No territory: Aggregate from ALL performers
 * - Acts stored with territory metadata, filtered at query time
 * 
 * Exports:
 * - ExternalAPIService (class) - Main API service implementation
 * 
 * Public API Handlers:
 * 
 * Acts Management:
 * - handleActsQuery(request: APIRequest): Promise<APIResponse<...>>
 *   GET /api/acts?territory=backstage&type=changelog&limit=10&offset=0
 *   Aggregates across all performers, filters by territory if specified
 *   Supports pagination, sorting, filtering
 * 
 * - handleActCreate(request: APIRequest): Promise<APIResponse<ActCreateData>>
 *   POST /api/acts
 *   Creates act in first available performer's ActService
 *   Optionally broadcasts to network
 * 
 * - handleActGet(request: APIRequest): Promise<APIResponse<CarnivalAct>>
 *   GET /api/acts/:id
 *   Searches all performers for act by ID
 * 
 * Search:
 * - handleSearch(request: APIRequest): Promise<APIResponse<SearchResponse>>
 *   POST /api/search
 *   Full-text search across all performers
 *   Aggregates and ranks results by relevance
 * 
 * Network Intelligence:
 * - handleCarnivalStatus(): APIResponse<CarnivalStatus>
 *   GET /api/carnival/status
 *   Network health, uptime, topology
 *   Synchronous (reads from cache)
 * 
 * - handleTerritoriesList(): APIResponse<TerritoriesListData>
 *   GET /api/territories
 *   List of all territories with performer counts
 *   Synchronous (reads from cache)
 * 
 * - handleAnalytics(request: APIRequest): APIResponse<AnalyticsData>
 *   GET /api/analytics?metrics=acts,activity,capabilities
 *   Network analytics across all performers
 *   Synchronous (calculated on-demand)
 * 
 * Implementation Details:
 * - Used by: APIRouter (Phase 3.3)
 * - Created in: main.ts initializeAPIRouter()
 * - Accessed via: Local REST API plugin routes
 * - Error handling: All methods catch and wrap errors in APIResponse
 * 
 * Dependencies:
 * - CarnivalNetworkPlugin - Access to activePerformers map
 * - CarnivalPerformer - Individual performer instances
 * - ActService - Act operations (via performer)
 * - CarnivalQueryService - Analytics and topology (via performer)
 * - ValidationError, NotFoundError, InternalServerError - Custom errors
 * 
 * Aggregation Strategy:
 * 1. Get all active performers from plugin.activePerformers
 * 2. Query each performer's ActService/QueryService
 * 3. Merge results (union for acts, aggregate for analytics)
 * 4. Apply post-aggregation filtering if needed
 * 5. Sort and paginate combined results
 * 6. Return unified response
 * 
 * Error Handling:
 * - All handlers wrap errors in APIResponse format
 * - ValidationError → 400 status
 * - NotFoundError → 404 status
 * - InternalServerError → 500 status
 * - Graceful degradation (partial results on some performer failures)
 * 
 * Performance Considerations:
 * - Parallel queries to all performers (Promise.all)
 * - In-memory aggregation (no database joins)
 * - Pagination applied after aggregation
 * - Caching via performer caches (no API-level cache)
 * 
 * @see api-router.ts - Route registration
 * @see main.ts - Service initialization
 * @see carnival-performer.ts - Performer interface
 * @see api-response-types.ts - Response wrapper types
 */

import { Log } from '../utils/logger';
import {
	InternalServerError,
	NotFoundError,
	ValidationError
} from '../errors';
import type CarnivalNetworkPlugin from '../main';
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
	SearchResult,
	TerritoriesListData,
	TerritoryInfo
} from '../types/public';

const apiLogger: LogContext = {
  context: 'External API Service',
  path: '/.obsidian/plugins/carnival-network/src/network/external-api-service'
};

export class ExternalAPIService {
	constructor(
		private readonly plugin: CarnivalNetworkPlugin
	) {
		Log.log(apiLogger, '🎪 External API Service initialized');
	}

	/**
	 * ========================================================================
	 * ACTS ENDPOINTS
	 * ========================================================================
	 */

	/**
	 * Create a new act
	 * POST /api/acts
	 */
	async handleActCreate(request: APIRequest): Promise<APIResponse<ActCreateData>> {
		try {
			const body = this.parseActCreateBody(request.body);
			
			// Validate required fields
			this.validateActCreate(body);

			// Route to performer that handles this territory (or first available)
			const performer = this.getPerformerForTerritory(body.territory);
			
			if (!performer) {
				throw new InternalServerError(
					'No active performers available',
					new Error('Plugin has no active performers')
				);
			}

			const actService = performer.getActService();

			// Create act
			const act = await actService.createAct({
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
				await actService.broadcastAct(act);
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

			// Search all performers for this act
			const allPerformers = Array.from(this.plugin.activePerformers.values());
			
			for (const performer of allPerformers) {
				if (!performer.isPerforming()) {
					continue;
				}

				try {
					const actService = performer.getActService();
					const act = await actService.getAct(id);
					
					if (act) {
						return {
							status: 'success',
							data: act,
							timestamp: new Date().toISOString()
						};
					}
				} catch (error) {
					Log.warn(apiLogger, `Error searching performer ${performer.getPerformerId()}:`, error);
					// Continue searching other performers
				}
			}

			// Act not found in any performer
			throw new NotFoundError('Act', id);

		} catch (error) {
			Log.error(apiLogger, 'Act get failed:', error);
			throw this.handleAPIError(error);
		}
	}

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

			// Get all active performers
			const allPerformers = Array.from(this.plugin.activePerformers.values());

			if (allPerformers.length === 0) {
				Log.warn(apiLogger, 'No active performers - returning empty result');
				return {
					status: 'success',
					data: {
						acts: [],
						pagination: {
							limit: params.limit,
							offset: params.offset,
							total: 0,
							hasNext: false,
							hasPrevious: false
						}
					},
					timestamp: new Date().toISOString()
				};
			}

			// Query each performer's ActService
			const allActs: CarnivalAct[] = [];
			
			for (const performer of allPerformers) {
				if (!performer.isPerforming()) {
					continue;
				}
				
				try {
					const actService = performer.getActService();
					const acts = await actService.queryActs({
						territory: params.territory,
						type: params.type,
						limit: undefined, // Get all for aggregation
						offset: 0
					});
					
					allActs.push(...acts);
				} catch (error) {
					Log.warn(apiLogger, `Failed to query performer ${performer.getPerformerId()}:`, error);
					// Continue with other performers
				}
			}

			// Sort acts (by createdAt desc by default)
			allActs.sort((a, b) => {
				const aTime = new Date(a.createdAt).getTime();
				const bTime = new Date(b.createdAt).getTime();
				return bTime - aTime;
			});

			// Apply pagination to aggregated results
			const total = allActs.length;
			const paginatedActs = allActs.slice(
				params.offset,
				params.offset + params.limit
			);

			return {
				status: 'success',
				data: {
					acts: paginatedActs,
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
			Log.error(apiLogger, 'Acts query failed:', error);
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

			// Search across all performers
			const allPerformers = Array.from(this.plugin.activePerformers.values());
			const allResults: SearchResult[] = [];
			
			for (const performer of allPerformers) {
				if (!performer.isPerforming()) {
					continue;
				}
				
				try {
					const actService = performer.getActService();
					const results = await actService.performSearch({
						query: body.query.trim(),
						territories: body.territories || [],
						limit: limit * 2 // Get extra for merging
					});
					
					allResults.push(...results);

				} catch (error) {
					Log.warn(apiLogger, `Search failed for performer ${performer.getPerformerId()}:`, error);
					// Continue with other performers
				}
			}

			// Deduplicate by ID (in case same act in multiple performers)
			const uniqueResults = new Map<string, SearchResult>();
			for (const result of allResults) {
				if (!uniqueResults.has(result.id) || 
					(result.relevance ?? 0) > (uniqueResults.get(result.id)?.relevance ?? 0)) {
					uniqueResults.set(result.id, result);
				}
			}

			// Sort by relevance and limit
			const sortedResults = Array.from(uniqueResults.values())
				.sort((a, b) => (b.relevance ?? 0) - (a.relevance ?? 0))
				.slice(0, limit);

			return {
				status: 'success',
				data: {
					query: body.query.trim(),
					results: sortedResults,
					resultCount: sortedResults.length,
					hasMore: sortedResults.length === limit
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
	 * CARNIVAL STATUS ENDPOINTS
	 * ========================================================================
	 */

	/**
	 * Get carnival status and health
	 * GET /api/carnival/status
	 */
	handleCarnivalStatus(): APIResponse<CarnivalStatus> {
		try {
			// Aggregate topology from all performers
			const allPerformers = Array.from(this.plugin.activePerformers.values());
			
			if (allPerformers.length === 0) {
				// No performers - return minimal status
				return {
					status: 'success',
					data: {
						health: 'offline',
						uptime: {
							milliseconds: 0,
							formatted: '0s'
						},
						network: {
							totalPerformers: 0,
							connectedPerformers: 0,
							territories: 0,
							activeRegistries: 0
						},
						capabilities: []
					},
					timestamp: new Date().toISOString()
				};
			}

			// Aggregate data from all performers
			const territoriesMap = new Map<string, number>();
			const capabilitiesSet = new Set<string>();
			let totalPerformers = 0;
			let totalConnected = 0;
			let totalActiveRegistries = 0;
			let maxUptime = 0;

			for (const performer of allPerformers) {
				if (!performer.isPerforming()) {
					continue;
				}

				try {
					const queryService = performer.getQueryService() as any; // Cast to access extended methods
					const topology = queryService.getCarnivalTopology();
					const uptime = queryService.getUptimeMs();
					const connected = queryService.getConnectedPerformersCount();

					// Aggregate territories
					for (const [name, count] of Object.entries(topology.territories)) {
						territoriesMap.set(name, (territoriesMap.get(name) || 0) + (count as number));
					}

					// Aggregate capabilities
					topology.capabilities.forEach((cap: string) => capabilitiesSet.add(cap));

					// Aggregate counts
					totalPerformers += topology.totalPerformers;
					totalConnected += connected;
					totalActiveRegistries += topology.activeRegistries;
					maxUptime = Math.max(maxUptime, uptime);

				} catch (error) {
					Log.warn(apiLogger, `Failed to get status from performer ${performer.getPerformerId()}:`, error);
					// Continue with other performers
				}
			}

			return {
				status: 'success',
				data: {
					health: totalConnected > 0 ? 'operational' : 'degraded',
					uptime: {
						milliseconds: maxUptime,
						formatted: this.formatUptime(maxUptime)
					},
					network: {
						totalPerformers,
						connectedPerformers: totalConnected,
						territories: territoriesMap.size,
						activeRegistries: totalActiveRegistries
					},
					capabilities: Array.from(capabilitiesSet)
				},
				timestamp: new Date().toISOString()
			};

		} catch (error) {
			Log.error(apiLogger, 'Carnival status query failed:', error);
			throw this.handleAPIError(error);
		}
	}

	/**
	 * Get territories list
	 * GET /api/territories
	 */
	handleTerritoriesList(): APIResponse<TerritoriesListData> {
		try {
			// Aggregate territories from all performers
			const territoriesMap = new Map<string, number>();
			const allPerformers = Array.from(this.plugin.activePerformers.values());
			
			for (const performer of allPerformers) {
				if (!performer.isPerforming()) {
					continue;
				}
				
				try {
					const queryService = performer.getQueryService() as any;
					const topology = queryService.getCarnivalTopology();
					
					// Merge territory counts
					for (const [name, count] of Object.entries(topology.territories)) {
						territoriesMap.set(name, (territoriesMap.get(name) || 0) + count);
					}
				} catch (error) {
					Log.warn(apiLogger, `Failed to get topology from performer ${performer.getPerformerId()}:`, error);
					// Continue with other performers
				}
			}
			
			const territories: TerritoryInfo[] = Array.from(territoriesMap.entries()).map(([name, performerCount]) => ({
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

			// Aggregate analytics from all performers
			const allPerformers = Array.from(this.plugin.activePerformers.values());
			
			if (allPerformers.length === 0) {
				return {
					status: 'success',
					data: {
						timeframe
					},
					timestamp: new Date().toISOString()
				};
			}

			// Collect analytics from all performers
			const analyticsResults: AnalyticsData[] = [];
			
			for (const performer of allPerformers) {
				if (!performer.isPerforming()) {
					continue;
				}

				try {
					const queryService = performer.getQueryService() as any; // Cast to access extended methods
					const data = queryService.generateAnalytics(metrics);
					analyticsResults.push(data);
				} catch (error) {
					Log.warn(apiLogger, `Failed to get analytics from performer ${performer.getPerformerId()}:`, error);
					// Continue with other performers
				}
			}

			// Merge analytics from all performers
			const mergedData: AnalyticsData = { timeframe };

			// Merge records analytics
			if (metrics.includes('acts')) {
				mergedData.records = this.mergeActsAnalytics(analyticsResults);
			}

			// Merge activity analytics
			if (metrics.includes('activity')) {
				mergedData.activity = this.mergeActivityAnalytics(analyticsResults);
			}

			// Merge capabilities analytics
			if (metrics.includes('capabilities')) {
				mergedData.capabilities = this.mergeCapabilitiesAnalytics(analyticsResults);
			}

			// Merge performance analytics
			if (metrics.includes('performance')) {
				mergedData.performance = this.mergePerformanceAnalytics(analyticsResults);
			}

			return {
				status: 'success',
				data: mergedData,
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

	private getFirstPerformer() {
		const performers = Array.from(this.plugin.activePerformers.values());
		return performers.find(p => p.isPerforming()) || null;
	}

	/**
	 * Get performer that handles a specific territory
	 * Falls back to first available performer if no match
	 */
	private getPerformerForTerritory(territory: string) {
		const allPerformers = Array.from(this.plugin.activePerformers.values());
		
		// Try to find performer that has established this territory
		for (const performer of allPerformers) {
			if (!performer.isPerforming()) {
				continue;
			}

			try {
				const stats = performer.getPerformanceStats();
				if (stats.territories.includes(territory)) {
					return performer;
				}
			} catch (error) {
				Log.warn(apiLogger, `Error checking performer territories:`, error);
			}
		}

		// Fallback: return first performing performer
		return this.getFirstPerformer();
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

	/**
	 * Merge activity analytics from multiple performers
	 */
	private mergeActivityAnalytics(results: AnalyticsData[]): any {
		const merged: any = {
			active: 0,
			inactive: 0,
			recentlyActive: 0,
			byTerritory: {}
		};

		for (const result of results) {
			if (!result.activity) continue;

			merged.active += result.activity.active || 0;
			merged.inactive += result.activity.inactive || 0;
			merged.recentlyActive += result.activity.recentlyActive || 0;

			// Merge byTerritory
			if (result.activity.byTerritory) {
				for (const [territory, count] of Object.entries(result.activity.byTerritory)) {
					merged.byTerritory[territory] = (merged.byTerritory[territory] || 0) + (count as number);
				}
			}
		}

		return merged;
	}

	/**
	 * Merge records analytics from multiple performers
	 */
	private mergeActsAnalytics(results: AnalyticsData[]): any {
		const merged: any = {
			total: 0,
			byTerritory: {},
			byType: {
				changelog: 0,
				conversation: 0
			}
		};

		for (const result of results) {
			if (!result.records) continue;

			merged.total += result.records.total || 0;

			// Merge byTerritory
			if (result.records.byTerritory) {
				for (const [territory, data] of Object.entries(result.records.byTerritory)) {
					if (!merged.byTerritory[territory]) {
						merged.byTerritory[territory] = {
							performerCount: 0,
							capabilities: [],
							lastSeen: null
						};
					}

					const territoryData = data as any;
					merged.byTerritory[territory].performerCount += territoryData.performerCount || 0;

					// Merge capabilities
					const capSet = new Set([
						...merged.byTerritory[territory].capabilities,
						...(territoryData.capabilities || [])
					]);
					merged.byTerritory[territory].capabilities = Array.from(capSet);

					// Update lastSeen to most recent
					if (territoryData.lastSeen) {
						if (!merged.byTerritory[territory].lastSeen ||
							territoryData.lastSeen > merged.byTerritory[territory].lastSeen) {
							merged.byTerritory[territory].lastSeen = territoryData.lastSeen;
						}
					}
				}
			}

			// Merge byType
			if (result.records.byType) {
				merged.byType.changelog += result.records.byType.changelog || 0;
				merged.byType.conversation += result.records.byType.conversation || 0;
			}
		}

		return merged;
	}

	/**
	 * Merge capabilities analytics from multiple performers
	 */
	private mergeCapabilitiesAnalytics(results: AnalyticsData[]): any {
		const merged: Record<string, number> = {};

		for (const result of results) {
			if (!result.capabilities) continue;

			for (const [capability, count] of Object.entries(result.capabilities)) {
				merged[capability] = (merged[capability] || 0) + (count as number);
			}
		}

		return merged;
	}

	/**
	 * Merge performance analytics from multiple performers
	 */
	private mergePerformanceAnalytics(results: AnalyticsData[]): any {
		let maxUptimeMs = 0;
		const territoriesSet = new Set<string>();
		let totalPerformerCount = 0;

		for (const result of results) {
			if (!result.performance) continue;

			// Track max uptime
			if (result.performance.uptimeMs) {
				maxUptimeMs = Math.max(maxUptimeMs, result.performance.uptimeMs);
			}

			// Collect territories
			if (result.performance.totalTerritories) {
				totalPerformerCount++;
			}

			// Parse territories from records if available
			if (result.records?.byTerritory) {
				Object.keys(result.records.byTerritory).forEach(t => territoriesSet.add(t));
			}
		}

		const totalTerritories = territoriesSet.size || 0;

		return {
			uptimeMs: maxUptimeMs,
			uptimeHours: (maxUptimeMs / (60 * 60 * 1000)).toFixed(2),
			averagePerformersPerTerritory: totalTerritories > 0
				? (totalPerformerCount / totalTerritories).toFixed(2)
				: '0',
			totalTerritories
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

	private parseActQueryParams(query: Record<string, unknown>): ActQueryParams & { limit: number; offset: number } {
		return {
			territory: typeof query.territory === 'string' ? query.territory : undefined,
			type: typeof query.type === 'string' ? query.type as 'changelog' | 'conversation' : undefined,
			limit: typeof query.limit === 'string' ? parseInt(query.limit, 10) : 10,
			offset: typeof query.offset === 'string' ? parseInt(query.offset, 10) : 0
		};
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
}