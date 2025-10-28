// services/registry-access-service.ts
import { App } from 'obsidian';
import { Log } from '../../utils/logger';
import type {
	LogContext,
	ObsidianAppWithPlugins,
	RegistryNode,
	RegistryService
} from '../../types';

const registryLogger: LogContext = {
	context: 'Registry Access Service',
	path: '/.obsidian/plugins/carnival-records/network/services/registry-access'
};

/**
 * Provides centralized access to the HTTP Registry Service
 * Handles fallback when registry is unavailable
 */
export class RegistryAccessService {
	private cachedRegistryService?: RegistryService | undefined;
	private lastAccessAttempt = 0;
	private readonly cacheValidityMs = 1000; // Re-check every second

	constructor(private readonly app: App) {}

	/**
	 * Get the registry service instance
	 * Caches the reference briefly to avoid repeated lookups
	 */
	getRegistryService(): RegistryService {
		const now = Date.now();
		
		// Use cached reference if still valid
		if (this.cachedRegistryService && 
			now - this.lastAccessAttempt < this.cacheValidityMs) {
			return this.cachedRegistryService;
		}
		
		this.lastAccessAttempt = now;
		
		try {
			const carnivalNetwork = (this.app as ObsidianAppWithPlugins).plugins?.plugins?.['carnival-records']?.carnivalNetwork;
			
			if (carnivalNetwork?.httpRegistryService) {
				this.cachedRegistryService = carnivalNetwork.httpRegistryService;
				return this.cachedRegistryService;
			}
			
			// Registry not available - return empty implementation
			Log.warn(registryLogger, 'Registry service not available, using empty fallback');
			return this.getEmptyRegistryService();
			
		} catch (error) {
			Log.error(registryLogger, 'Failed to access registry service:', error);
			return this.getEmptyRegistryService();
		}
	}

	/**
	 * Get all nodes from registry
	 */
	getAllNodes(): RegistryNode[] {
		try {
			const registry = this.getRegistryService();
			return registry.nodeCache.getAll();
		} catch (error) {
			Log.error(registryLogger, 'Failed to get all nodes:', error);
			return [];
		}
	}

	/**
	 * Get a specific node by ID
	 */
	getNode(nodeId: string): RegistryNode | null {
		try {
			const registry = this.getRegistryService();
			return registry.nodeCache.get(nodeId);
		} catch (error) {
			Log.error(registryLogger, `Failed to get node ${nodeId}:`, error);
			return null;
		}
	}

	/**
	 * Get nodes filtered by territory
	 */
	getNodesByTerritory(territory: string): RegistryNode[] {
		try {
			const allNodes = this.getAllNodes();
			return allNodes.filter(node => node.territoryName === territory);
		} catch (error) {
			Log.error(registryLogger, `Failed to get nodes for territory ${territory}:`, error);
			return [];
		}
	}

	/**
	 * Get nodes filtered by capability
	 */
	getNodesByCapability(capability: string): RegistryNode[] {
		try {
			const allNodes = this.getAllNodes();
			return allNodes.filter(node => node.capabilities.includes(capability));
		} catch (error) {
			Log.error(registryLogger, `Failed to get nodes with capability ${capability}:`, error);
			return [];
		}
	}

	/**
	 * Get count of all nodes
	 */
	getNodeCount(): number {
		try {
			const registry = this.getRegistryService();
			return registry.nodeCache.size();
		} catch (error) {
			Log.error(registryLogger, 'Failed to get node count:', error);
			return 0;
		}
	}

	/**
	 * Check if registry service is available
	 */
	isAvailable(): boolean {
		try {
			const carnivalNetwork = (this.app as ObsidianAppWithPlugins).plugins?.plugins?.['carnival-records']?.carnivalNetwork;
			return Boolean(carnivalNetwork?.httpRegistryService);
		} catch (error) {
			Log.error(registryLogger, 'Failed to check registry availability:', error);
			return false;
		}
	}

	/**
	 * Clear cached registry reference (useful for testing or plugin reload)
	 */
	clearCache(): void {
		this.cachedRegistryService = undefined;
		this.lastAccessAttempt = 0;
	}

	/**
	 * Get empty registry service for fallback
	 */
	private getEmptyRegistryService(): RegistryService {
		return {
			nodeCache: {
				getAll: () => [],
				get: () => null,
				size: () => 0
			}
		};
	}
}