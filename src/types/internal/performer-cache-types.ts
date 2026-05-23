/**
 * ============================================================================
 * NODE CACHE
 * ============================================================================
 * 
 * Index of exports:
 * - CacheStatistics - statistics about the performer cache
 */

export interface CacheStatistics {
	totalPerformers: number;
	hitRate: number;
	missRate: number;
	evictionCount: number;
	oldestEntry?: number;
	newestEntry?: number;
}