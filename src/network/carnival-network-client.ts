// src/network/carnival-network-client.ts
import type { App } from 'obsidian';
import { HttpRegistryService } from './http-registry-service';
import { ActService } from './services/act-service';
import { CarnivalQueryService } from './services/carnival-query-service';
import { TerritoryAccessService } from './services/territory-access-service';
import { PersistentNodeCache } from './persistent-node-cache';
import { Log } from '../utils/logger';
import type {
	CarnivalNetworkClientInterface,
	TerritoryServiceInterface,
	QueryServiceInterface,
	ActServiceInterface,
	APIKeyStorage,
	CarnivalConfiguration,
	CarnivalRecord,
	ActQueryOptions,
	ActCountOptions,
	SearchOptions,
	SearchResult,
	TerritoryNode,
	PerformanceStatus,
	LogContext
} from '../types/public';

const clientLogger: LogContext = {
	context: 'Carnival Network Client',
	path: '/.obsidian/plugins/carnival-network/network/carnival-network-client'
};

/**
 * Main network client implementation
 * This is what consuming plugins interact with - their ticket to the carnival!
 */
export class CarnivalNetworkClient implements CarnivalNetworkClientInterface {
	private performing = false;
	private territoryService: HttpRegistryService;
	private actService: ActService;
	private queryService: CarnivalQueryService;
	private nodeCache: PersistentNodeCache;
	private territoryAccess: TerritoryAccessService;
	private currentNodeId: string | null = null;

	constructor(
		private readonly app: App,
		private config: CarnivalConfiguration,
		private readonly storage: APIKeyStorage,
		private readonly performerId: string
	) {
		Log.log(clientLogger, `🎭 Setting up stage for performer: ${performerId}`);

		// Initialize node cache (the program)
		this.nodeCache = new PersistentNodeCache(
			this.config.nodeCacheTTL,
			this.config.maxCachedNodes
		);

		// Initialize territory access service
		this.territoryAccess = new TerritoryAccessService(this.nodeCache);

		// Initialize territory service
		this.territoryService = new HttpRegistryService(
			this.storage,
			this.config,
			this.territoryAccess,
			this.nodeCache
		);

		// Initialize act service
		this.actService = new ActService(
			this.territoryAccess,
			this.config
		);

		// Initialize query service
		this.queryService = new CarnivalQueryService(
			this.territoryAccess,
			this.config
		);
	}

	/**
	 * ========================================================================
	 * LIFECYCLE METHODS (The Show Must Go On!)
	 * ========================================================================
	 */

	async enterRing(): Promise<void> {
		if (this.performing) {
			Log.warn(clientLogger, `🎭 Already performing: ${this.performerId}`);
			return;
		}

		try {
			Log.log(clientLogger, `🎪 ${this.performerId} is entering the ring...`);

			// Initialize territory service
			await this.territoryService.initialize();

			// Load cached nodes (the program)
			await this.nodeCache.loadFromStorage(this.app);

			// Generate node ID for this performance
			this.currentNodeId = this.generateNodeId();

			this.performing = true;
			Log.log(clientLogger, `🎉 ${this.performerId} has entered the ring! The show begins!`);
		} catch (error) {
			Log.error(clientLogger, '🎪 Failed to enter the ring:', error);
			throw error;
		}
	}

	async leaveRing(): Promise<void> {
		if (!this.performing) {
			return;
		}

		try {
			Log.log(clientLogger, `🎭 ${this.performerId} is taking a bow...`);

			// Deregister from territories if we have a node ID
			if (this.currentNodeId) {
				try {
					await this.territoryService.deregisterNode(this.currentNodeId);
				} catch (error) {
					Log.warn(clientLogger, 'Failed to deregister node during cleanup:', error);
				}
			}

			// Save cache before cleanup (preserve the program)
			await this.nodeCache.saveToStorage(this.app);

			// Cleanup services
			this.territoryService.cleanup();
			this.actService.cleanup();

			this.performing = false;
			this.currentNodeId = null;

			Log.log(clientLogger, `👋 ${this.performerId} has left the ring. Until next time!`);
		} catch (error) {
			Log.error(clientLogger, '🎪 Error during finale:', error);
		}
	}

	isPerforming(): boolean {
		return this.performing;
	}

	/**
	 * ========================================================================
	 * TERRITORY MANAGEMENT (Setting Up Tents)
	 * ========================================================================
	 */

	async establishTerritory(territory: string): Promise<void> {
		this.ensurePerforming();
		
		if (!this.currentNodeId) {
			this.currentNodeId = this.generateNodeId();
		}

		const nodeInfo = {
			nodeId: this.currentNodeId,
			territoryName: territory,
			endpoint: this.getLocalEndpoint(),
			capabilities: this.getNodeCapabilities(),
			metadata: {
				performerId: this.performerId,
				vaultName: this.app.vault.getName(),
				establishedAt: new Date().toISOString()
			}
		};

		await this.territoryService.registerNode(territory, nodeInfo);
		Log.log(clientLogger, `🎪 Territory established: ${territory} (node: ${this.currentNodeId})`);
	}

	async scoutTerritories(territory: string): Promise<TerritoryNode[]> {
		this.ensurePerforming();
		
		const nodes = await this.territoryService.discoverNodes(territory);
		Log.log(clientLogger, `🔍 Scouted ${nodes.length} nodes in ${territory}`);
		
		return nodes;
	}

	async updatePerformanceStatus(status: Partial<PerformanceStatus>): Promise<void> {
		this.ensurePerforming();
		
		const nodeId = status.nodeId || this.currentNodeId;
		if (!nodeId) {
			Log.warn(clientLogger, 'Cannot update status: no node ID available');
			return;
		}

		await this.territoryService.updateHeartbeat(nodeId);
		Log.log(clientLogger, `💓 Heartbeat sent for node: ${nodeId}`);
	}

	/**
	 * ========================================================================
	 * ACT OPERATIONS (The Performances)
	 * ========================================================================
	 */

	async broadcastAct(record: CarnivalRecord): Promise<void> {
		this.ensurePerforming();
		
		// Enrich record with performer metadata if not present
		if (!record.metadata.performerId) {
			record.metadata.performerId = this.performerId;
		}
		if (!record.metadata.nodeId && this.currentNodeId) {
			record.metadata.nodeId = this.currentNodeId;
		}

		await this.actService.broadcastAct(record);
		Log.log(clientLogger, `📢 Act broadcast: "${record.title}" (${record.id})`);
	}

	queryActs(options: ActQueryOptions): CarnivalRecord[] {
		this.ensurePerforming();
		
		const acts = this.actService.queryActs(options);
		Log.log(clientLogger, `🎭 Queried ${acts.length} acts from network`);
		
		return acts;
	}

	countActs(options: ActCountOptions): number {
		this.ensurePerforming();
		
		const count = this.actService.countActs(options);
		Log.log(clientLogger, `🔢 Counted ${count} acts matching criteria`);
		
		return count;
	}

	searchCarnival(options: SearchOptions): SearchResult[] {
		this.ensurePerforming();
		
		const results = this.actService.performSearch(options);
		Log.log(clientLogger, `🔍 Search returned ${results.length} results for "${options.query}"`);
		
		return results;
	}

	/**
	 * ========================================================================
	 * BACKSTAGE ACCESS (Service Access)
	 * ========================================================================
	 */

	getTerritoryService(): TerritoryServiceInterface {
		this.ensurePerforming();
		return this.territoryService;
	}

	getQueryService(): QueryServiceInterface {
		this.ensurePerforming();
		return this.queryService;
	}

	getActService(): ActServiceInterface {
		this.ensurePerforming();
		return this.actService;
	}

	/**
	 * ========================================================================
	 * SHOW CONFIGURATION
	 * ========================================================================
	 */

	getShowConfiguration(): CarnivalConfiguration {
		return { ...this.config };
	}

	updateShowConfiguration(config: Partial<CarnivalConfiguration>): void {
		this.config = {
			...this.config,
			...config
		};
		Log.log(clientLogger, `⚙️ Show configuration updated for: ${this.performerId}`);
	}

	/**
	 * ========================================================================
	 * PUBLIC UTILITY METHODS
	 * ========================================================================
	 */

	/**
	 * Get the current node ID for this performer
	 */
	getNodeId(): string | null {
		return this.currentNodeId;
	}

	/**
	 * Get the performer ID
	 */
	getPerformerId(): string {
		return this.performerId;
	}

	/**
	 * Get statistics about the current performance
	 */
	getPerformanceStats(): {
		isPerforming: boolean;
		nodeId: string | null;
		performerId: string;
		cachedNodes: number;
		territories: string[];
	} {
		const allNodes = this.territoryAccess.getAllNodes();
		const territories = [...new Set(allNodes.map(node => node.territoryName))];

		return {
			isPerforming: this.performing,
			nodeId: this.currentNodeId,
			performerId: this.performerId,
			cachedNodes: allNodes.length,
			territories
		};
	}

	/**
	 * ========================================================================
	 * PRIVATE HELPERS (Behind the Curtain)
	 * ========================================================================
	 */

	private ensurePerforming(): void {
		if (!this.performing) {
			throw new Error(
				`🎪 ${this.performerId} hasn't entered the ring yet! ` +
				'Call enterRing() first to start performing.'
			);
		}
	}

	private generateNodeId(): string {
		const vaultName = this.app.vault.getName();
		const sanitizedVault = vaultName.replace(/[^a-zA-Z0-9-]/g, '-').toLowerCase();
		const sanitizedPerformer = this.performerId.replace(/[^a-zA-Z0-9-]/g, '-').toLowerCase();
		const timestamp = Date.now().toString(36);
		const random = Math.random().toString(36).substring(2, 7);
		
		return `${sanitizedPerformer}-${sanitizedVault}-${timestamp}-${random}`;
	}

	private getLocalEndpoint(): string {
		// Try to get the Local REST API plugin endpoint
		const localRestApi = (this.app as any).plugins?.plugins?.['obsidian-local-rest-api'];
		
		if (localRestApi && typeof localRestApi.getEndpoint === 'function') {
			return localRestApi.getEndpoint();
		}

		// Default fallback endpoint
		return 'http://localhost:27124';
	}

	private getNodeCapabilities(): string[] {
		// Return capabilities based on performer configuration
		const capabilities = [
			'act_sync',
			'territory_discovery',
			'heartbeat'
		];

		// Add optional capabilities based on config
		if (this.config.webhookConfig?.enabled) {
			capabilities.push('webhook_notifications');
		}

		// Could add more based on performer-specific needs
		// For now, return a standard set
		return capabilities;
	}
}