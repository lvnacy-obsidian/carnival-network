/**
 * ============================================================================
 * TERRITORIES & NODES (The Carnival Grounds)
 * ============================================================================
 * 
 * Index of exports:
 * - PerformanceStatus - Performance status information
 * - TerritoryNode - Territory node information
 * - TerritoryNodeInfo - Territory node registration information
 */

/**
 * Performance status information
 */
export interface PerformanceStatus {
	nodeId: string;
	status: 'performing' | 'intermission' | 'finale'; // online | offline | degraded
	lastHeartbeat: string;
	uptime?: number;
	activeConnections?: number;
	metadata?: Record<string, unknown>;
}

/**
 * Territory node information
 */
export interface TerritoryNode {
	nodeId: string;
	territoryName: string;
	endpoint: string;
	capabilities: string[];
	lastSeen?: string;
	discoveredAt?: string;
	metadata?: Record<string, unknown>;
}

/**
 * Territory node registration information
 */
export interface TerritoryNodeInfo {
	nodeId: string;
	territoryName: string;
	endpoint: string;
	capabilities: string[];
	metadata?: Record<string, unknown>;
}