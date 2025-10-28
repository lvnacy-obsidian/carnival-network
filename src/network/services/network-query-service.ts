// services/network-query-service.ts
import { Log } from '../../utils/logger';
import { RegistryAccessService } from './registry-access-service';
import type {
	ActivityAnalytics,
	AnalyticsData,
	CapabilityAnalytics,
	NetworkActivity,
	NetworkTopology,
	PerformanceAnalytics,
	RecordAnalytics,
	RegistryNode,
	TerritoryAnalytics
} from '../../types';

const networkLogger = {
	context: 'Network Query Service',
	path: '/.obsidian/plugins/carnival-records/network/services/network-query-service'
};

/**
 * Handles network topology and status queries
 */
export class NetworkQueryService {
	constructor(
		private readonly registryAccess: RegistryAccessService,
		private readonly startTime: number
	) {}

	/**
	 * Get network topology
	 */
	getNetworkTopology(): NetworkTopology {
		try {
			const allNodes = this.registryAccess.getAllNodes();
			
			const territories: Record<string, number> = {};
			const allCapabilities = new Set<string>();
			
			for (const node of allNodes) {
				territories[node.territoryName] = (territories[node.territoryName] || 0) + 1;
				
				if (node.capabilities) {
					node.capabilities.forEach(cap => allCapabilities.add(cap));
				}
			}
			
			const recentThreshold = Date.now() - (5 * 60 * 1000);
			const activeRegistries = allNodes.filter(node => {
				if (!node.lastSeen) {
					return false;
				}
				return new Date(node.lastSeen).getTime() > recentThreshold;
			}).length;
			
			return {
				territories,
				totalNodes: allNodes.length,
				activeRegistries,
				capabilities: Array.from(allCapabilities),
				lastUpdated: new Date().toISOString()
			};
			
		} catch (error) {
			Log.error(networkLogger, 'Failed to get network topology:', error);
			return {
				territories: {},
				totalNodes: 0,
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
	 * Get count of connected nodes
	 */
	getConnectedNodesCount(): number {
		try {
			const allNodes = this.registryAccess.getAllNodes();
			
			const recentThreshold = Date.now() - (10 * 60 * 1000);
			const connectedNodes = allNodes.filter(node => {
				if (!node.lastSeen) {
					return false;
				}
				return new Date(node.lastSeen).getTime() > recentThreshold;
			});
			
			return connectedNodes.length;
			
		} catch (error) {
			Log.error(networkLogger, 'Failed to get connected nodes count:', error);
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
			
			const allNodes = this.registryAccess.getAllNodes();
			
			for (const node of allNodes) {
				if (node.discoveredAt) {
					const discoveredTime = new Date(node.discoveredAt).getTime();
					if (discoveredTime > cutoffTime) {
						activities.push({
							id: `discovery-${node.nodeId}`,
							timestamp: node.discoveredAt,
							type: 'node_discovery' as const,
							nodeId: node.nodeId,
							territory: node.territoryName,
							description: `Node ${node.nodeId} discovered in ${node.territoryName} territory`
						});
					}
				}
				
				if (node.lastSeen) {
					const lastSeenTime = new Date(node.lastSeen).getTime();
					if (lastSeenTime > cutoffTime) {
						activities.push({
							id: `heartbeat-${node.nodeId}-${lastSeenTime}`,
							timestamp: node.lastSeen,
							type: 'node_heartbeat' as const,
							nodeId: node.nodeId,
							territory: node.territoryName,
							description: `Heartbeat received from ${node.territoryName} (${node.capabilities.join(', ')})`
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
			
			const allNodes = this.registryAccess.getAllNodes();
			
			const analytics: AnalyticsData = {};
			
			if (metrics.includes('records')) {
				analytics.records = this.generateRecordAnalytics(allNodes);
			}
			
			if (metrics.includes('activity')) {
				analytics.activity = this.generateActivityAnalytics(allNodes);
			}
			
			if (metrics.includes('capabilities')) {
				analytics.capabilities = this.generateCapabilityAnalytics(allNodes);
			}
			
			if (metrics.includes('performance')) {
				analytics.performance = this.generatePerformanceAnalytics(allNodes);
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
	private generateActivityAnalytics(nodes: RegistryNode[]): ActivityAnalytics {
		const now = Date.now();
		const recentThreshold = now - (10 * 60 * 1000); // 10 minutes
		const activeThreshold = now - (60 * 60 * 1000); // 1 hour
		
		let active = 0;
		let inactive = 0;
		let recentlyActive = 0;
		const byTerritory: Record<string, number> = {};
		
		for (const node of nodes) {
			if (!node.lastSeen) {
				inactive++;
				continue;
			}
			
			const lastSeenTime = new Date(node.lastSeen).getTime();
			
			if (lastSeenTime > activeThreshold) {
				active++;
				if (lastSeenTime > recentThreshold) {
					recentlyActive++;
				}
			} else {
				inactive++;
			}
			
			// Count nodes per territory (regardless of activity status)
			byTerritory[node.territoryName] = (byTerritory[node.territoryName] || 0) + 1;
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
	private generateCapabilityAnalytics(nodes: RegistryNode[]): CapabilityAnalytics {
		const distribution: CapabilityAnalytics = {};
		
		for (const node of nodes) {
			for (const capability of node.capabilities ?? []) {
				distribution[capability] = (distribution[capability] ?? 0) + 1;
			}
		}
		
		return distribution;
	}

	/**
	 * Generate performance analytics
	 */
	private generatePerformanceAnalytics(nodes: RegistryNode[]): PerformanceAnalytics {
		const uptime = this.getUptimeMs();
		const territories = new Set(nodes.map(n => n.territoryName));
		
		return {
			uptimeMs: uptime,
			uptimeHours: (uptime / (60 * 60 * 1000)).toFixed(2),
			averageNodesPerTerritory: territories.size > 0
				? (nodes.length / territories.size).toFixed(2)
				: '0',
			totalTerritories: territories.size
		};
	}

	/**
	 * Generate record analytics
	 */
	private generateRecordAnalytics(nodes: RegistryNode[]): RecordAnalytics {
		const byTerritory: Record<string, TerritoryAnalytics> = {};
		
		for (const node of nodes) {
			
			byTerritory[node.territoryName] ??= {
				nodeCount: 0,
				capabilities: [],
				lastSeen: null
			};
			
			byTerritory[node.territoryName].nodeCount++;
			
			// Merge capabilities
			const capSet = new Set([
				...byTerritory[node.territoryName].capabilities,
				...node.capabilities
			]);
			byTerritory[node.territoryName].capabilities = Array.from(capSet);
			
			// Update last seen
			if (node.lastSeen) {
				const currentLastSeen = byTerritory[node.territoryName].lastSeen;
				if (!currentLastSeen || node.lastSeen > currentLastSeen) {
					byTerritory[node.territoryName].lastSeen = node.lastSeen;
				}
			}
		}
		
		return {
			total: nodes.length,
			byTerritory,
			byType: {
				changelog: Math.ceil(nodes.length * 0.6),
				conversation: Math.ceil(nodes.length * 0.4)
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