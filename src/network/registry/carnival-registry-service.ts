/**
 * ============================================================================
 * 📋 CARNIVAL REGISTRY SERVICE - The Protocol Intern
 * ============================================================================
 * 
 * The Registry Service is the carnival's protocol intern - the worker who
 * executes HTTP/HTTPS network operations as instructed by the coordinator
 * (CarnivalRegistryManager). This service focuses purely on protocol execution.
 * 
 * COORDINATOR/INTERN PATTERN:
 * This class is the INTERN who:
 * - Receives dependencies from the coordinator
 * - Makes HTTP/HTTPS calls to registry endpoints
 * - Follows the registry protocol (register, heartbeat, discover, unregister)
 * - Queries registries for performer data
 * - Uses tools provided by coordinator (endpoint manager, cache)
 * - Receives API keys as parameters (NO direct storage access)
 * - Reports results back to coordinator
 * 
 * The coordinator (CarnivalRegistryManager) handles:
 * - Infrastructure initialization
 * - Performer capability detection
 * - API key management (retrieval from secure storage)
 * - Registration tracking
 * 
 * Architecture:
 * ┌─────────────────────────────────┐
 * │ CarnivalRegistryManager         │
 * │ (Coordinator)                   │
 * │ • Has APIKeyStore access        │
 * │ • Builds API key maps           │
 * │ • Detects capabilities          │
 * │ • Manages infrastructure        │
 * └────────────┬────────────────────┘
 *              │ passes API keys & instructions
 *              ↓
 * ┌─────────────────────────────────┐
 * │ CarnivalRegistryService         │
 * │ (Intern - THIS CLASS)           │
 * │ • NO APIKeyStore access ❌      │
 * │ • Receives API keys as params   │
 * │ • Executes HTTP protocol        │
 * │ • Sends registration requests   │
 * │ • Queries registries            │
 * │ • Transmits heartbeats          │
 * │ • Updates cache with results    │
 * └─────────────────────────────────┘
 * 
 * Key Responsibilities:
 * 
 * 1. Territory Establishment (Registration):
 *    - POST to /carnival/network/registry
 *    - Use API keys provided by coordinator
 *    - Start heartbeat after successful registration
 * 
 * 2. Performer Discovery:
 *    - GET from /carnival/network/registry
 *    - Query multiple registries
 *    - Deduplicate results
 *    - Update local cache
 * 
 * 3. Heartbeat Transmission:
 *    - POST to /carnival/network/heartbeat
 *    - Periodic updates to maintain registration
 *    - Use API keys provided by coordinator
 * 
 * 4. Territory Abandonment (Unregistration):
 *    - DELETE to /carnival/network/registry
 *    - Stop heartbeat intervals
 *    - Use API keys provided by coordinator
 * 
 * 5. Cache Management:
 *    - Update performer cache after discovery
 *    - Read from cache for queries
 *    - Clear cache as needed
 * 
 * Dependencies (Provided by Coordinator):
 * - App - Obsidian app instance for vault access
 * - RegistryEndpointManager - Health monitoring and circuit breakers
 * - PersistentPerformerCache - Storage for discovered performers
 * 
 * Note: The intern does NOT have access to APIKeyStore. The coordinator
 * manages credentials and passes API keys as parameters when calling methods.
 * 
 * Registry Protocol:
 * 
 * Establishment (POST /carnival/network/registry):
 * Request: { performer: Performer, action: 'register' }
 * Response: { success: boolean, performers?: Performer[] }
 * 
 * Heartbeat (POST /carnival/network/heartbeat):
 * Request: { performer: Performer, timestamp: string }
 * Response: { success: boolean }
 * 
 * Abandonment (DELETE /carnival/network/registry):
 * Request: { performer: Performer, action: 'unregister' }
 * Response: { success: boolean }
 * 
 * Discovery (GET /carnival/network/registry):
 * Response: { performers: Performer[] }
 * 
 * Usage Example:
 * ```typescript
 * // Created by coordinator
 * const intern = new CarnivalRegistryService(
 *   app,
 *   endpointManager,
 *   performerCache
 * );
 * 
 * // Coordinator passes API keys when calling methods
 * const apiKeyMap = new Map([
 *   ['https://registry1.com', 'key1'],
 *   ['http://localhost:27123', 'key2']
 * ]);
 * 
 * await intern.establishTerritory('backstage', performerInfo, apiKeyMap);
 * ```
 * 
 * @module carnival-registry-service
 * @category Network/Services
 * @carnival-themed 📋
 */

import type { App } from 'obsidian';
import { Log } from '../../utils/logger';
import { fetchWithRetry } from './carnival-registry-utils';
import {
	validateRegistryResponse,
	validatePerformers,
	ValidationError
} from '../validation';
import { EndpointHealthMonitor } from './endpoint-health-monitor';
import { PersistentPerformerCache } from '../performer/persistent-performer-cache';
import type {
	LogContext,
	Performer,
	RegistryEntry,
	PerformerRegistrationInfo,
	TerritoryServiceInterface
} from '../../types/public';

/**
 * 📋 CarnivalRegistryService - The Protocol Intern
 * 
 * Executes HTTP/HTTPS registry protocol operations using dependencies
 * provided by the CarnivalRegistryManager coordinator. Receives API keys
 * as method parameters - does NOT access secure storage directly.
 */
export class CarnivalRegistryService implements TerritoryServiceInterface {
	private currentPerformer: Performer | null = null;
	private heartbeatIntervals: Map<string, ReturnType<typeof setInterval>> = new Map();
	private currentApiKeyMap: Map<string, string> = new Map();
	private registryServiceLogger: LogContext;

	constructor(
		private app: App,
		private endpointManager: EndpointHealthMonitor,
		private performerCache: PersistentPerformerCache
	) {
		this.registryServiceLogger = {
			context: 'Carnival Registry Service',
			path: `${ app.vault.configDir }carnival-network/src/network/carnival-registry-service`
		};
		Log.log(this.registryServiceLogger, '📋 Carnival Registry Service (Protocol Intern) ready');
	}

	// ========================================================================
	// PROTOCOL METHODS - TerritoryServiceInterface Implementation
	// ========================================================================

	/**
	 * 🎪 Establish territory (register with network)
	 * 
	 * Registers the performer with all configured registry endpoints.
	 * The intern receives API keys from the coordinator and uses them
	 * to authenticate the registration requests.
	 * 
	 * Protocol: POST /carnival/network/registry
	 * Body: { performer: Performer, action: 'register' }
	 * 
	 * @param territory - Territory name (unused, kept for interface compliance)
	 * @param performerInfo - Complete performer registration information
	 * @param apiKeyMap - Map of endpoint URLs to API keys (from coordinator)
	 */
	async establishTerritory(
		territory: string,
		performerInfo: PerformerRegistrationInfo,
		apiKeyMap: Map<string, string>
	): Promise<void> {
		// Build performer object from registration info
		const performer: Performer = {
			id: performerInfo.performerId,
			name: this.app.vault.getName(),
			territory: performerInfo.territoryName,
			lastSeen: new Date().toISOString(),
			capabilities: performerInfo.capabilities,
			metadata: performerInfo.metadata ?? {}
		};

		// Store for heartbeat use
		this.currentPerformer = performer;
		this.currentApiKeyMap = apiKeyMap;

		const endpoints = this.getRegistryEndpoints();
		
		// Register with each endpoint
		for (const registryUrl of endpoints) {
			try {
				const apiKey = apiKeyMap.get(registryUrl) || null;
				await this.registerWithRegistry(registryUrl, performer, apiKey);
				Log.log(this.registryServiceLogger, `📋 Registered with registry: ${registryUrl}`);
			} catch (error) {
				Log.error(this.registryServiceLogger, `📋 Failed to register with ${registryUrl}:`, error);
			}
		}

		// Start periodic heartbeat
		this.startHeartbeat();
	}

	/**
	 * 👋 Abandon territory (unregister from network)
	 * 
	 * Unregisters the performer from all registry endpoints and stops heartbeat.
	 * The intern receives API keys from the coordinator for authentication.
	 * 
	 * Protocol: DELETE /carnival/network/registry
	 * Body: { performer: Performer, action: 'unregister' }
	 * 
	 * @param apiKeyMap - Map of endpoint URLs to API keys (from coordinator)
	 */
	async abandonTerritory(apiKeyMap: Map<string, string>): Promise<void> {
		if (!this.currentPerformer) {
			Log.warn(this.registryServiceLogger, '📋 No current performer to abandon');
			return;
		}
		
		// Stop heartbeat first
		this.stopHeartbeat();

		const endpoints = this.getRegistryEndpoints();

		// Unregister from each endpoint
		for (const registryUrl of endpoints) {
			try {
				const apiKey = apiKeyMap.get(registryUrl) || null;
				await this.makeAPIRequest(
					registryUrl,
					'/carnival/network/registry',
					'DELETE',
					apiKey,
					{
						performer: this.currentPerformer,
						action: 'unregister'
					}
				);
				Log.log(this.registryServiceLogger, `📋 Unregistered from registry: ${registryUrl}`);
			} catch (error) {
				Log.error(this.registryServiceLogger, `📋 Failed to unregister from ${registryUrl}:`, error);
			}
		}

		this.currentPerformer = null;
		this.currentApiKeyMap.clear();
	}

	/**
	 * 💓 Send heartbeat
	 * 
	 * Sends periodic heartbeat to all registries to maintain registration.
	 * The intern receives API keys from the coordinator for authentication.
	 * 
	 * Protocol: POST /carnival/network/heartbeat
	 * Body: { performer: Performer, timestamp: string }
	 * 
	 * @param apiKeyMap - Map of endpoint URLs to API keys (from coordinator)
	 */
	async sendHeartbeat(apiKeyMap: Map<string, string>): Promise<void> {
		if (!this.currentPerformer) {
			Log.warn(this.registryServiceLogger, '📋 No current performer for heartbeat');
			return;
		}

		// Update stored API key map
		this.currentApiKeyMap = apiKeyMap;

		// Update lastSeen timestamp
		this.currentPerformer.lastSeen = new Date().toISOString();

		const endpoints = this.getRegistryEndpoints();
		
		// Send heartbeat to each endpoint
		for (const registryUrl of endpoints) {
			try {
				const apiKey = apiKeyMap.get(registryUrl) || null;
				await this.makeAPIRequest(
					registryUrl,
					'/carnival/network/heartbeat',
					'POST',
					apiKey,
					{
						performer: this.currentPerformer,
						timestamp: new Date().toISOString()
					}
				);
				Log.log(this.registryServiceLogger, `📋 Heartbeat sent to ${registryUrl}`);
			} catch (error) {
				Log.error(this.registryServiceLogger, `📋 Heartbeat failed for ${registryUrl}:`, error);
			}
		}
	}

	/**
	 * 🗺️ Scout territories (discover performers)
	 * 
	 * Queries all registries for performers in the specified territory.
	 * Aggregates results, deduplicates, and returns as registry entries.
	 * 
	 * Protocol: GET /carnival/network/registry
	 * 
	 * @param territory - Territory name to filter by
	 * @returns Array of registry entries for performers in territory
	 */
	async scoutTerritories(territory: string): Promise<RegistryEntry[]> {
		const performers = await this.discoverPerformers();

		Log.log(this.registryServiceLogger, `📋 Discovered ${performers.length} performers across registries`);

		return performers
			.filter(p => p.territory === territory)
			.map(p => this.performerToRegistryEntry(p));
	}

	/**
	 * 📢 Broadcast performer update
	 * 
	 * Notifies all registries of performer changes (metadata, capabilities, etc.)
	 * 
	 * Protocol: PUT /carnival/network/registry
	 * Body: { performer: Performer, action: 'update' }
	 * 
	 * @param updatedPerformer - Performer object with updated information
	 */
	async broadcastPerformerUpdate(updatedPerformer: Performer): Promise<void> {
		const endpoints = this.getRegistryEndpoints();

		for (const registryUrl of endpoints) {
			try {
				const apiKey = this.currentApiKeyMap.get(registryUrl) || null;
				await this.makeAPIRequest(
					registryUrl,
					'/carnival/network/registry',
					'PUT',
					apiKey,
					{
						performer: updatedPerformer,
						action: 'update'
					}
				);
				Log.log(this.registryServiceLogger, `📋 Updated performer in registry: ${registryUrl}`);
			} catch (error) {
				Log.error(this.registryServiceLogger, `📋 Failed to update performer in ${registryUrl}:`, error);
			}
		}
	}

	// ========================================================================
	// CACHE QUERY METHODS
	// ========================================================================

	/**
	 * 📋 Get all cached performers
	 * 
	 * Returns all performers from the local cache as registry entries.
	 * 
	 * @returns Array of registry entries
	 */
	getAllPerformers(): RegistryEntry[] {
		return Array.from(this.performerCache.values()).map(p => 
			this.performerToRegistryEntry(p)
		);
	}

	/**
	 * 🔍 Find performers by criteria
	 * 
	 * Searches the local cache for performers matching the given criteria.
	 * Multiple criteria are combined with AND logic.
	 * 
	 * @param criteria - Search criteria (id, name, territory, capabilities)
	 * @returns First matching performer or null
	 */
	findPerformers(criteria: {
		id?: string;
		name?: string;
		territory?: string;
		capabilities?: string[];
	}): Performer | null {
		// If searching by ID specifically, use cache directly
		if (criteria.id && !criteria.name && !criteria.territory && !criteria.capabilities) {
			return this.performerCache.get(criteria.id);
		}
		
		// Search through all performers
		for (const performer of this.performerCache.values()) {
			let matches = true;

			// Check each criterion
			if (criteria.id && performer.id !== criteria.id) {
				matches = false;
			}
			if (criteria.name && performer.name !== criteria.name) {
				matches = false;
			}
			if (criteria.territory && performer.territory !== criteria.territory) {
				matches = false;
			}
			if (criteria.capabilities) {
				const hasCapabilities = criteria.capabilities.every(cap => 
					performer.capabilities.includes(cap)
				);
				if (!hasCapabilities) {
					matches = false;
				}
			}

			if (matches) {
				return performer;
			}
		}

		return null;
	}

	/**
	 * 🗺️ Find performers by territory
	 * 
	 * Filters cached performers by territory name.
	 * 
	 * @param territory - Territory name to filter by
	 * @returns Array of performers in the specified territory
	 */
	findPerformersByTerritory(territory: string): Performer[] {
		return Array.from(this.performerCache.values())
			.filter(performer => performer.territory === territory);
	}

	// ========================================================================
	// HEALTH & METRICS
	// ========================================================================

	/**
	 * ✅ Check if service is available
	 * 
	 * Returns true if we have endpoints configured and a current performer.
	 * 
	 * @returns True if service is ready for operations
	 */
	isAvailable(): boolean {
		return this.getRegistryEndpoints().length > 0 && this.currentPerformer !== null;
	}

	/**
	 * 🏥 Get registry health status
	 * 
	 * Returns circuit breaker states for each registry endpoint.
	 * Delegates to endpoint manager for health information.
	 * 
	 * @returns Map of endpoint URLs to health states (CLOSED/OPEN/HALF_OPEN)
	 */
	getRegistryHealth(): { [endpoint: string]: string } {
		const health: { [endpoint: string]: string } = {};

		const states = this.endpointManager.getEndpointStates();
		for (const [endpoint, state] of states) {
			health[endpoint] = state;
		}
		return health;
	}

	/**
	 * 📊 Get registry metrics
	 * 
	 * Returns request/success/failure metrics for each endpoint.
	 * Delegates to endpoint manager for metric collection.
	 * 
	 * @returns Metrics object per endpoint
	 */
	getRegistryMetrics(): Record<string, { requests: number; successes: number; failures: number }> {
		return this.endpointManager.getMetrics();
	}

	/**
	 * 🗺️ Get network topology
	 * 
	 * Returns overview of performers, territories, capabilities, and active registries.
	 * Aggregates data from local cache and endpoint health information.
	 * 
	 * @returns Topology object with counts and breakdowns
	 */
	async getCarnivalTopology(): Promise<{
		totalPerformers: number;
		territories: { [territory: string]: number };
		capabilities: { [capability: string]: number };
		activeRegistries: number;
	}> {
		const performers = Array.from(this.performerCache.values());
		const territories: { [territory: string]: number } = {};
		const capabilities: { [capability: string]: number } = {};

		// Count by territory and capabilities
		for (const performer of performers) {
			// Count by territory
			territories[performer.territory] = (territories[performer.territory] || 0) + 1;
			
			// Count by capabilities
			for (const capability of performer.capabilities) {
				capabilities[capability] = (capabilities[capability] || 0) + 1;
			}
		}

		// Count active registries
		const activeRegistries = await this.countActiveRegistries();

		return {
			totalPerformers: performers.length,
			territories,
			capabilities,
			activeRegistries
		};
	}

	// ========================================================================
	// HEARTBEAT MANAGEMENT
	// ========================================================================

	/**
	 * Start heartbeat to maintain registry presence
	 * 
	 * Creates an interval that sends heartbeat every 30 seconds.
	 * Uses the stored API key map from establishment.
	 * 
	 * @private
	 */
	private startHeartbeat(): void {
		// Clear any existing heartbeat
		this.stopHeartbeat();

		// Send heartbeat every 30 seconds
		const heartbeatInterval = setInterval(async () => {
			if (this.currentPerformer && this.currentApiKeyMap.size > 0) {
				await this.sendHeartbeat(this.currentApiKeyMap);
			}
		}, 30000);

		this.heartbeatIntervals.set('main', heartbeatInterval);
		Log.log(this.registryServiceLogger, '📋 Heartbeat started (30s interval)');
	}

	/**
	 * Stop heartbeat
	 * 
	 * Clears all heartbeat intervals.
	 * 
	 * @private
	 */
	private stopHeartbeat(): void {
		for (const interval of this.heartbeatIntervals.values()) {
			clearInterval(interval);
		}
		this.heartbeatIntervals.clear();
		Log.log(this.registryServiceLogger, '📋 Heartbeat stopped');
	}

	// ========================================================================
	// REGISTRY PROTOCOL UTILITIES
	// ========================================================================

	/**
	 * Get registry endpoints from endpoint manager
	 * 
	 * Returns array of endpoint URLs from the health monitor.
	 * 
	 * @returns Array of registry endpoint URLs
	 * @private
	 */
	private getRegistryEndpoints(): string[] {
		const states = this.endpointManager.getEndpointStates();
		return Array.from(states.keys());
	}

	/**
	 * Query specific registry for performers
	 * 
	 * Makes GET request to registry endpoint and validates response.
	 * 
	 * Protocol: GET /carnival/network/registry
	 * Response: { performers: Performer[] }
	 * 
	 * @param registryUrl - Registry endpoint URL
	 * @returns Array of performers from this registry
	 * @throws ValidationError if response is invalid
	 * @private
	 */
	private async queryRegistry(registryUrl: string): Promise<Performer[]> {
		const endpoint = '/carnival/network/registry';
		const apiKey = this.currentApiKeyMap.get(registryUrl) || null;
		const response = await this.makeAPIRequest(registryUrl, endpoint, 'GET', apiKey);
		
		if (!response.ok) {
			throw new Error(`Registry query failed: ${response.status}`);
		}

		try {
			const data = await response.json() as unknown;
			validateRegistryResponse(data);
			// After validation we know data has performers array
			return validatePerformers((data as any).performers as unknown[]);
		} catch (error) {
			if (error instanceof ValidationError) {
				Log.error(this.registryServiceLogger, `📋 Invalid response from registry ${registryUrl}:`, error);
				throw new ValidationError(
					`Invalid response from registry ${registryUrl}: ${error.message}`,
					{ registry: registryUrl, ...(error.details as object || {}) }
				);
			}
			throw error;
		}
	}

	/**
	 * Register with specific registry
	 * 
	 * Makes POST request to register performer with a single registry.
	 * 
	 * Protocol: POST /carnival/network/registry
	 * Body: { performer: Performer, action: 'register' }
	 * 
	 * @param registryUrl - Registry endpoint URL
	 * @param performer - Performer object to register
	 * @param apiKey - API key for authentication (or null)
	 * @throws Error if registration fails
	 * @private
	 */
	private async registerWithRegistry(
		registryUrl: string,
		performer: Performer,
		apiKey: string | null
	): Promise<void> {
		const endpoint = '/carnival/network/registry';
		const response = await this.makeAPIRequest(registryUrl, endpoint, 'POST', apiKey, {
			performer: performer,
			action: 'register'
		});

		if (!response.ok) {
			throw new Error(`Registration failed: ${response.status}`);
		}
	}

	/**
	 * Count active registries
	 * 
	 * Counts how many registries are in CLOSED (healthy) circuit breaker state.
	 * This is more efficient than probing each registry with a ping.
	 * 
	 * @returns Number of healthy registries
	 * @private
	 */
	private async countActiveRegistries(): Promise<number> {
		let activeCount = 0;

		const states = this.endpointManager.getEndpointStates();
		for (const [, state] of states) {
			if (state === 'CLOSED') {
				activeCount++;
			}
		}

		return activeCount;
	}

	// ========================================================================
	// PERFORMER DISCOVERY & CACHE MANAGEMENT
	// ========================================================================

	/**
	 * Discover all network performers across registries
	 * 
	 * Queries all registry endpoints, aggregates results, deduplicates,
	 * and updates the local cache.
	 * 
	 * @returns Array of unique performers across all registries
	 * @private
	 */
	private async discoverPerformers(): Promise<Performer[]> {
		const discoveredPerformers: Performer[] = [];
		const endpoints = this.getRegistryEndpoints();
		
		// Query each registry
		for (const registryUrl of endpoints) {
			try {
				const performers = await this.queryRegistry(registryUrl);
				discoveredPerformers.push(...performers);
			} catch (error) {
				Log.error(this.registryServiceLogger, `📋 Failed to query registry ${registryUrl}:`, error);
			}
		}

		// Deduplicate and update local cache
		const uniquePerformers = this.deduplicatePerformers(discoveredPerformers);
		this.updateLocalCache(uniquePerformers);
		
		return uniquePerformers;
	}

	/**
	 * Deduplicate performers by ID
	 * 
	 * When multiple registries return the same performer, keeps the one
	 * with the most recent lastSeen timestamp.
	 * 
	 * @param performers - Array of potentially duplicate performers
	 * @returns Array of unique performers
	 * @private
	 */
	private deduplicatePerformers(performers: Performer[]): Performer[] {
		const uniquePerformers = new Map<string, Performer>();
		
		for (const performer of performers) {
			const existing = uniquePerformers.get(performer.id);
			if (!existing || new Date(performer.lastSeen) > new Date(existing.lastSeen)) {
				uniquePerformers.set(performer.id, performer);
			}
		}
		
		return Array.from(uniquePerformers.values());
	}

	/**
	 * Update local performer cache
	 * 
	 * Clears the cache and replaces with new performer list.
	 * This is the intern's responsibility - they update the cache
	 * they were given by the coordinator.
	 * 
	 * @param performers - Array of performers to cache
	 * @private
	 */
	private updateLocalCache(performers: Performer[]): void {
		this.performerCache.clear();
		
		for (const performer of performers) {
			this.performerCache.set(performer.id, performer);
		}
	}

	/**
	 * Convert Performer to RegistryEntry
	 * 
	 * Transforms the internal Performer format to the lightweight
	 * RegistryEntry format used by the public API.
	 * 
	 * @param performer - Performer object to convert
	 * @returns RegistryEntry object
	 * @private
	 */
	private performerToRegistryEntry(performer: Performer): RegistryEntry {
		return {
			performerId: performer.id,
			territoryName: performer.territory,
			endpoint: `http://${performer.metadata.apiHost ?? 'localhost'}:${performer.metadata.apiPort ?? 27123}`,
			capabilities: performer.capabilities,
			lastSeen: performer.lastSeen,
			metadata: performer.metadata
		};
	}

	// ========================================================================
	// HTTP UTILITIES
	// ========================================================================

	/**
	 * Make API request with authentication
	 * 
	 * Constructs and executes HTTP request to registry endpoint.
	 * Uses the endpoint manager's circuit breaker for reliability.
	 * 
	 * @param baseUrl - Registry base URL
	 * @param endpoint - API endpoint path
	 * @param method - HTTP method (GET, POST, PUT, DELETE)
	 * @param apiKey - API key for authentication (or null)
	 * @param data - Request body data (optional)
	 * @returns Response object
	 * @throws Error if request fails after retries
	 * @private
	 */
	private async makeAPIRequest(
		baseUrl: string,
		endpoint: string,
		method: string,
		apiKey: string | null,
		data?: any
	): Promise<Response> {
		const url = `${baseUrl}${endpoint}`;
		const headers: Record<string, string> = {
			'Content-Type': 'application/json'
		};

		// Add authentication if API key provided
		if (apiKey) {
			headers['Authorization'] = `Bearer ${apiKey}`;
		}

		const requestOptions: RequestInit & { timeoutMs?: number } = {
			method,
			headers,
			...(data && { body: JSON.stringify(data) }),
			timeoutMs: 5000 // 5 second timeout
		};

		// Use endpoint manager's circuit breaker
		return this.endpointManager.executeEndpoint(baseUrl, () =>
			fetchWithRetry(url, requestOptions, 2, 200)
		);
	}

	// ========================================================================
	// CLEANUP
	// ========================================================================

	/**
	 * Clean up registry service
	 * 
	 * Stops heartbeat, clears cache, and resets state.
	 * Should be called when the service is no longer needed.
	 */
	async cleanup(): Promise<void> {
		this.stopHeartbeat();
		await this.performerCache.cleanup();
		this.currentPerformer = null;
		this.currentApiKeyMap.clear();
		Log.log(this.registryServiceLogger, '📋 Carnival Registry Service: Cleanup complete');
	}
}