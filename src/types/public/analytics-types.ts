/**
 * ============================================================================
 * CARNIVAL ANALYTICS (Observing the Show)
 * ============================================================================
 * 
 * Index of exports:
 * - ActivityAnalytics - Activity-based analytics
 * - AnalyticsData - Aggregated analytics data container
 * - AnalyticsQueryParams - Analytics query parameters
 * - AnalyticsResponse - Analytics response structure
 * - CapabilityAnalytics - Capability distribution analytics
 * - CarnivalActivity - Individual activity event
 * - CarnivalTopology - Network topology snapshot
 * - PerformanceAnalytics - Performance metrics analytics
 * - RecordAnalytics - Record/Act analytics
 * - TerritoryAnalytics - Territory-specific analytics
 */

/**
 * Activity analytics - breakdown of network activity
 */
export interface ActivityAnalytics {
	active: number;           // Active performers (last hour)
	inactive: number;         // Inactive performers
	recentlyActive: number;   // Recently active (last 10 minutes)
	byTerritory: Record<string, number>; // Activity count per territory
}

/**
 * Aggregated analytics data container
 * Contains optional analytics modules based on what was requested
 */
export interface AnalyticsData {
	records?: RecordAnalytics;
	activity?: ActivityAnalytics;
	capabilities?: CapabilityAnalytics;
	performance?: PerformanceAnalytics;
	timeframe?: string;
}

/**
 * Analytics query parameters
 */
export interface AnalyticsQueryParams {
	timeframe?: string;  // e.g., '7d', '30d', '24h'
	metrics?: Array<'records' | 'activity' | 'capabilities' | 'performance'>;
	territories?: string[];
}

/**
 * Analytics response structure
 */
export interface AnalyticsResponse {
	timeframe: string;
	data: AnalyticsData;
	generated: string;
}

/**
 * Capability analytics - distribution of capabilities across performers
 */
export type CapabilityAnalytics = Record<string, number>; // capability → count

/**
 * Carnival activity event - tracks individual network events
 */
export interface CarnivalActivity {
	id: string;
	timestamp: string;
	type: 'performer_discovery' | 'performer_heartbeat' | 'act_broadcast' | 'territory_established' | 'api_request';
	performerId?: string;
	territory?: string;
	description: string;
	metadata?: Record<string, unknown>;
}

/**
 * Network status and health snapshot
 * Combines topology and performance metrics for system monitoring
 */
export interface CarnivalStatus {
	health: string;
	uptime: {
		milliseconds: number;
		formatted: string;
	};
	network: {
		totalPerformers: number;
		connectedPerformers: number;
		territories: number;
		activeRegistries: number;
	};
	capabilities: string[];
}

/**
 * Carnival topology - snapshot of the network structure
 */
export interface CarnivalTopology {
	territories: Record<string, number>; // territory name → performer count
	totalPerformers: number;
	activeRegistries: number;
	capabilities: string[];
	lastUpdated: string;
}

/**
 * Performance analytics - system-wide performance metrics
 */
export interface PerformanceAnalytics {
	uptimeMs: number;
	uptimeHours: string;
	averagePerformersPerTerritory: string;
	totalTerritories: number;
}

/**
 * Record/Act analytics - breakdown by type and territory
 */
export interface RecordAnalytics {
	total: number;
	byTerritory: Record<string, TerritoryAnalytics>;
	byType: {
		changelog: number;
		conversation: number;
	};
}

/**
 * Territory-specific analytics
 */
export interface TerritoryAnalytics {
	performerCount: number;
	capabilities: string[];
	lastSeen: string | null;
}