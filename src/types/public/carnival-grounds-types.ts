/**
 * ============================================================================
 * TERRITORIES & NODES (The Carnival Grounds)
 * ============================================================================
 * 
 * Index of exports:
 * - PerformerRegistrationInfo - Territory performer registration information
 * - RegistryEntry - Lightweight territory performer entry
 * - Territory - Territory information
 * - TerritoryDiscoveryOptions - Options for discovering territories
 */

/**
 * Territory performer registration information
 * Used when a performer registers itself with a territory
 */
export interface PerformerRegistrationInfo {
	/** Unique performer identifier */
	performerId: string;
	/** Territory name */
	territoryName: string;
	/** API endpoint */
	endpoint: string;
	/** Supported capabilities */
	capabilities: string[];
	/** Optional metadata */
	metadata?: Record<string, unknown>;
}

/**
 * Lightweight territory performer entry
 * This is the minimal information stored in the registry for discovering performers
 */
export interface RegistryEntry {
	/** Unique performer identifier */
	performerId: string;
	/** Territory name where this performer resides */
	territoryName: string;
	/** API endpoint for communication */
	endpoint: string;
	/** Capabilities supported by this performer */
	capabilities: string[];
	/** Last time this performer was seen */
	lastSeen?: string;
	/** When this performer was discovered */
	discoveredAt?: string;
	/** Optional metadata */
	metadata?: Record<string, unknown>;
}

/**
 * Territory information
 * Describes a carnival territory (region/area)
 */
export interface Territory {
	/** Territory name (e.g., 'backstage', 'necropolis') */
	name: string;
	/** Territory description */
	description?: string;
	/** Number of active performers in this territory */
	performerCount: number;
	/** Territory status */
	status: 'active' | 'inactive' | 'establishing';
	/** When this territory was established */
	establishedAt?: string;
	/** Last activity in this territory */
	lastActivity?: string;
	/** Territory metadata */
	metadata?: Record<string, unknown>;
}

/**
 * Territory discovery options
 */
export interface TerritoryDiscoveryOptions {
	/** Include inactive territories */
	includeInactive?: boolean;
	/** Maximum territories to discover */
	limit?: number;
	/** Discovery timeout (milliseconds) */
	timeout?: number;
	/** Filter by territory name pattern */
	namePattern?: string;
}