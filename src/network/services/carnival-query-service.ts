// services/network-query-service.ts
import { Log } from '../../utils/logger';
import { TerritoryAccessService } from './territory-access-service';
import type {
	ActivityAnalytics,
	AnalyticsData,
	CapabilityAnalytics,
	NetworkActivity,
	NetworkTopology,
	PerformanceAnalytics,
	RecordAnalytics,
	RegistryEntry,
	TerritoryAnalytics
} from '../../types/public';

const networkLogger = {
	context: 'Network Query Service',
	path: '/.obsidian/plugins/carnival-records/network/services/network-query-service'
};

/**
 * Handles network topology and status queries
 */
export class CarnivalQueryService {
	constructor(
		private readonly registryAccess: TerritoryAccessService,
		private readonly startTime: number
	) {}

	/**
	 * Get network topology
	 */
	getNetworkTopology(): NetworkTopology {
		try {
			const allPerformers = this.registryAccess.getAllPerformers();
			
			const territories: Record<string, number> = {};
			const allCapabilities = new Set<string>();
			
			for (const performer of allPerformers) {
				territories[performer.territoryName] = (territories[performer.territoryName] || 0) + 1;
				
				if (performer.capabilities) {
					performer.capabilities.forEach(cap => allCapabilities.add(cap));
				}
			}
			
			const recentThreshold = Date.now() - (5 * 60 * 1000);
			const activeRegistries = allPerformers.filter(performer => {
				if (!performer.lastSeen) {
					return false;
				}
				return new Date(performer.lastSeen).getTime() > recentThreshold;
			}).length;
			
			return {
				territories,
				totalPerformers: allPerformers.length,
				activeRegistries,
				capabilities: Array.from(allCapabilities),
				lastUpdated: new Date().toISOString()
			};
			
		} catch (error) {
			Log.error(networkLogger, 'Failed to get network topology:', error);
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
			const allPerformers = this.registryAccess.getAllPerformers();
			
			const recentThreshold = Date.now() - (10 * 60 * 1000);
			const connectedPerformers = allPerformers.filter(performer => {
				if (!performer.lastSeen) {
					return false;
				}
				return new Date(performer.lastSeen).getTime() > recentThreshold;
			});
			
			return connectedPerformers.length;
			
		} catch (error) {
			Log.error(networkLogger, 'Failed to get connected performers count:', error);
			return 0;
		}
	}

	/**
	 * Get recent activity
	 */
	getRecentActivity(hours: number): NetworkActivity[] {
		try {
			const activities = [];
			const cutoffTime = Date.now() - (hours * 60 * 60 * 1000);
			
			const allPerformers = this.registryAccess.getAllPerformers();
			
			for (const performer of allPerformers) {
				if (performer.discoveredAt) {
					const discoveredTime = new Date(performer.discoveredAt).getTime();
					if (discoveredTime > cutoffTime) {
						activities.push({
							id: `discovery-${performer.performerId}`,
							timestamp: performer.discoveredAt,
							type: 'performer_discovery' as const,
							performerId: performer.performerId,
							territory: performer.territoryName,
							description: `Performer ${performer.performerId} discovered in ${performer.territoryName} territory`
						});
					}
				}
				
				if (performer.lastSeen) {
					const lastSeenTime = new Date(performer.lastSeen).getTime();
					if (lastSeenTime > cutoffTime) {
						activities.push({
							id: `heartbeat-${performer.performerId}-${lastSeenTime}`,
							timestamp: performer.lastSeen,
							type: 'performer_heartbeat' as const,
							performerId: performer.performerId,
							territory: performer.territoryName,
							description: `Heartbeat received from ${performer.territoryName} (${performer.capabilities.join(', ')})`
						});
					}
				}
			}
			
			const recentApiActivity = {
				id: `api-activity-${Date.now()}`,
				timestamp: new Date().toISOString(),
				type: 'api_request' as const,
				description: `External API activity: ${activities.length} network events in last ${hours}h`
			};
			activities.push(recentApiActivity);
			
			return activities
				.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
				.slice(0, 50);
			
		} catch (error) {
			Log.error(networkLogger, 'Failed to get recent activity:', error);
			return [];
		}
	}

	/**
	 * Generate analytics data
	 */
	generateAnalytics(metrics: string[]): AnalyticsData {
		try {
			
			const allPerformers = this.registryAccess.getAllPerformers();
			
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
			Log.error(networkLogger, 'Analytics generation failed:', error);
			return {};
		}
	}

	/**
	 * Generate activity analytics
	 */
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
			
			// Count performers per territory (regardless of activity status)
			byTerritory[performer.territoryName] = (byTerritory[performer.territoryName] || 0) + 1;
		}
		
		return {
			active,
			inactive,
			recentlyActive,
			byTerritory
		};
	}

	/**
	 * Generate capability analytics
	 */
	private generateCapabilityAnalytics(performers: RegistryEntry[]): CapabilityAnalytics {
		const distribution: CapabilityAnalytics = {};
		
		for (const performer of performers) {
			for (const capability of performer.capabilities ?? []) {
				distribution[capability] = (distribution[capability] ?? 0) + 1;
			}
		}
		
		return distribution;
	}

	/**
	 * Generate performance analytics
	 */
	private generatePerformanceAnalytics(performers: RegistryEntry[]): PerformanceAnalytics {
		const uptime = this.getUptimeMs();
		const territories = new Set(performers.map(n => n.territoryName));
		
		return {
			uptimeMs: uptime,
			uptimeHours: (uptime / (60 * 60 * 1000)).toFixed(2),
			averagePerformersPerTerritory: territories.size > 0
				? (performers.length / territories.size).toFixed(2)
				: '0',
			totalTerritories: territories.size
		};
	}

	/**
	 * Generate record analytics
	 */
	private generateRecordAnalytics(performers: RegistryEntry[]): RecordAnalytics {
		const byTerritory: Record<string, TerritoryAnalytics> = {};
		
		for (const performer of performers) {
			
			byTerritory[performer.territoryName] ??= {
				performerCount: 0,
				capabilities: [],
				lastSeen: null
			};
			
			byTerritory[performer.territoryName].performerCount++;
			
			// Merge capabilities
			const capSet = new Set([
				...byTerritory[performer.territoryName].capabilities,
				...performer.capabilities
			]);
			byTerritory[performer.territoryName].capabilities = Array.from(capSet);
			
			// Update last seen
			if (performer.lastSeen) {
				const currentLastSeen = byTerritory[performer.territoryName].lastSeen;
				if (!currentLastSeen || performer.lastSeen > currentLastSeen) {
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

	private parseTimeframe(timeframe: string): number {
		const match = timeframe.match(/(\d+)([dhms])/);
		if (!match) {
			return 7 * 24 * 60 * 60 * 1000;
		}
		
		const value = parseInt(match[1]);
		const unit = match[2];
		
		switch (unit) {
			case 'd': return value * 24 * 60 * 60 * 1000;
			case 'h': return value * 60 * 60 * 1000;
			case 'm': return value * 60 * 1000;
			case 's': return value * 1000;
			default: return 7 * 24 * 60 * 60 * 1000;
		}
	}

	cleanup(): void {
		// Cleanup if needed
	}
}