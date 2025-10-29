/**
 * ============================================================================
 * NODE CACHE
 * ============================================================================
 * 
 * Index of exports:
 * - CacheStatistics - statistics about the node cache
 * - NodeCacheEntry - structure for a cached node entry
 */

export interface CacheStatistics {
	totalNodes: number;
	hitRate: number;
	missRate: number;
	evictionCount: number;
	oldestEntry?: number;
	newestEntry?: number;
}

export interface NodeCacheEntry {
	node: import('./index').RegistryNode;
	addedAt: number;
	lastAccessed: number;
	accessCount: number;
	territory: string;
}