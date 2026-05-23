/**
 * ============================================================================
 * CARNIVAL PERFORMER - Individual Network Participant
 * ============================================================================
 * 
 * The CarnivalPerformer is the main implementation of the network client that
 * consuming plugins interact with. Each performer represents a single vault/plugin
 * instance participating in the Carnival Network.
 * 
 * Architecture:
 * - One CarnivalPerformer instance = One performer (plugin) in the network
 * - The collection of all performers = The troupe (managed by carnival-troupe-manager)
 * - Each performer has independent service instances and state
 * 
 * Core Responsibilities:
 * - Lifecycle management (enter/leave the ring)
 * - Territory establishment and discovery
 * - Act broadcasting and querying
 * - Search operations across the carnival
 * - Performance status tracking
 * 
 * Exports:
 * - CarnivalPerformer (class) - Main network client implementation
 * 
 * Public API Methods:
 * 
 * Lifecycle:
 * - enterRing(): Promise<void> - Initialize performer and join network
 * - leaveRing(): Promise<void> - Cleanup and exit gracefully
 * - isPerforming(): boolean - Check if performer is active
 * 
 * Territory Operations:
 * - establishTerritory(territory: string): Promise<void> - Register at territory
 * - scoutTerritories(territory: string): Promise<RegistryEntry[]> - Discover performers
 * - updatePerformanceStatus(status: Partial<PerformanceStatus>): Promise<void> - Send heartbeat
 * 
 * Act Operations:
 * - broadcastAct(act: CarnivalAct): Promise<void> - Broadcast act to network
 * - queryActs(options: ActQueryOptions): Promise<CarnivalAct[]> - Query acts with filters
 * - countActs(options: ActCountOptions): Promise<number> - Count matching acts
 * - searchCarnival(options: SearchOptions): Promise<SearchResult[]> - Full-text search
 * 
 * Service Access (Advanced):
 * - getTerritoryService(): TerritoryServiceInterface - Direct territory access
 * - getQueryService(): QueryServiceInterface - Direct query access
 * - getActService(): ActServiceInterface - Direct act access
 * 
 * Configuration:
 * - getShowConfiguration(): CarnivalConfig - Get current config
 * - updateShowConfiguration(config: Partial<CarnivalConfig>): void - Update config
 * 
 * Utilities:
 * - getPerformerId(): string - Get performer identifier
 * - getPerformanceStats(): object - Get performance statistics
 * 
 * Implementation Details:
 * - Implements: CarnivalPerformerInterface (from carnival-performer-types.ts)
 * - Used by: CarnivalNetworkPlugin.joinCarnival() (in main.ts)
 * - Created by: carnival-troupe-manager.joinCarnival()
 * - Managed in: CarnivalNetworkPlugin.activePerformers Map
 * 
 * Dependencies:
 * - HttpRegistryService - Territory registration and discovery
 * - ActService - Act creation, broadcasting, and querying
 * - CarnivalQueryService - Network analytics and intelligence
 * - PerformerAccessService - Read-only performer cache access
 * - PersistentPerformerCache - LRU cache of known performers
 * 
 * @see carnival-performer-types.ts - Type definitions
 * @see carnival-troupe-manager.ts - Collection management
 * @see main.ts - Plugin lifecycle integration
 */

import type { App } from 'obsidian';
import { ActService } from '../services/act-service';
import { CarnivalQueryService } from '../services/carnival-query-service';
import { CarnivalRegistryService } from '../registry/carnival-registry-service';
import { EndpointHealthMonitor } from '../registry/endpoint-health-monitor';
import { PerformerAccessService } from './performer-access-service';
import { PersistentPerformerCache } from './persistent-performer-cache';
import { Log } from '../../utils/logger';
import { getPlugin } from '../../utils/plugin-utils';
import type {
	LocalRestAPIPlugin,
	ActCountOptions,
	ActQueryOptions,
	CarnivalAct,
	CarnivalConfig,
	CarnivalPerformerInterface,
	LogContext,
	PerformanceStatus,
	RegistryEntry,
	SearchOptions,
	SearchResult
} from '../../types/public';

/**
 * Main network client implementation
 * This is what consuming plugins interact with - their ticket to the carnival!
 */
export class CarnivalPerformer implements CarnivalPerformerInterface {
	private actService: ActService;
	private clientLogger: LogContext;
	private currentPerformerId: string | null = null;
	private performerCache: PersistentPerformerCache;
	private performing = false;
	private queryService: CarnivalQueryService;
	private registryService: CarnivalRegistryService;
	private territoryAccess: PerformerAccessService;

	constructor(
		private readonly app: App,
		private config: CarnivalConfig,
		private readonly endpointMonitor: EndpointHealthMonitor,
		private readonly performerId: string
	) {
		this.clientLogger = {
			context: 'Carnival Performer',
			path: `${ app.vault.configDir }/plugins/carnival-network/network/carnival-network-client`
		};

		Log.log(this.clientLogger, `🎭 Setting up stage for performer: ${performerId}`);

		// Initialize performer cache (the program)
		this.performerCache = new PersistentPerformerCache(
			this.app,
			{
				maxSize: this.config.maxCachedPerformers ?? 1000,
				defaultTtlMs: this.config.performerCacheTTL ?? (30 * 60 * 1000),
				persistenceEnabled: true,
				persistenceKey: 'carnival-performer-cache',
				backgroundSaveIntervalMs: 5 * 60 * 1000,
				compressionEnabled: true
			}
		);

		// Initialize territory access service
		this.territoryAccess = new PerformerAccessService(this.app.vault, this.performerCache);

		// Initialize territory service
		this.registryService = new CarnivalRegistryService(
			this.app,
			this.endpointMonitor,
			this.performerCache
		);

		// Initialize act service
		this.actService = new ActService(
			this.territoryAccess,
			this.config
		);

		// Initialize query service
		this.queryService = new CarnivalQueryService(
			this.app.vault,
			this.territoryAccess,
			Date.now()
		);
	}

	/**
	 * ========================================================================
	 * LIFECYCLE METHODS (The Show Must Go On!)
	 * ========================================================================
	 */

	async enterRing(): Promise<void> {
		if (this.performing) {
			Log.warn(this.clientLogger, `🎭 Already performing: ${this.performerId}`);
			return;
		}

		try {
			Log.log(this.clientLogger, `🎪 ${this.performerId} is entering the ring...`);

			// Load cached performers (the program)
			await this.performerCache.loadFromStorage(this.app);

			// Generate performer ID for this performance
			this.currentPerformerId = this.generatePerformerId();

			this.performing = true;
			Log.log(this.clientLogger, `🎉 ${this.performerId} has entered the ring! The show begins!`);
		} catch (error) {
			Log.error(this.clientLogger, '🎪 Failed to enter the ring:', error);
			throw error;
		}
	}

	async leaveRing(): Promise<void> {
		if (!this.performing) {
			return;
		}

		try {
			Log.log(this.clientLogger, `🎭 ${this.performerId} is taking a bow...`);

			// Save cache before cleanup (preserve the program)
			await this.performerCache.saveToStorage(this.app);

			// Cleanup services
			this.registryService.cleanup();
			this.actService.cleanup();

			this.performing = false;
			this.currentPerformerId = null;

			Log.log(this.clientLogger, `👋 ${this.performerId} has left the ring. Until next time!`);
		} catch (error) {
			Log.error(this.clientLogger, '🎪 Error during finale:', error);
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
		
		this.currentPerformerId ??= this.generatePerformerId();

		const performerInfo = {
			performerId: this.currentPerformerId,
			territoryName: territory,
			endpoint: this.getLocalEndpoint(),
			capabilities: this.getPerformerCapabilities(),
			metadata: {
				performerId: this.performerId,
				vaultName: this.app.vault.getName(),
				establishedAt: new Date().toISOString()
			}
		};

		await this.registryService.establishTerritory(territory, performerInfo);
		Log.log(this.clientLogger, `🎪 Territory established: ${territory} (performer: ${this.currentPerformerId})`);
	}

	async scoutTerritories(territory: string): Promise<RegistryEntry[]> {
		this.ensurePerforming();
		
		const performers = await this.registryService.scoutTerritories(territory);
		Log.log(this.clientLogger, `🔍 Scouted ${performers.length} performers in ${territory}`);
		
		return performers;
	}

	async updatePerformanceStatus(status: Partial<PerformanceStatus>): Promise<void> {
		this.ensurePerforming();
		
		const performerId = status.performerId ?? this.currentPerformerId;
		if (!performerId) {
			Log.warn(this.clientLogger, 'Cannot update status: no performer ID available');
			return;
		}

		await this.registryService.sendHeartbeat();
		Log.log(this.clientLogger, `💓 Heartbeat sent for performer: ${performerId}`);
	}

	/**
	 * ========================================================================
	 * ACT OPERATIONS (The Performances)
	 * ========================================================================
	 */

	async broadcastAct(act: CarnivalAct): Promise<void> {
		this.ensurePerforming();
		
		// Enrich record with performer metadata if not present
		act.metadata.performerId ??= this.performerId;
		if (!act.metadata.performerId && this.currentPerformerId) {
			act.metadata.performerId = this.currentPerformerId;
		}

		await this.actService.broadcastAct(act);
		Log.log(this.clientLogger, `📢 Act broadcast: "${act.title}" (${act.id})`);
	}

	async queryActs(options: ActQueryOptions): Promise<CarnivalAct[]> {
		this.ensurePerforming();
		
		const acts = await this.actService.queryActs(options);
		Log.log(this.clientLogger, `🎭 Queried ${acts.length} acts from network`);
		
		return acts;
	}

	async countActs(options: ActCountOptions): Promise<number> {
		this.ensurePerforming();
		
		const count = await this.actService.countActs(options);
		Log.log(this.clientLogger, `🔢 Counted ${count} acts matching criteria`);
		
		return count;
	}

	async searchCarnival(options: SearchOptions): Promise<SearchResult[]> {
		this.ensurePerforming();
		
		const results = await this.actService.performSearch(options);
		Log.log(this.clientLogger, `🔍 Search returned ${results.length} results for "${options.query}"`);
		
		return results;
	}

	/**
	 * ========================================================================
	 * BACKSTAGE ACCESS (Service Access)
	 * ========================================================================
	 */

	getActService(): ActService {
		this.ensurePerforming();
		return this.actService;
	}

	getQueryService(): CarnivalQueryService {
		this.ensurePerforming();
		return this.queryService;
	}

	getTerritoryService(): CarnivalRegistryService {
		this.ensurePerforming();
		return this.registryService;
	}

	/**
	 * ========================================================================
	 * SHOW CONFIGURATION
	 * ========================================================================
	 */

	getShowConfiguration(): CarnivalConfig {
		return { ...this.config };
	}

	updateShowConfiguration(config: Partial<CarnivalConfig>): void {
		this.config = {
			...this.config,
			...config
		};
		Log.log(this.clientLogger, `⚙️ Show configuration updated for: ${this.performerId}`);
	}

	/**
	 * ========================================================================
	 * PUBLIC UTILITY METHODS
	 * ========================================================================
	 */

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
		currentPerformerId: string | null;
		performerId: string;
		cachedPerformers: number;
		territories: string[];
	} {
		const allPerformers = this.territoryAccess.getAllPerformers();
		const territories = [...new Set(allPerformers.map(performer => performer.territoryName))];

		return {
			isPerforming: this.performing,
			currentPerformerId: this.currentPerformerId,
			performerId: this.performerId,
			cachedPerformers: allPerformers.length,
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

	private generatePerformerId(): string {
		const vaultName = this.app.vault.getName();
		const sanitizedVault = vaultName.replace(/[^a-zA-Z0-9-]/g, '-').toLowerCase();
		const sanitizedPerformer = this.performerId.replace(/[^a-zA-Z0-9-]/g, '-').toLowerCase();
		const timestamp = Date.now().toString(36);
		const random = Math.random().toString(36).substring(2, 7);
		
		return `${sanitizedPerformer}-${sanitizedVault}-${timestamp}-${random}`;
	}

	private getLocalEndpoint(): string {
		// Try to get the Local REST API plugin endpoint
		const localRestApi = getPlugin<LocalRestAPIPlugin>(this.app, 'obsidian-local-rest-api');
		
		if (localRestApi && typeof localRestApi.getEndpoint === 'function') {
			return localRestApi.getEndpoint();
		}

		// Default fallback endpoint
		return 'http://localhost:27124';
	}

	private getPerformerCapabilities(): string[] {
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