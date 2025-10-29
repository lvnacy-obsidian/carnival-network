/**
 * ============================================================================
 * REGISTRY INTERNAL
 * ============================================================================
 * 
 * Index of exports:
 * - CachedNode - structure for a cached registry node
 * - RegistryCache - structure for the registry cache
 * - RegistryEndpoint - structure for a registry endpoint
 */

export interface CachedNode {
	node: import('./index').RegistryNode;
	cachedAt: number;
	expiresAt: number;
}

export interface RegistryCache {
	nodes: Map<string, CachedNode>;
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