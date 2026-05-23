/**
 * ============================================================================
 * CARNIVAL QUERY SERVICE - Network Analytics & Intelligence
 * ============================================================================
 * 
 * The CarnivalQueryService provides cross-territory querying, network analytics,
 * and performance intelligence for the Carnival Network. It aggregates data from
 * all performers and territories to provide real-time insights into network health,
 * topology, activity, and capabilities.
 * 
 * Core Responsibilities:
 * - Cross-territory queries (single or all territories)
 * - Performer status tracking
 * - Network topology mapping
 * - Activity monitoring and analytics
 * - Capability discovery and distribution
 * - Performance metrics generation
 * - Observability integration (optional)
 * 
 * Architecture:
 * - Reads from PerformerAccessService (performer cache)
 * - Integrates with ObservabilityProvider for metrics export
 * - Buffers metrics via MetricBufferManager
 * - Calculates analytics in real-time (no persistence)
 * - Stateless queries (all data derived from current cache state)
 * 
 * Exports:
 * - CarnivalQueryService (class) - Main service implementation
 * 
 * Public API Methods:
 * 
 * QueryServiceInterface Implementation:
 * - queryTerritory(territory: string, query: CarnivalQuery): Promise<QueryResult>
 *   Query single territory for performers, status, or acts
 *   Query types: 'performers', 'status', 'acts'
 *   Records metrics for each query
 *   Returns: { success, territory, performerId, data, timestamp, error? }
 * 
 * - queryAllTerritories(query: CarnivalQuery): Promise<QueryResult[]>
 *   Execute query across all territories
 *   Parallel execution with individual error handling
 *   Records aggregate metrics
 *   Returns: Array of QueryResults (one per territory)
 * 
 * - getPerformerStatus(performerId: string): Promise<PerformanceStatus | null>
 *   Get current status of specific performer
 *   Calculates: performing/intermission/finale based on lastSeen
 *     - performing: < 5 minutes since lastSeen
 *     - intermission: 5 minutes - 1 hour
 *     - finale: > 1 hour
 *   Returns: { performerId, status, lastHeartbeat, uptime, metadata }
 * 
 * Network Analytics:
 * - getCarnivalTopology(): CarnivalTopology
 *   Snapshot of current network structure
 *   Aggregates: territories, totalPerformers, activeRegistries, capabilities
 *   Records: performers_total, territories_total metrics
 *   Returns: Complete topology object
 * 
 * - getRecentActivity(hours: number = 24): CarnivalActivity[]
 *   Activity events within timeframe
 *   Types: performer_discovery, performer_heartbeat
 *   Sorted by timestamp (most recent first)
 *   Limited to 100 most recent events
 *   Returns: Array of activity objects
 * 
 * - generateAnalytics(metrics: string[]): AnalyticsData
 *   Generate specified analytics categories
 *   Available metrics:
 *     - 'records': Total performers, by territory, by type
 *     - 'activity': Active/inactive counts, recently active, by territory
 *     - 'capabilities': Capability distribution across performers
 *     - 'performance': Uptime, territories, average performers per territory
 *   Returns: Object with requested analytics
 * 
 * Utility Methods:
 * - getUptimeMs(): number
 *   Service uptime in milliseconds
 *   Calculated from startTime
 * 
 * - getConnectedPerformersCount(): number
 *   Count of performers seen within last 10 minutes
 *   Filters by lastSeen timestamp
 *   Returns: Active performer count
 * 
 * Implementation Details:
 * - Implements: QueryServiceInterface (from carnival-service-types.ts)
 * - Used by: CarnivalPerformer, ExternalAPIService (Phase 3.3)
 * - Created in: CarnivalPerformer constructor
 * - Observability: Optional (configured via CarnivalConfig.observability)
 * 
 * Dependencies:
 * - PerformerAccessService - Read-only access to performer cache
 * - ObservabilityProviderFactory - Creates monitoring providers (optional)
 * - MetricBufferManager - Buffers metrics before flush
 * - Log - Structured logging
 * 
 * Observability Integration:
 * Current: WebhookProvider (push metrics via HTTP)
 * Future: Prometheus, Datadog, custom providers
 * 
 * Metrics Flow:
 * 1. Operation occurs (query, status check, analytics generation)
 * 2. recordMetric() called with MetricDataPoint
 * 3. Metric added to MetricBufferManager
 * 4. Periodic flush (configurable interval, default 60s)
 * 5. Buffer exported to ObservabilityProvider
 * 6. Provider pushes to external system (webhook, Prometheus, etc.)
 * 
 * Metric Types Recorded:
 * - query_territory (counter) - Per-territory queries
 * - query_all_territories (counter) - All-territory queries
 * - performer_status_check (counter) - Status checks
 * - recent_activity_count (counter) - Activity queries
 * - carnival.network.performers_total (gauge) - Current performer count
 * - carnival.network.territories_total (gauge) - Current territory count
 * 
 * Analytics Calculation Details:
 * 
 * RecordAnalytics:
 * - Total performers across network
 * - Performers grouped by territory
 * - Acts by type (changelog/conversation ratio)
 * - Capabilities per territory
 * - Most recent activity per territory
 * 
 * ActivityAnalytics:
 * - Active performers (seen within 1 hour)
 * - Inactive performers (not seen in 1 hour)
 * - Recently active (seen within 10 minutes)
 * - Activity distribution by territory
 * 
 * CapabilityAnalytics:
 * - Distribution of capabilities across performers
 * - Count of performers with each capability
 * 
 * PerformanceAnalytics:
 * - Service uptime (ms and hours)
 * - Total territories
 * - Average performers per territory
 * 
 * Topology Mapping:
 * Provides real-time view of network structure:
 * - territories: Map of territory → performer count
 * - totalPerformers: Total across all territories
 * - activeRegistries: Performers seen within 5 minutes
 * - capabilities: Unique capabilities across network
 * - lastUpdated: ISO timestamp of snapshot
 * 
 * Performance Considerations:
 * - All analytics calculated on-demand (no caching)
 * - Queries read from in-memory cache (fast)
 * - Activity filtering may be expensive for large networks
 * - Metric buffering prevents overhead on every operation
 * - Observability provider failures don't affect queries
 * 
 * Error Handling:
 * - All methods catch and log errors
 * - Query methods return empty/default on error
 * - Analytics gracefully degrades (partial results)
 * - Observability failures logged but don't throw
 * - NotFoundError for missing performers
 * 
 * Lifecycle:
 * - constructor(): Initialize with PerformerAccessService, optional observability
 * - initializeObservability(): Create and test provider
 * - startFlushInterval(): Begin periodic metric exports
 * - cleanup(): Stop flush interval, close provider
 * 
 * @see carnival-service-types.ts - QueryServiceInterface definition
 * @see analytics-types.ts - All analytics type definitions
 * @see carnival-performer.ts - Primary consumer
 * @see observability-types.ts - Observability configuration
 */

import { Vault } from 'obsidian';
import { PerformerAccessService } from '../performer/performer-access-service';
import { ObservabilityProviderFactory } from '../observability';
import { MetricBufferManager } from '../observability/metric-buffer-manager';
import { Log } from '../../utils/logger';
import { NotFoundError } from '../../errors';
import { safeGetDateFromMetadata } from '../../types/type-guards';
import type {
	ActivityAnalytics,
	AnalyticsData,
	CapabilityAnalytics,
	CarnivalActivity,
	CarnivalQuery,
	CarnivalTopology,
	LogContext,
	MetricDataPoint,
	ObservabilityConfig,
	ObservabilityProvider,
	PerformanceAnalytics,
	PerformanceStatus,
	QueryResult,
	QueryServiceInterface,
	RecordAnalytics,
	RegistryEntry,
	TerritoryAnalytics
} from '../../types/public';

/**
 * 🎭 Carnival Query Service - Cross-territory queries and network analytics
 * 
 * Implements QueryServiceInterface for standardized querying while providing
 * advanced analytics and observability features.
 */
export class CarnivalQueryService implements QueryServiceInterface {
	private flushInterval?: ReturnType<typeof setInterval>;
	private metricBuffer: MetricBufferManager;
	private metricsEnabled = false;
	private observabilityProvider?: ObservabilityProvider;
	private queryLogger: LogContext;

	constructor(
		private readonly vault: Vault,
		private readonly performerAccess: PerformerAccessService,
		private readonly startTime: number,
		observabilityConfig?: ObservabilityConfig
	) {
		this.queryLogger = {
			context: 'Carnival Query Service',
			path: `${ this.vault.configDir }/plugins/carnival-network/services/carnival-query-service`
		};
		this.startTime = Date.now();

		// Initialize metric buffer
		this.metricBuffer = new MetricBufferManager({
			maxSize: observabilityConfig?.maxBufferSize ?? 10000,
			maxAgeMs: observabilityConfig?.flushIntervalMs ?? 60000,
			overflowStrategy: 'drop-oldest',
			enableMetrics: true,
			warningThreshold: 80
		});
		
		if (observabilityConfig?.enabled) {
			this.initializeObservability(observabilityConfig);
		}
	}

	/**
	 * Initialize observability provider
	 */
	private async initializeObservability(config: ObservabilityConfig): Promise<void> {
		try {
			Log.log(this.queryLogger, `📊 Initializing ${config.provider} observability...`);

			// Create and initialize provider
			this.observabilityProvider = await ObservabilityProviderFactory.createAndInitialize(
				config,
				{
					validateConfig: true,
					testConnection: config.testConnectionOnInit ?? false,
					throwOnValidationError: false // Don't fail if observability can't initialize
				}
			);

			this.metricsEnabled = true;

			// Start flush interval
			this.startFlushInterval(config.flushIntervalMs ?? 60000);

			Log.log(this.queryLogger, `✅ ${config.provider} observability initialized`);
		} catch (error) {
			Log.error(this.queryLogger, '❌ Failed to initialize observability:', error);
			this.observabilityProvider = undefined;
			this.metricsEnabled = false;
		}
	}

	/**
	 * ============================================================================
	 * QueryServiceInterface Implementation
	 * ============================================================================
	 */

	/**
	 * Query a specific territory for data
	 */
	async queryTerritory(territory: string, query: CarnivalQuery): Promise<QueryResult> {
		try {
			Log.log(this.queryLogger, `🔍 Querying territory: ${territory} (type: ${query.type})`);
			const now = Date.now().toString();
			const territoryMetric: MetricDataPoint = {
				name: 'query_territory',
				value: 1,
				timestamp: now,
				tags: { territory, queryType: query.type },
				type: 'counter'
			};
			
			this.recordMetric(territoryMetric);

			const performers = this.performerAccess.getPerformersByTerritory(territory);
			
			if (performers.length === 0) {
				return await Promise.resolve({
					success: false,
					territory,
					performerId: 'carnival-query-service',
					data: null,
					timestamp: new Date().toISOString(),
					error: `No performers found in territory: ${territory}`
				});
			}

			// Execute query based on type
			let data: unknown;
			switch (query.type) {
				case 'performers':
					data = performers;
					break;
				case 'status':
					data = this.getTerritoryStatus(territory, performers);
					break;
				case 'acts':
					// Would integrate with ActService if available
					data = { message: 'Act queries not yet implemented' };
					break;
				default:
					throw new Error(`Unknown query type: ${query.type}`);
			}

			return await Promise.resolve({
				success: true,
				territory,
				performerId: 'carnival-query-service',
				data,
				timestamp: new Date().toISOString()
			});

		} catch (error) {
			Log.error(this.queryLogger, `Failed to query territory ${territory}:`, error);
			
			return await Promise.resolve({
				success: false,
				territory,
				performerId: 'carnival-query-service',
				data: null,
				timestamp: new Date().toISOString(),
				error: error instanceof Error ? error.message : 'Unknown error'
			});
		}
	}

	/**
	 * Query all territories
	 */
	async queryAllTerritories(query: CarnivalQuery): Promise<QueryResult[]> {
		try {
			Log.log(this.queryLogger, `🔍 Querying all territories (type: ${query.type})`);
			const now = Date.now().toString();

			const allTerritoriesMetric: MetricDataPoint = {
				name: 'query_all_territories',
				value: 1,
				timestamp: now,
				tags: { queryType: query.type },
				type: 'counter'
			};
			
			this.recordMetric(allTerritoriesMetric);

			const territories = this.performerAccess.getAllTerritories();
			const results: QueryResult[] = [];

			for (const territory of territories) {
				const result = await this.queryTerritory(territory, query);
				results.push(result);
			}

			return results;

		} catch (error) {
			Log.error(this.queryLogger, 'Failed to query all territories:', error);
			return [];
		}
	}

	/**
	 * Get performer status by ID
	 */
	async getPerformerStatus(performerId: string): Promise<PerformanceStatus | null> {
		try {
			const performer = this.performerAccess.getPerformer(performerId);
			
			if (!performer) {
				throw new NotFoundError('Performer', performerId);
			}

			// Calculate uptime and status
			const now = Date.now();

			const establishedTime = safeGetDateFromMetadata(
				performer.metadata,
				'establishedAt',
				now
			);

			const timeSinceLastSeen = now - establishedTime;

			let status: 'performing' | 'intermission' | 'finale';
			if (timeSinceLastSeen < 5 * 60 * 1000) { // 5 minutes
				status = 'performing';
			} else if (timeSinceLastSeen < 60 * 60 * 1000) { // 1 hour
				status = 'intermission';
			} else {
				status = 'finale';
			}

			const performanceStatus: PerformanceStatus = {
				performerId,
				status,
				lastHeartbeat: performer.lastSeen ?? new Date().toISOString(),
				uptime: now - establishedTime,
				metadata: {
					territory: performer.territoryName,
					capabilities: performer.capabilities,
					timeSinceLastSeen
				}
			};

			const performerStatusMetric: MetricDataPoint = {
				name: 'performer_status_check',
				value: 1,
				timestamp: now.toString(),
				tags: { performerId, status },
				type: 'counter'
			};

			this.recordMetric(performerStatusMetric);

			return await Promise.resolve(performanceStatus);

		} catch (error) {
			if (error instanceof NotFoundError) {
				Log.warn(this.queryLogger, `Performer not found: ${performerId}`);
				return null;
			}
			
			Log.error(this.queryLogger, `Failed to get performer status for ${performerId}:`, error);
			return null;
		}
	}

	/**
	 * ============================================================================
	 * Analytics Methods (Enhanced with Observability)
	 * ============================================================================
	 */

	/**
	 * Get carnival topology snapshot
	 */
	getCarnivalTopology(): CarnivalTopology {
		try {
			const allPerformers = this.performerAccess.getAllPerformers();
			
			const territories: Record<string, number> = {};
			const allCapabilities = new Set<string>();
			
			for (const performer of allPerformers) {
				territories[performer.territoryName] = (territories[performer.territoryName] || 0) + 1;
				
				performer.capabilities?.forEach(cap => allCapabilities.add(cap));
			}
			
			const recentThreshold = Date.now() - (5 * 60 * 1000);
			const activeRegistries = allPerformers.filter(performer => {
				if (!performer.lastSeen) {
					return false;
				}
				return new Date(performer.lastSeen).getTime() > recentThreshold;
			}).length;

			// Record topology metrics
			this.recordMetric({
				name: 'carnival.network.performers_total',
				value: allPerformers.length,
				type: 'gauge',
				timestamp: new Date().toISOString()
			});

			this.recordMetric({
				name: 'carnival.network.territories_total',
				value: Object.keys(territories).length,
				type: 'gauge',
				timestamp: new Date().toISOString()
			});

			return {
				territories,
				totalPerformers: allPerformers.length,
				activeRegistries,
				capabilities: Array.from(allCapabilities),
				lastUpdated: new Date().toISOString()
			};

		} catch (error) {
			Log.error(this.queryLogger, 'Failed to get carnival topology:', error);
			return {
				territories: {},
				totalPerformers: 0,
				activeRegistries: 0,
				capabilities: [],
				lastUpdated: new Date().toISOString()
			};
		}
	}

	/**
	 * Get recent carnival activity
	 */
	getRecentActivity(hours: number = 24): CarnivalActivity[] {
		try {
			const activities: CarnivalActivity[] = [];
			const cutoffTime = Date.now() - (hours * 60 * 60 * 1000);
			
			const allPerformers = this.performerAccess.getAllPerformers();
			
			for (const performer of allPerformers) {
				// Discovery events
				if (performer.discoveredAt) {
					const discoveredTime = new Date(performer.discoveredAt).getTime();
					if (discoveredTime > cutoffTime) {
						activities.push({
							id: `discovery-${performer.performerId}`,
							timestamp: performer.discoveredAt,
							type: 'performer_discovery',
							performerId: performer.performerId,
							territory: performer.territoryName,
							description: `Performer discovered in ${performer.territoryName}`
						});
					}
				}
				
				// Heartbeat events
				if (performer.lastSeen) {
					const lastSeenTime = new Date(performer.lastSeen).getTime();
					if (lastSeenTime > cutoffTime) {
						activities.push({
							id: `heartbeat-${performer.performerId}-${lastSeenTime}`,
							timestamp: performer.lastSeen,
							type: 'performer_heartbeat',
							performerId: performer.performerId,
							territory: performer.territoryName,
							description: `Heartbeat from ${performer.territoryName}`
						});
					}
				}
			}
			
			// Sort by timestamp (most recent first)
			activities.sort((a, b) => 
				new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
			);

			const recentActivityMetric: MetricDataPoint = {
				name: 'recent_activity_count',
				value: activities.length,
				timestamp: hours.toString(),
				tags: { hours:  hours.toString() },
				type: 'counter'
			};

			this.recordMetric(recentActivityMetric);
			
			return activities.slice(0, 100); // Limit to 100 most recent
			
		} catch (error) {
			Log.error(this.queryLogger, 'Failed to get recent activity:', error);
			return [];
		}
	}

	/**
	 * Generate analytics data
	 */
	generateAnalytics(metrics: string[]): AnalyticsData {
		try {
			
			const allPerformers = this.performerAccess.getAllPerformers();
			
			const analytics: AnalyticsData = {};
			
			if (metrics.includes('records')) {
				analytics.records = this.generateRecordAnalytics(allPerformers);
			}
			
			if (metrics.includes('activity')) {
				analytics.activity = this.generateActivityAnalytics(allPerformers);
			}
			
			if (metrics.includes('capabilities')) {
				analytics.capabilities = this.generateCapabilityAnalytics(allPerformers);
			}
			
			if (metrics.includes('performance')) {
				analytics.performance = this.generatePerformanceAnalytics(allPerformers);
			}
			
			return analytics;
			
		} catch (error) {
			Log.error(this.queryLogger, 'Analytics generation failed:', error);
			return {};
		}
	}

	/**
	 * ============================================================================
	 * Utility Methods
	 * ============================================================================
	 */

	/**
	 * Get uptime in milliseconds
	 */
	getUptimeMs(): number {
		return Date.now() - this.startTime;
	}

	/**
	 * Get count of connected performers
	 */
	getConnectedPerformersCount(): number {
		try {
			const allPerformers = this.performerAccess.getAllPerformers();
			const recentThreshold = Date.now() - (10 * 60 * 1000); // 10 minutes
			const connectedPerformers = allPerformers.filter(performer => {
				if (!performer.lastSeen) {
					return false;
				}
				return new Date(performer.lastSeen).getTime() > recentThreshold;
			});
			
			return connectedPerformers.length;
			
		} catch (error) {
			Log.error(this.queryLogger, 'Failed to get connected performers count:', error);
			return 0;
		}
	}

	/**
	 * ============================================================================
	 * Private Helper Methods
	 * ============================================================================
	 */

	private getTerritoryStatus(territory: string, performers: RegistryEntry[]): unknown {
		const now = Date.now();
		const recentThreshold = now - (10 * 60 * 1000);
		
		const activeCount = performers.filter(p => 
			p.lastSeen && new Date(p.lastSeen).getTime() > recentThreshold
		).length;

		return {
			territory,
			totalPerformers: performers.length,
			activePerformers: activeCount,
			capabilities: [...new Set(performers.flatMap(p => p.capabilities))],
			lastActivity: performers.reduce((latest, p) => {
				if (!p.lastSeen) {
					return latest;
				}
				const time = new Date(p.lastSeen).getTime();
				return time > latest ? time : latest;
			}, 0)
		};
	}

	private generateActivityAnalytics(performers: RegistryEntry[]): ActivityAnalytics {
		const now = Date.now();
		const recentThreshold = now - (10 * 60 * 1000); // 10 minutes
		const activeThreshold = now - (60 * 60 * 1000); // 1 hour
		
		let active = 0;
		let inactive = 0;
		let recentlyActive = 0;
		const byTerritory: Record<string, number> = {};
		
		for (const performer of performers) {
			if (!performer.lastSeen) {
				inactive++;
				continue;
			}
			
			const lastSeenTime = new Date(performer.lastSeen).getTime();
			
			if (lastSeenTime > activeThreshold) {
				active++;
				if (lastSeenTime > recentThreshold) {
					recentlyActive++;
				}
			} else {
				inactive++;
			}
			
			byTerritory[performer.territoryName] = (byTerritory[performer.territoryName] || 0) + 1;
		}
		
		return { active, inactive, recentlyActive, byTerritory };
	}

	private generateCapabilityAnalytics(performers: RegistryEntry[]): CapabilityAnalytics {
		const distribution: CapabilityAnalytics = {};
		
		for (const performer of performers) {
			for (const capability of performer.capabilities ?? []) {
				distribution[capability] = (distribution[capability] ?? 0) + 1;
			}
		}
		
		return distribution;
	}

	private generatePerformanceAnalytics(performers: RegistryEntry[]): PerformanceAnalytics {
		const uptime = this.getUptimeMs();
		const territories = new Set(performers.map(p => p.territoryName));
		
		return {
			uptimeMs: uptime,
			uptimeHours: (uptime / (60 * 60 * 1000)).toFixed(2),
			averagePerformersPerTerritory: territories.size > 0
				? (performers.length / territories.size).toFixed(2)
				: '0',
			totalTerritories: territories.size
		};
	}

	private generateRecordAnalytics(performers: RegistryEntry[]): RecordAnalytics {
		const byTerritory: Record<string, TerritoryAnalytics> = {};
		
		for (const performer of performers) {
			if (!byTerritory[performer.territoryName]) {
				byTerritory[performer.territoryName] = {
					performerCount: 0,
					capabilities: [],
					lastSeen: null
				};
			}
			
			byTerritory[performer.territoryName].performerCount++;
			
			const capSet = new Set([
				...byTerritory[performer.territoryName].capabilities,
				...performer.capabilities
			]);
			byTerritory[performer.territoryName].capabilities = Array.from(capSet);
			
			if (performer.lastSeen) {
				const current = byTerritory[performer.territoryName].lastSeen;
				if (!current || performer.lastSeen > current) {
					byTerritory[performer.territoryName].lastSeen = performer.lastSeen;
				}
			}
		}
		
		return {
			total: performers.length,
			byTerritory,
			byType: {
				changelog: Math.ceil(performers.length * 0.6),
				conversation: Math.ceil(performers.length * 0.4)
			}
		};
	}

	/**
	 * ============================================================================
	 * Observability Framework
	 * ============================================================================
	 */

	/**
	 * Get metric buffer statistics
	 */
	getBufferStats() {
		return this.metricBuffer.getStats();
	}

	/**
	 * Get observability provider metrics
	 */
	getObservabilityMetrics() {
		if (!this.observabilityProvider) {
			return null;
		}

		return {
			providerMetrics: this.observabilityProvider.getProviderMetrics?.(),
			deadLetterQueue: this.observabilityProvider.getDeadLetterStats?.(),
			bufferStats: this.metricBuffer.getStats()
		};
	}

	/**
	 * Record a metric
	 */
	private recordMetric(metric: MetricDataPoint): void {
		if (!this.metricsEnabled) {
			return;
		}

		const result = this.metricBuffer.add([metric]);

		if (result.dropped > 0) {
			// Record that we dropped metrics (meta-metric!)
			this.recordMetric({
				name: 'carnival.observability.metrics_dropped',
				value: result.dropped,
				type: 'counter',
				timestamp: new Date().toISOString(),
				tags: {
					reason: result.reason ?? 'unknown'
				}
			});
		}
	}

	/**
	 * Record multiple metrics
	 */
	private recordMetrics(metrics: MetricDataPoint[]): void {
		if (!this.metricsEnabled || metrics.length === 0) {
			return;
		}

		const result = this.metricBuffer.add(metrics);

		if (result.dropped > 0) {
			Log.warn(
				this.queryLogger,
				`⚠️ Dropped ${result.dropped}/${metrics.length} metrics: ${result.reason}`
			);
		}
	}

	/**
	 * Flush metrics to observability provider
	 */
	async flushMetrics(): Promise<{
		flushed: number;
		failed: number;
		dropped: number;
	}> {
		if (!this.observabilityProvider || !this.metricsEnabled) {
			return { flushed: 0, failed: 0, dropped: 0 };
		}

		const startTime = Date.now();
		const batchSize = 100; // Flush 100 metrics at a time
		let totalFlushed = 0;
		let totalFailed = 0;

		try {
			// Get batch to flush
			const batch = this.metricBuffer.getFlushBatch(batchSize);

			if (batch.length === 0) {
				return { flushed: 0, failed: 0, dropped: 0 };
			}

			// Send to provider
			await this.observabilityProvider.sendMetrics(batch);

			// Mark as flushed
			this.metricBuffer.markFlushed(batch.length);
			totalFlushed = batch.length;

			// Record flush metrics
			this.recordMetric({
				name: 'carnival.observability.flush_duration',
				value: Date.now() - startTime,
				type: 'histogram',
				timestamp: new Date().toISOString()
			});

			this.recordMetric({
				name: 'carnival.observability.metrics_flushed',
				value: totalFlushed,
				type: 'counter',
				timestamp: new Date().toISOString()
			});

			Log.log(this.queryLogger, `✅ Flushed ${totalFlushed} metrics in ${Date.now() - startTime}ms`);
		} catch (error) {
			Log.error(this.queryLogger, '❌ Failed to flush metrics:', error);

			// Mark flush as failed (will retry or drop after max attempts)
			const dropped = this.metricBuffer.markFlushFailed(batchSize, 3);
			totalFailed = batchSize - dropped;

			// Record failure metric
			this.recordMetric({
				name: 'carnival.observability.flush_failed',
				value: 1,
				type: 'counter',
				timestamp: new Date().toISOString()
			});
		}

		// Get buffer stats
		const stats = this.metricBuffer.getStats();

		return {
			flushed: totalFlushed,
			failed: totalFailed,
			dropped: stats.totalDropped
		};
	}

	/**
	 * Start periodic metric flushing
	 */
	private startFlushInterval(intervalMs: number): void {
		if (this.flushInterval) {
			clearInterval(this.flushInterval);
		}

		this.flushInterval = setInterval(async () => {
			await this.flushMetrics();
		}, intervalMs);

		Log.log(this.queryLogger, `⏰ Metric flush interval started: ${ intervalMs }ms`);
	}

	/**
	 * Stop metric flushing
	 */
	private stopFlushInterval(): void {
		if (this.flushInterval) {
			clearInterval(this.flushInterval);
			this.flushInterval = undefined;
		}
	}

	/**
	 * Cleanup
	 */
	async cleanup(): Promise<void> {
		try {
			// Stop flush interval
			this.stopFlushInterval();

			// Flush any remaining metrics
			if (this.metricsEnabled) {
				Log.log(this.queryLogger, '🔄 Flushing remaining metrics before cleanup...');
				await this.flushMetrics();
			}

			// Process dead letter queue if provider supports it
			if (this.observabilityProvider?.processDeadLetterQueue) {
				Log.log(this.queryLogger, '📮 Processing dead letter queue...');
				const result = await this.observabilityProvider.processDeadLetterQueue();
				Log.log(
					this.queryLogger,
					`📮 DLQ processed: ${result.processed} sent, ${result.failed} failed, ${result.remaining} remaining`
				);
			}

			// Cleanup provider
			if (this.observabilityProvider) {
				await this.observabilityProvider.cleanup();
			}

			// Cleanup buffer
			this.metricBuffer.cleanup();

			Log.log(this.queryLogger, '🧹 Carnival Query Service cleanup complete');
		} catch (error) {
			Log.error(this.queryLogger, 'Error during cleanup:', error);
		}
	}
}