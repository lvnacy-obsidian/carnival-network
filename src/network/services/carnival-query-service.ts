import { Log } from '../../utils/logger';
import { TerritoryAccessService } from './territory-access-service';
import { ObservabilityProviderFactory } from './observability';
import { NotFoundError } from '../../errors';
import { safeGetDateFromMetadata } from 'src/utils/date-utils';
import type {
	ActivityAnalytics,
	AnalyticsData,
	CapabilityAnalytics,
	CarnivalActivity,
	CarnivalConfig,
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

const queryLogger: LogContext = {
	context: 'Carnival Query Service',
	path: '/.obsidian/plugins/carnival-network/services/carnival-query-service'
};

/**
 * 🎭 Carnival Query Service - Cross-territory queries and network analytics
 * 
 * Implements QueryServiceInterface for standardized querying while providing
 * advanced analytics and observability features.
 */
export class CarnivalQueryService implements QueryServiceInterface {
	private startTime: number;
	private observabilityConfig?: ObservabilityConfig;
	private observabilityProvider?: ObservabilityProvider;
	private metricsBuffer: MetricDataPoint[] = [];
	private flushInterval?: number;

	constructor(
		private readonly territoryAccess: TerritoryAccessService,
		private readonly config: CarnivalConfig,
		observabilityConfig?: ObservabilityConfig
	) {
		this.startTime = Date.now();
		
		if (observabilityConfig?.enabled) {
			this.observabilityConfig = observabilityConfig;
			this.initializeObservability();
		}
	}

	/**
	 * Initialize observability provider
	 */
	private async initializeObservability(): Promise<void> {
		if (!this.observabilityConfig) {
			return;
		}

		try {
			this.observabilityProvider = await ObservabilityProviderFactory.createAndInitialize(
				this.observabilityConfig
			);
			this.startMetricsFlush();
			Log.log(queryLogger, `📊 Observability initialized: ${this.observabilityConfig.provider}`);
		} catch (error) {
			Log.error(queryLogger, 'Failed to initialize observability provider:', error);
			// Disable observability on initialization failure
			this.observabilityConfig = undefined;
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
			Log.log(queryLogger, `🔍 Querying territory: ${territory} (type: ${query.type})`);
			
			this.recordMetric('query_territory', 1, { territory, queryType: query.type });

			const performers = this.territoryAccess.getPerformersByTerritory(territory);
			
			if (performers.length === 0) {
				return {
					success: false,
					territory,
					performerId: 'carnival-query-service',
					data: null,
					timestamp: new Date().toISOString(),
					error: `No performers found in territory: ${territory}`
				};
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

			return {
				success: true,
				territory,
				performerId: 'carnival-query-service',
				data,
				timestamp: new Date().toISOString()
			};

		} catch (error) {
			Log.error(queryLogger, `Failed to query territory ${territory}:`, error);
			
			return {
				success: false,
				territory,
				performerId: 'carnival-query-service',
				data: null,
				timestamp: new Date().toISOString(),
				error: error instanceof Error ? error.message : 'Unknown error'
			};
		}
	}

	/**
	 * Query all territories
	 */
	async queryAllTerritories(query: CarnivalQuery): Promise<QueryResult[]> {
		try {
			Log.log(queryLogger, `🔍 Querying all territories (type: ${query.type})`);
			
			this.recordMetric('query_all_territories', 1, { queryType: query.type });

			const territories = this.territoryAccess.getAllTerritories();
			const results: QueryResult[] = [];

			for (const territory of territories) {
				const result = await this.queryTerritory(territory, query);
				results.push(result);
			}

			return results;

		} catch (error) {
			Log.error(queryLogger, 'Failed to query all territories:', error);
			return [];
		}
	}

	/**
	 * Get performer status by ID
	 */
	async getPerformerStatus(performerId: string): Promise<PerformanceStatus | null> {
		try {
			const performer = this.territoryAccess.getPerformer(performerId);
			
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

			this.recordMetric('performer_status_check', 1, { performerId, status });

			return performanceStatus;

		} catch (error) {
			if (error instanceof NotFoundError) {
				Log.warn(queryLogger, `Performer not found: ${performerId}`);
				return null;
			}
			
			Log.error(queryLogger, `Failed to get performer status for ${performerId}:`, error);
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
			const allPerformers = this.territoryAccess.getAllPerformers();
			
			const territories: Record<string, number> = {};
			const allCapabilities = new Set<string>();
			
			for (const performer of allPerformers) {
				territories[performer.territoryName] = (territories[performer.territoryName] || 0) + 1;
				
				performer.capabilities?.forEach(cap => allCapabilities.add(cap));
			}
			
			const recentThreshold = Date.now() - (5 * 60 * 1000);
			const activeRegistries = allPerformers.filter(performer => {
				return performer.lastSeen && new Date(performer.lastSeen).getTime() > recentThreshold;
			}).length;

			const topology: CarnivalTopology = {
				territories,
				totalPerformers: allPerformers.length,
				activeRegistries,
				capabilities: Array.from(allCapabilities),
				lastUpdated: new Date().toISOString()
			};

			// Record metrics
			this.recordMetric('topology_total_performers', allPerformers.length);
			this.recordMetric('topology_active_registries', activeRegistries);
			this.recordMetric('topology_territory_count', Object.keys(territories).length);
			
			return topology;
			
		} catch (error) {
			Log.error(queryLogger, 'Failed to get carnival topology:', error);
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
			
			const allPerformers = this.territoryAccess.getAllPerformers();
			
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

			this.recordMetric('recent_activity_count', activities.length, { hours: hours.toString() });
			
			return activities.slice(0, 100); // Limit to 100 most recent
			
		} catch (error) {
			Log.error(queryLogger, 'Failed to get recent activity:', error);
			return [];
		}
	}

	/**
	 * Generate analytics data
	 */
	generateAnalytics(metrics: string[]): AnalyticsData {
		try {
			
			const allPerformers = this.territoryAccess.getAllPerformers();
			
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
			Log.error(queryLogger, 'Analytics generation failed:', error);
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
			const allPerformers = this.territoryAccess.getAllPerformers();
			const recentThreshold = Date.now() - (10 * 60 * 1000); // 10 minutes
			
			return allPerformers.filter(performer => {
				return performer.lastSeen && new Date(performer.lastSeen).getTime() > recentThreshold;
			}).length;
			
		} catch (error) {
			Log.error(queryLogger, 'Failed to get connected performers count:', error);
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
	 * Record a metric for observability
	 */
	private recordMetric(
		name: string, 
		value: number, 
		tags?: Record<string, string>,
		type: 'counter' | 'gauge' | 'histogram' = 'gauge'
	): void {
		if (!this.observabilityConfig?.enabled) {
			return;
		}

		const metric: MetricDataPoint = {
			name: `carnival.${name}`,
			value,
			timestamp: new Date().toISOString(),
			tags,
			type
		};

		this.metricsBuffer.push(metric);

		// Flush if buffer is full
		if (this.metricsBuffer.length >= (this.observabilityConfig.batchSize ?? 100)) {
			this.flushMetrics();
		}
	}

	/**
	 * Flush metrics to observability endpoint
	 */
	private async flushMetrics(): Promise<void> {
		if (!this.observabilityConfig?.enabled || !this.observabilityProvider || this.metricsBuffer.length === 0) {
			return;
		}

		const metrics = [...this.metricsBuffer];
		this.metricsBuffer = [];

		try {
			await this.observabilityProvider.sendMetrics(metrics);
			Log.log(queryLogger, `📊 Flushed ${metrics.length} metrics to ${this.observabilityConfig.provider}`);
		} catch (error) {
			Log.error(queryLogger, 'Failed to flush metrics:', error);
			// Re-add metrics to buffer to try again (with limit)
			const MAX_BUFFER_SIZE = this.observabilityConfig.maxBufferSize ?? 10000;
			if (this.metricsBuffer.length + metrics.length <= MAX_BUFFER_SIZE) {
				this.metricsBuffer.unshift(...metrics);
			} else {
				Log.warn(queryLogger, `Dropping ${metrics.length} metrics due to buffer overflow`);
			}
		}
	}

	/**
	 * Start periodic metrics flush
	 */
	private startMetricsFlush(): void {
		const interval = this.observabilityConfig?.flushIntervalMs ?? 60000;
		this.flushInterval = window.setInterval(() => {
			this.flushMetrics();
		}, interval);
	}

	/**
	 * Cleanup
	 */
	async cleanup(): Promise<void> {
		if (this.flushInterval) {
			clearInterval(this.flushInterval);
		}
		this.flushMetrics(); // Final flush

		if (this.observabilityProvider) {
			await this.observabilityProvider.cleanup();
		}
	}
}