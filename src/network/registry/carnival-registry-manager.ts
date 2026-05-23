/**
 * ============================================================================
 * 🎪 CARNIVAL REGISTRY MANAGER - The Booking Office Coordinator
 * ============================================================================
 * 
 * The Registry Manager is the carnival's central booking office - the coordinator
 * who manages performer registrations, endpoint configuration, and delegates
 * network protocol operations to the CarnivalRegistryService intern.
 * 
 * COORDINATOR/INTERN PATTERN:
 * This class is the COORDINATOR who:
 * - Knows about carnival infrastructure (Local REST API, Obsidian plugins)
 * - Initializes the booking office (endpoints, health monitoring, caches)
 * - Builds performer registration info (detection & assembly)
 * - Manages API keys for registry authentication
 * - Tracks which performers are registered
 * - Creates and coordinates the intern (CarnivalRegistryService)
 * 
 * The intern (CarnivalRegistryService) handles:
 * - HTTP/HTTPS protocol execution
 * - Network requests to registries
 * - Registry discovery operations
 * - Heartbeat transmission
 * 
 * Architecture:
 * ┌─────────────────────────────────┐
 * │ CarnivalRegistryManager         │
 * │ (The Booking Office Coordinator)│
 * │                                 │
 * │ • Initializes infrastructure    │
 * │ • Detects capabilities          │
 * │ • Manages API keys              │
 * │ • Tracks registrations          │
 * └────────────┬────────────────────┘
 *              │ creates & coordinates
 *              ↓
 * ┌─────────────────────────────────┐
 * │ CarnivalRegistryService         │
 * │ (The Protocol Intern)           │
 * │                                 │
 * │ • Executes HTTP protocol        │
 * │ • Makes network requests        │
 * │ • Uses provided dependencies    │
 * └─────────────────────────────────┘
 * 
 * Key Responsibilities:
 * 
 * 1. Infrastructure Initialization:
 *    - Detect Local REST API configuration (port, API key)
 *    - Load registry endpoints from settings
 *    - Validate endpoints (HTTPS enforcement)
 *    - Create endpoint health monitor
 *    - Initialize performer cache
 *    - Create protocol intern with dependencies
 * 
 * 2. Performer Detection & Assembly:
 *    - Detect installed plugin capabilities
 *    - Detect platform (macOS, Windows, Linux)
 *    - Detect territory from vault path
 *    - Build complete PerformerRegistrationInfo
 * 
 * 3. API Key Management:
 *    - Store registry API keys in secure storage
 *    - Retrieve API keys for authentication
 *    - Remove API keys when needed
 *    - Build API key maps for intern
 * 
 * 4. Registration Tracking:
 *    - Track which performers are registered
 *    - Persist registration list to settings
 *    - Query registration status
 * 
 * 5. Configuration Management:
 *    - Update registry endpoints
 *    - Validate endpoint URLs
 *    - Persist configuration changes
 * 
 * 6. Network Operations (Delegated):
 *    - Establish territory (pass API keys to intern)
 *    - Scout territories (query registries)
 *    - Send heartbeats (maintain presence)
 *    - Abandon territory (unregister)
 *    - Broadcast updates (notify registries)
 * 
 * Dependencies Provided to Intern:
 * - App (Obsidian) - For vault access
 * - EndpointHealthMonitor - For health monitoring
 * - PersistentPerformerCache - For caching discovered performers
 * - APIKeyStore - For secure credential storage
 * 
 * Usage Example:
 * ```typescript
 * // In main.ts
 * const registryManager = new CarnivalRegistryManager(plugin, secureStore);
 * 
 * // Build performer info
 * const info = await registryManager.buildPerformerInfo('my-performer');
 * 
 * // Register with network
 * await registryManager.establishTerritory('backstage', info);
 * 
 * // Query for other performers
 * const performers = await registryManager.scoutTerritories('backstage');
 * ```
 * 
 * @module carnival-registry-manager
 * @category Network/Services
 * @carnival-themed 🎪
 */

import type CarnivalNetworkPlugin from '../../main';
import { CarnivalRegistryService } from './carnival-registry-service';
import { PersistentPerformerCache } from '../persistent-performer-cache';
import { EndpointHealthMonitor } from './endpoint-health-monitor';
import { TerritoryAssignmentCache } from '../territory/territory-assignment-cache';
import { TerritoryCache } from '../territory/territory-cache-service';
import { getPlugin } from '../../utils/plugin-utils';
import { Log } from '../../utils/logger';
import type {
	APIKeyStore,
	LocalRestAPIPlugin,
	LogContext,
	Performer,
	PerformerRegistrationInfo,
	RegistryEntry,
	Territory,
	TerritoryServiceInterface
} from '../../types/public';

/**
 * 🎪 CarnivalRegistryManager - The Booking Office Coordinator
 * 
 * Coordinates all registry operations by managing infrastructure, detecting
 * performer capabilities, handling API keys, and delegating network protocol
 * execution to the CarnivalRegistryService intern.
 */
export class CarnivalRegistryManager implements TerritoryServiceInterface {
	private registryLogger: LogContext;
	private registeredPerformers: Set<string> = new Set();
	private registryService: CarnivalRegistryService;
	private performerCache: PersistentPerformerCache;
	private territoryCache: TerritoryCache;
	private assignmentCache: TerritoryAssignmentCache;
	private endpointMonitor: EndpointHealthMonitor;
	private localApiPort: number = 27123;
	private localApiKey: string = '';

	constructor(
		private plugin: CarnivalNetworkPlugin,
		private store: APIKeyStore
	) {
		this.registryLogger = {
			context: 'Carnival Registry Manager',
			path: `${ plugin.app.vault.configDir }/plugins/carnival-network/src/network/carnival-registry-manager`
		};

		// Initialize booking office infrastructure
		this.initializeBookingOffice();

		// Initialize performer cache
		this.performerCache = new PersistentPerformerCache(plugin.app);

		// Initialize territory caches
		this.territoryCache = new TerritoryCache(plugin.app);
		this.assignmentCache = new TerritoryAssignmentCache(plugin.app);

		// Create the intern (pass dependencies - NO store access)
		this.registryService = new CarnivalRegistryService(
			plugin.app,
			this.endpointMonitor,
			this.performerCache
		);

		// Load saved registrations
		this.loadRegistrations();

		Log.log(this.registryLogger, '🎪 Carnival Registry Manager (Booking Office) initialized');
	}

	// ========================================================================
	// INFRASTRUCTURE INITIALIZATION
	// ========================================================================

	/**
	 * Initialize the booking office infrastructure
	 * 
	 * Sets up:
	 * - Local REST API configuration detection
	 * - Registry endpoints from settings
	 * - Endpoint validation (HTTPS enforcement)
	 * - Endpoint health monitor
	 * 
	 * @private
	 */
	private initializeBookingOffice(): void {
		try {
			// 1. Get Local REST API configuration
			const localAPIConfig = this.getLocalRestAPIConfig();
			this.localApiPort = localAPIConfig.port;
			this.localApiKey = localAPIConfig.apiKey;

			Log.log(
				this.registryLogger,
				`🎪 Local REST API detected: port ${this.localApiPort}`
			);

			// 2. Get registry endpoints from settings
			const configuredEndpoints = this.plugin.registryEndpoints ?? [];
			
			// Add localhost as default if no endpoints configured
			const seededEndpoints = configuredEndpoints.length > 0
				? [...configuredEndpoints]
				: [`http://localhost:${this.localApiPort}`];

			// 3. Validate and filter endpoints (HTTPS enforcement)
			const validEndpoints = seededEndpoints.filter(ep => {
				const isValid = this.validateEndpoint(ep);
				if (!isValid) {
					Log.warn(
						this.registryLogger,
						`🎪 Invalid endpoint filtered out: ${ep}`
					);
				}
				return isValid;
			});

			// 4. Create endpoint health monitor
			this.endpointMonitor = new EndpointHealthMonitor(validEndpoints);

			Log.log(
				this.registryLogger,
				`🎪 Booking office initialized with ${validEndpoints.length} registry endpoint(s)`
			);
		} catch (error) {
			Log.error(
				this.registryLogger,
				'🎪 Failed to initialize booking office:',
				error
			);
			// Create empty endpoint manager as fallback
			this.endpointMonitor = new EndpointHealthMonitor([]);
		}
	}

	/**
	 * Get Local REST API configuration from plugin
	 * 
	 * Attempts to read the obsidian-local-rest-api plugin settings to
	 * determine the port and API key for local communication.
	 * 
	 * @returns Configuration object with port and apiKey
	 * @private
	 */
	private getLocalRestAPIConfig(): { port: number; apiKey: string } {
		try {
			const restApiPlugin = getPlugin<LocalRestAPIPlugin>(this.plugin.app, 'obsidian-local-rest-api');
			
			if (restApiPlugin?.enabled) {
				const apiSettings = restApiPlugin.settings;
				return {
					port: apiSettings.port ?? 27123,
					apiKey: apiSettings.apiKey ?? ''
				};
			}
		} catch (error) {
			Log.warn(
				this.registryLogger,
				'Failed to get Local REST API config:',
				error
			);
		}
		
		return { port: 27123, apiKey: '' };
	}

	// ========================================================================
	// CONFIGURATION MANAGEMENT
	// ========================================================================

	/**
	 * 📝 Update registry endpoints
	 * 
	 * Updates the list of registry endpoints where performers can register.
	 * Validates endpoints (HTTPS enforcement), persists to settings, and
	 * notifies the intern to update its internal endpoint list.
	 * 
	 * @param endpoints - Array of registry endpoint URLs
	 * @throws Error if unable to persist settings
	 * 
	 * @example
	 * ```typescript
	 * await manager.updateEndpoints([
	 *   'https://registry.carnival.network',
	 *   'http://localhost:27123'
	 * ]);
	 * ```
	 */
	async updateEndpoints(endpoints: string[]): Promise<void> {
		try {
			// Validate endpoints (HTTPS enforcement)
			const validEndpoints = endpoints.filter(ep => this.validateEndpoint(ep));

			if (validEndpoints.length < endpoints.length) {
				Log.warn(
					this.registryLogger,
					`🎪 Some endpoints were filtered out (${endpoints.length - validEndpoints.length} invalid)`
				);
			}

			// Update plugin settings
			this.plugin.registryEndpoints = validEndpoints;
			await this.plugin.saveSettings();

			// Update endpoint manager
			this.endpointMonitor.updateEndpoints(validEndpoints);

			Log.log(
				this.registryLogger,
				`🎪 Registry endpoints updated: ${validEndpoints.length} endpoint(s)`
			);
		} catch (err) {
			Log.error(this.registryLogger, 'Failed to update registry endpoints:', err);
			throw err;
		}
	}

	/**
	 * 📋 Get current registry endpoints
	 * 
	 * @returns Array of configured registry endpoint URLs
	 */
	getEndpoints(): string[] {
		return this.plugin.registryEndpoints ?? [];
	}

	/**
	 * ✅ Validate registry endpoint URL
	 * 
	 * Ensures endpoint follows HTTPS requirements (except localhost/127.0.0.1).
	 * This enforces secure communication for all non-local registries.
	 * 
	 * @param endpoint - URL to validate
	 * @returns True if valid, false otherwise
	 */
	validateEndpoint(endpoint: string): boolean {
		try {
			const url = new URL(endpoint);
			
			// Allow http for localhost/127.0.0.1
			if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') {
				return true;
			}

			// Require HTTPS for all other endpoints
			if (url.protocol !== 'https:') {
				Log.warn(
					this.registryLogger,
					`🎪 Endpoint rejected (not HTTPS): ${endpoint}`
				);
				return false;
			}

			return true;
		} catch {
			Log.warn(this.registryLogger, `🎪 Invalid endpoint URL: ${endpoint}`);
			return false;
		}
	}

	// ========================================================================
	// PERFORMER REGISTRATION TRACKING
	// ========================================================================

	/**
	 * 📝 Register a new performer
	 * 
	 * Adds performer to the local registration tracking list and persists.
	 * This is separate from network registration (establishTerritory) and
	 * tracks which performers have joined the carnival locally.
	 * 
	 * @param performerId - Unique performer identifier
	 */
	registerPerformer(performerId: string): void {
		this.registeredPerformers.add(performerId);
		this.persistRegistrations();
		Log.log(this.registryLogger, `🎭 Performer registered: ${performerId}`);
	}

	/**
	 * 🗑️ Unregister a performer
	 * 
	 * Removes performer from the local registration tracking list and persists.
	 * 
	 * @param performerId - Unique performer identifier
	 */
	unregisterPerformer(performerId: string): void {
		this.registeredPerformers.delete(performerId);
		this.persistRegistrations();
		Log.log(this.registryLogger, `🎭 Performer unregistered: ${performerId}`);
	}

	/**
	 * ✅ Check if performer is registered locally
	 * 
	 * @param performerId - Unique performer identifier
	 * @returns True if performer is in local registration tracking
	 */
	isRegistered(performerId: string): boolean {
		return this.registeredPerformers.has(performerId);
	}

	/**
	 * 📋 Get all locally registered performers
	 * 
	 * @returns Array of registered performer IDs
	 */
	getRegisteredPerformers(): string[] {
		return Array.from(this.registeredPerformers);
	}

	/**
	 * 💾 Persist registrations to plugin settings
	 * @private
	 */
	private persistRegistrations(): void {
		this.plugin.registeredPerformers = this.getRegisteredPerformers();
		this.plugin.saveSettings().catch(err => {
			Log.error(this.registryLogger, 'Failed to persist registrations:', err);
		});
	}

	/**
	 * 🔄 Load registrations from plugin settings
	 * @private
	 */
	private loadRegistrations(): void {
		const saved = this.plugin.registeredPerformers;
		if (Array.isArray(saved)) {
			this.registeredPerformers = new Set(saved);
			Log.log(
				this.registryLogger,
				`🎪 Loaded ${this.registeredPerformers.size} registered performer(s)`
			);
		}
	}

	// ========================================================================
	// PERFORMER DETECTION & ASSEMBLY
	// ========================================================================

	/**
	 * Get current performer ID
	 * Helper to get performer ID from plugin or generate default
	 * 
	 * @private
	 */
	private getCurrentPerformerId(): string {
		// In a full implementation, this would come from the plugin's performer
		// For now, use vault name as performer ID
		return this.plugin.app.vault.getName();
	}

	/**
	 * 🎭 Build performer registration info
	 * 
	 * Constructs complete PerformerRegistrationInfo from current vault state.
	 * Detects capabilities, territory, and Local REST API configuration.
	 * This is the coordinator's responsibility - it knows the carnival infrastructure.
	 * 
	 * @param performerId - Unique performer identifier
	 * @param territory - Territory name (from assignment or default)
	 * @returns Complete performer registration information
	 * 
	 * @example
	 * ```typescript
	 * const territory = await manager.getPrimaryTerritory();
	 * const info = await manager.buildPerformerInfo('my-performer', territory);
	 * await manager.establishTerritory(territory, info);
	 * ```
	 */
	async buildPerformerInfo(
		performerId: string,
		territory: string
	): Promise<PerformerRegistrationInfo> {
		const vault = this.plugin.app.vault;
		const vaultPath = (vault.adapter as any).path || '';
		
		return {
			performerId,
			territoryName: territory,
			endpoint: `http://localhost:${this.localApiPort}`,
			capabilities: await this.detectCapabilities(),
			metadata: {
				apiHost: 'localhost',
				apiPort: this.localApiPort,
				useHttps: false,
				vaultPath,
				version: '1.0.0'
			}
		};
	}

	/**
	 * Detect performer capabilities based on installed plugins
	 * 
	 * Scans installed Obsidian plugins to determine what capabilities
	 * this performer has available (REST API, templating, dataview, etc.)
	 * 
	 * @returns Array of capability strings
	 * @private
	 */
	private async detectCapabilities(): Promise<string[]> {
		const capabilities = ['http_communication', 'record_sync'];
		
		try {
			// Check for plugin-specific capabilities
			const { plugins } = (this.plugin.app as any).plugins;
			
			if (plugins['obsidian-local-rest-api']?.enabled) {
				capabilities.push('rest_api');
			}
			
			if (plugins['templater-obsidian']?.enabled) {
				capabilities.push('templating');
			}
			
			if (plugins['dataview']?.enabled) {
				capabilities.push('dataview_queries');
			}
		} catch (error) {
			Log.warn(this.registryLogger, 'Failed to detect capabilities:', error);
		}
		
		return capabilities;
	}

	// ========================================================================
	// TERRITORY MANAGEMENT
	// ========================================================================

	/**
	 * ➕ Add territory to performer assignments
	 * 
	 * Adds a single territory to the performer's territory list if not already present.
	 * Creates the territory in the territory cache if it doesn't exist.
	 * 
	 * @param territory - Territory name to add
	 * @param performerId - Performer ID (optional, uses current if not provided)
	 */
	async addTerritory(territory: string, performerId?: string): Promise<void> {
		// Ensure territory exists
		if (!this.territoryCache.has(territory)) {
			this.territoryCache.upsert(territory, {
				description: `Territory: ${territory}`,
				status: 'active'
			});
		}

		const id = performerId || this.getCurrentPerformerId();
		this.assignmentCache.addTerritory(id, territory);
	}

	/**
	 * ➖ Remove territory from performer assignments
	 * 
	 * Removes a single territory from the performer's territory list.
	 * If removing the last territory, assigns to 'general' instead.
	 * 
	 * @param territory - Territory name to remove
	 * @param performerId - Performer ID (optional, uses current if not provided)
	 */
	async removeTerritory(territory: string, performerId?: string): Promise<void> {
		const id = performerId || this.getCurrentPerformerId();
		this.assignmentCache.removeTerritory(id, territory);
	}

	/**
	 * 🎯 Set primary territory
	 * 
	 * Sets which territory is the primary (first in list).
	 * Territory must already be in assigned list.
	 * 
	 * @param territory - Territory name to set as primary
	 * @param performerId - Performer ID (optional, uses current if not provided)
	 */
	async setPrimaryTerritory(territory: string, performerId?: string): Promise<void> {
		const id = performerId || this.getCurrentPerformerId();
		this.assignmentCache.setPrimaryTerritory(id, territory);
	}

	/**
	 * ➕ Assign performer to territories
	 * 
	 * Updates the list of territories this performer belongs to.
	 * The first territory in the list is considered the primary territory.
	 * 
	 * @param territories - Array of territory names
	 * @param performerId - Performer ID (optional, uses current if not provided)
	 * 
	 * @example
	 * ```typescript
	 * await manager.assignTerritories(['backstage', 'workshop', 'library']);
	 * ```
	 */
	async assignTerritories(territories: string[], performerId?: string): Promise<void> {
		// Validate at least one territory
		if (territories.length === 0) {
			throw new Error('At least one territory must be assigned');
		}

		// Remove duplicates and empty strings
		const uniqueTerritories = [...new Set(territories.filter(t => t.trim().length > 0))];

		// Ensure all territories exist in territory cache
		for (const territory of uniqueTerritories) {
			if (!this.territoryCache.has(territory)) {
				// Create territory if it doesn't exist
				this.territoryCache.upsert(territory, {
					description: `Territory: ${territory}`,
					status: 'active'
				});
			}
		}

		// Update assignment
		const id = performerId || this.getCurrentPerformerId();
		this.assignmentCache.assign(id, uniqueTerritories);

		Log.log(
			this.registryLogger,
			`🎭 Assigned to territories: ${uniqueTerritories.join(', ')} (primary: ${uniqueTerritories[0]})`
		);
	}

	/**
	 * ✏️ Create or update territory
	 * 
	 * Creates a new territory or updates an existing one.
	 * 
	 * @param name - Territory name
	 * @param updates - Territory fields to update
	 * @returns Updated territory object
	 */
	upsertTerritory(name: string, updates: Partial<Territory>): Territory {
		return this.territoryCache.upsert(name, updates);
	}

	/**
	 * 📋 Get all known territories
	 * 
	 * Returns all territories from the territory cache.
	 * This includes both territories from the cache and discovered from the network.
	 * 
	 * @returns Array of territory names
	 */
	getKnownTerritories(): string[] {
		return this.territoryCache.getAllNames();
	}

	/**
	 * 🗺️ Get territory details
	 * 
	 * Returns full territory information including metadata.
	 * 
	 * @param territory - Territory name
	 * @returns Territory object or null if not found
	 */
	getTerritoryDetails(territory: string): Territory | null {
		return this.territoryCache.get(territory);
	}

	/**
	 * 📋 Get assigned territories for this performer
	 * 
	 * @param performerId - Performer ID (optional, uses current if not provided)
	 * @returns Array of territory names this performer is assigned to
	 */
	getAssignedTerritories(performerId?: string): string[] {
		const id = performerId || this.getCurrentPerformerId();
		return this.assignmentCache.getAssignments(id);
	}

	/**
	 * 🎯 Get primary territory for this performer
	 * 
	 * Returns the primary territory, or 'general' if none assigned.
	 * 
	 * @param performerId - Performer ID (optional, uses current if not provided)
	 * @returns Primary territory name
	 */
	getPrimaryTerritory(performerId?: string): string {
		const id = performerId || this.getCurrentPerformerId();
		return this.assignmentCache.getPrimaryTerritory(id);
	}

	/**
	 * Detect territory from vault path
	 * 
	 * Analyzes the vault path to determine which carnival territory
	 * this performer belongs to (necropolis, backstage, boutique, etc.)
	 * 
	 * @param vaultPath - Full path to the vault
	 * @returns Territory name
	 * @private
	 */
	private detectTerritory(vaultPath: string): string {
		const path = vaultPath.toLowerCase();
		
		if (path.includes('necropolis')) return 'necropolis';
		if (path.includes('backstage')) return 'backstage';
		if (path.includes('boutique')) return 'boutique';
		if (path.includes('athenaeum')) return 'athenaeum';
		if (path.includes('carnival')) return 'carnival-main';
		
		return 'unknown';
	}

	// ========================================================================
	// REGISTRY API KEY MANAGEMENT
	// ========================================================================

	/**
	 * 🔐 Store API key for registry endpoint
	 * 
	 * Stores an API key in secure storage for authenticating with a specific
	 * registry endpoint. Keys are stored with the prefix `registry_`.
	 * The coordinator manages credentials and passes them to the intern when needed.
	 * 
	 * @param registryUrl - Registry endpoint URL
	 * @param apiKey - API key to store
	 */
	async storeRegistryAPIKey(registryUrl: string, apiKey: string): Promise<void> {
		try {
			await this.store.store(`registry_${registryUrl}`, apiKey);
			Log.log(
				this.registryLogger,
				`🔐 Stored API key for registry: ${registryUrl}`
			);
		} catch (error) {
			Log.error(this.registryLogger, 'Failed to store registry API key:', error);
			throw error;
		}
	}

	/**
	 * 🔓 Retrieve API key for registry endpoint
	 * 
	 * Retrieves the stored API key for a specific registry endpoint.
	 * Falls back to local API key if no specific key is stored.
	 * 
	 * @param registryUrl - Registry endpoint URL
	 * @returns API key or null if not found
	 */
	async getRegistryAPIKey(registryUrl: string): Promise<string | null> {
		try {
			const key = await this.store.retrieve(`registry_${registryUrl}`);
			return key || this.localApiKey || null;
		} catch (error) {
			Log.warn(this.registryLogger, 'Failed to retrieve registry API key:', error);
			return this.localApiKey || null;
		}
	}

	/**
	 * 🗑️ Remove API key for registry endpoint
	 * 
	 * Removes the stored API key for a specific registry endpoint.
	 * 
	 * @param registryUrl - Registry endpoint URL
	 */
	async removeRegistryAPIKey(registryUrl: string): Promise<void> {
		try {
			await this.store.remove(`registry_${registryUrl}`);
			Log.log(
				this.registryLogger,
				`🗑️ Removed API key for registry: ${registryUrl}`
			);
		} catch (error) {
			Log.error(this.registryLogger, 'Failed to remove registry API key:', error);
			throw error;
		}
	}

	/**
	 * Build API key map for all configured endpoints
	 * 
	 * Creates a map of endpoint URLs to their API keys for passing to the intern.
	 * The coordinator manages credentials and gives them to the intern as needed.
	 * 
	 * @returns Map of endpoint URLs to API keys
	 * @private
	 */
	private async buildAPIKeyMap(): Promise<Map<string, string>> {
		const apiKeyMap = new Map<string, string>();
		const endpoints = this.getEndpoints();
		
		for (const endpoint of endpoints) {
			const key = await this.getRegistryAPIKey(endpoint);
			if (key) {
				apiKeyMap.set(endpoint, key);
			}
		}
		
		return apiKeyMap;
	}

	// ========================================================================
	// NETWORK OPERATIONS (Delegated to CarnivalRegistryService)
	// ========================================================================

	/**
	 * 🎪 Establish territory (register with network)
	 * 
	 * Registers the performer with all configured registry endpoints.
	 * The coordinator builds the API key map and passes it to the intern
	 * for protocol execution.
	 * 
	 * @param territory - Territory name (unused, kept for interface compliance)
	 * @param performerInfo - Complete performer registration information
	 * 
	 * @example
	 * ```typescript
	 * const info = await manager.buildPerformerInfo('my-performer');
	 * await manager.establishTerritory('backstage', info);
	 * ```
	 */
	async establishTerritory(
		territory: string,
		performerInfo: PerformerRegistrationInfo
	): Promise<void> {
		// Build API key map for intern
		const apiKeyMap = await this.buildAPIKeyMap();
		
		// Delegate to intern with credentials
		return this.registryService.establishTerritory(territory, performerInfo, apiKeyMap);
	}

	/**
	 * 🗺️ Scout territories (discover performers)
	 * 
	 * Queries all registries for performers in the specified territory.
	 * Delegates to the intern for protocol execution.
	 * 
	 * @param territory - Territory name to query
	 * @returns Array of discovered performers
	 */
	async scoutTerritories(territory: string): Promise<RegistryEntry[]> {
		return this.registryService.scoutTerritories(territory);
	}

	/**
	 * 💓 Send heartbeat
	 * 
	 * Sends periodic heartbeat to all registries to maintain registration.
	 * The coordinator builds the API key map and passes it to the intern.
	 */
	async sendHeartbeat(): Promise<void> {
		const apiKeyMap = await this.buildAPIKeyMap();
		return this.registryService.sendHeartbeat(apiKeyMap);
	}

	/**
	 * 👋 Abandon territory (unregister from network)
	 * 
	 * Unregisters from all registries and stops heartbeat.
	 * The coordinator builds the API key map and passes it to the intern.
	 */
	async abandonTerritory(): Promise<void> {
		const apiKeyMap = await this.buildAPIKeyMap();
		return this.registryService.abandonTerritory(apiKeyMap);
	}

	/**
	 * 📋 Get all cached performers
	 * 
	 * Delegates to intern to retrieve all performers from cache.
	 */
	getAllPerformers(): RegistryEntry[] {
		return this.registryService.getAllPerformers();
	}

	/**
	 * 🔍 Find performers by criteria
	 * 
	 * Delegates to intern to search cached performers.
	 */
	findPerformers(criteria: {
		id?: string;
		name?: string;
		territory?: string;
		capabilities?: string[];
	}): Performer | null {
		return this.registryService.findPerformers(criteria);
	}

	/**
	 * 🗺️ Find performers by territory
	 * 
	 * Delegates to intern to filter performers by territory.
	 */
	findPerformersByTerritory(territory: string): Performer[] {
		return this.registryService.findPerformersByTerritory(territory);
	}

	/**
	 * 📢 Broadcast performer update
	 * 
	 * Notifies all registries of performer changes.
	 * Delegates to intern for protocol execution.
	 */
	async broadcastPerformerUpdate(performer: Performer): Promise<void> {
		return this.registryService.broadcastPerformerUpdate(performer);
	}

	/**
	 * ✅ Check if service is available
	 * 
	 * Delegates to intern to check if initialized and ready.
	 */
	isAvailable(): boolean {
		return this.registryService.isAvailable();
	}

	// ========================================================================
	// HEALTH & METRICS (from CarnivalRegistryService → EndpointHealthMonitor)
	// ========================================================================

	/**
	 * 🏥 Get registry health status
	 * 
	 * Returns circuit breaker states for each registry endpoint.
	 * Delegates to intern which queries the endpoint manager.
	 * 
	 * @returns Map of endpoint URLs to health states (CLOSED/OPEN/HALF_OPEN)
	 */
	getRegistryHealth(): { [endpoint: string]: string } {
		return this.registryService.getRegistryHealth();
	}

	/**
	 * 📊 Get registry metrics
	 * 
	 * Returns request/success/failure metrics for each endpoint.
	 * Delegates to intern which queries the endpoint manager.
	 * 
	 * @returns Metrics object per endpoint
	 */
	getRegistryMetrics(): Record<string, {
		requests: number;
		successes: number;
		failures: number
	}> {
		return this.registryService.getRegistryMetrics();
	}

	/**
	 * 🗺️ Get network topology
	 * 
	 * Returns overview of performers, territories, and capabilities.
	 * Delegates to intern for aggregation.
	 */
	async getCarnivalTopology(): Promise<{
		totalPerformers: number;
		territories: { [territory: string]: number };
		capabilities: { [capability: string]: number };
		activeRegistries: number;
	}> {
		return this.registryService.getCarnivalTopology();
	}

	// ========================================================================
	// CLEANUP
	// ========================================================================

	/**
	 * 🧹 Cleanup service
	 * 
	 * Delegates to intern to cleanup network connections, stop heartbeats,
	 * and cleanup performer cache. Also cleans up territory caches.
	 */
	async cleanup(): Promise<void> {
		await this.registryService.cleanup();
		await this.territoryCache.cleanup();
		await this.assignmentCache.cleanup();
		Log.log(this.registryLogger, '🎪 Carnival Registry Manager cleanup complete');
	}
}