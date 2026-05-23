/**
 * ============================================================================
 * REGISTRY INTERNAL
 * ============================================================================
 * 
 * Index of exports:
 * - CachedPerformer - structure for a cached registry performer
 * - RegistryCache - structure for the registry cache
 * - RegistryEndpoint - structure for a registry endpoint
 */

export interface CachedPerformer {
	performer: import('./index').RegistryPerformer;
	cachedAt: number;
	expiresAt: number;
}

export interface RegistryCache {
	performers: Map<string, CachedPerformer>;
	lastRefresh: number;
	ttl: number;
}

export interface RegistryEndpoint {
	url: string;
	apiKey?: string;
	enabled: boolean;
	priority: number;
	lastChecked?: string;
	status: 'active' | 'inactive' | 'error';
}