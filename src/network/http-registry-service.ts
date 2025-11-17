/**
 * ============================================================================
 * HTTP REGISTRY SERVICE - Territory Registration & Discovery
 * ============================================================================
 * 
 * Manages network topology through HTTP/HTTPS registry endpoints, enabling dynamic
 * discovery of carnival territories and maintaining synchronized operational
 * intelligence across all connected vault performers. Handles registration,
 * heartbeats, discovery, and TLS/security for network operations.
 * 
 * Core Responsibilities:
 * - Territory establishment (performer registration)
 * - Performer discovery via registry endpoints
 * - Periodic heartbeat transmission
 * - Territory abandonment (unregistration)
 * - TLS certificate management
 * - Registry endpoint health monitoring
 * - Local REST API integration
 * 
 * Architecture:
 * - Implements TerritoryServiceInterface
 * - Manages multiple registry endpoints (load distribution, fallback)
 * - Integrates with PersistentPerformerCache for discovered performers
 * - Uses RegistryEndpointManager for endpoint rotation/health
 * - Enforces HTTPS for non-localhost endpoints
 * - Stores TLS certificates via CertificateStore
 * 
 * Exports:
 * - HttpRegistryService (class) - Registry service implementation
 * 
 * Public API Methods (TerritoryServiceInterface):
 * 
 * Registration & Lifecycle:
 * - establishTerritory(territory: string, performerInfo: PerformerRegistrationInfo): Promise<void>
 *   Register current performer with all configured registries
 *   Builds full Performer object from registration info
 *   Extracts Local REST API settings (port, apiKey)
 *   Starts periodic heartbeat after successful registration
 *   Parallel registration to all endpoints (continues on partial failure)
 * 
 * - abandonTerritory(): Promise<void>
 *   Unregister from all registries
 *   Stops heartbeat intervals
 *   Sends DELETE to /carnival/network/registry on each endpoint
 *   Gracefully handles individual endpoint failures
 * 
 * - sendHeartbeat(): Promise<void>
 *   Send periodic heartbeat to registries
 *   Updates lastSeen timestamp
 *   Keeps performer registration alive
 *   Called automatically via heartbeat interval
 * 
 * Discovery:
 * - scoutTerritories(territory: string): Promise<RegistryEntry[]>
 *   Query all registries for performers in territory
 *   Aggregates results from all endpoints
 *   Caches discovered performers
 *   Returns: Unique list of performers
 * 
 * - findPerformers(criteria: {...}): RegistryEntry[]
 *   Search cached performers by id, name, territory, or capabilities
 *   Supports multiple criteria (AND logic)
 *   Returns: Matching performers from cache
 * 
 * Management:
 * - broadcastPerformerUpdate(performer: Performer): Promise<void>
 *   Notify registries of performer changes
 *   PUT to /carnival/network/registry
 *   Updates metadata, capabilities, status
 * 
 * - updateRegistryEndpoints(endpoints: string[]): void
 *   Runtime registry endpoint reconfiguration
 *   Filters non-HTTPS (except localhost)
 *   Updates RegistryEndpointManager
 * 
 * Utility:
 * - isAvailable(): boolean
 *   Check if service initialized and performer cache populated
 * 
 * - getAllPerformers(): RegistryEntry[]
 *   Get all cached performers
 *   Delegates to TerritoryAccessService
 * 
 * - cleanup(): void
 *   Stop all heartbeat intervals
 *   Close connections
 * 
 * Implementation Details:
 * - Implements: TerritoryServiceInterface (from carnival-service-types.ts)
 * - Used by: CarnivalPerformer
 * - Created in: CarnivalPerformer constructor
 * - Heartbeat: Configurable interval (default from config.heartbeatInterval)
 * - Registry Protocol: HTTP/HTTPS POST/PUT/DELETE to /carnival/network/registry
 * 
 * Dependencies:
 * - PersistentPerformerCache - Stores discovered performers
 * - RegistryEndpointManager - Manages endpoint health and rotation
 * - CertificateStore - TLS certificate management
 * - fetchWithRetry - Network requests with retry logic
 * - ValidationError, validateRegistryResponse, validatePerformers - Input validation
 * - App (Obsidian) - Access to Local REST API plugin settings
 * 
 * Registry Protocol:
 * 
 * Establishment (POST /carnival/network/registry):
 * Request: { performer: Performer, action: 'register' }
 * Response: { success: boolean, performers?: Performer[] }
 * 
 * Heartbeat (PUT /carnival/network/registry):
 * Request: { performer: Performer, action: 'heartbeat' }
 * Response: { success: boolean }
 * 
 * Abandonment (DELETE /carnival/network/registry):
 * Request: { performer: Performer, action: 'unregister' }
 * Response: { success: boolean }
 * 
 * Discovery (GET /carnival/network/territory/{territory}):
 * Response: { performers: RegistryEntry[] }
 * 
 * TLS/Security:
 * - Enforces HTTPS for all non-localhost endpoints
 * - Supports custom CA certificates (config.tlsConfig.caCertPath/Content)
 * - Supports mTLS (config.tlsConfig.clientCert/Key)
 * - Optional self-signed certificate acceptance (config.tlsConfig.allowSelfSigned)
 * - Certificate validation configurable (config.tlsConfig.validateCert)
 * - SNI support (config.tlsConfig.serverName)
 * 
 * Endpoint Filtering:
 * Initialization filters registry endpoints:
 * ✅ https://* - Always accepted
 * ✅ http://localhost:* - Development/local
 * ✅ http://127.0.0.1:* - Development/local
 * ❌ http://* (other) - Rejected with warning
 * 
 * Heartbeat Management:
 * - Interval stored per performerId in Map<string, interval>
 * - startHeartbeat(): Creates setInterval
 * - stopHeartbeat(): Clears all intervals
 * - Automatic retry on heartbeat failure (via fetchWithRetry)
 * - Continues on partial registry failures
 * 
 * Error Handling:
 * - Registration: Logs per-endpoint failures, continues to next
 * - Discovery: Aggregates from successful registries only
 * - Heartbeat: Logs failures but doesn't throw
 * - TLS errors: Detailed logging with certificate info
 * - Validation errors: Throws ValidationError for invalid responses
 * 
 * Performance Characteristics:
 * - Parallel registration/heartbeat (Promise.allSettled)
 * - Cached performer lookup (O(1))
 * - Discovery aggregation (deduplicates by performerId)
 * - Endpoint health tracked by RegistryEndpointManager
 * - Automatic endpoint rotation on failures
 * 
 * Configuration Integration:
 * - Reads Local REST API plugin settings (port, apiKey)
 * - Uses config.registryEndpoints for initial endpoint list
 * - Respects config.tlsConfig for HTTPS behavior
 * - Applies config.heartbeatInterval for periodic updates
 * - Uses config.communicationTimeout for requests
 * 
 * Lifecycle:
 * - constructor(): Initialize registry, detect Local REST API
 * - establishTerritory(): Register and start heartbeat
 * - [ongoing]: Periodic heartbeats
 * - abandonTerritory(): Unregister and stop heartbeats
 * - cleanup(): Final teardown
 * 
 * @see carnival-service-types.ts - TerritoryServiceInterface definition
 * @see carnival-grounds-types.ts - RegistryEntry, Territory types
 * @see carnival-performers-types.ts - Performer, PerformerRegistrationInfo types
 * @see persistent-performer-cache.ts - Performer storage
 * @see carnival-performer.ts - Primary consumer
 * @see registry-endpoint-manager.ts - Endpoint health management
 * @see certificate-store.ts - TLS certificate storage
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
import { App } from 'obsidian';
import { Log } from '../utils/logger';
import {
	fetchWithRetry
} from './http-client';
import {
	validateRegistryResponse,
	validatePerformers,
	ValidationError
} from './validation';
import { RegistryEndpointManager } from './registry-endpoint-manager';
import { certificateStore } from './certificate-store';
import { PersistentPerformerCache } from './persistent-performer-cache.js';
import type { TrustedCertificate } from '../types/internal';
import type {
	APIKeyStorage,
	CarnivalConfig,
	Performer,
	RegistryEntry,
	PerformerRegistrationInfo,
	TerritoryServiceInterface,
	TLSConfig
} from '../types/public';


const httpRegistryLogger = {
	context: 'HTTP Registry Service Class',
	path: '/.obsidian/plugins/carnival-records/src/network/http-registry-service'
};

/**
 * 📡 HTTP Registry Service - Centralized performer discovery and coordination
 * 
 * This service manages network topology through HTTP/s endpoints, enabling
 * dynamic discovery of carnival territories and maintaining synchronized
 * operational intelligence across all connected vault performers.
 */
export class HttpRegistryService implements TerritoryServiceInterface {
	private app: App;
	private config: CarnivalConfig;
	private registryEndpoints: string[] = [];
	private localApiPort: number = 27123;
	private localApiKey: string = '';
	private heartbeatIntervals: Map<string, ReturnType<typeof setInterval>> = new Map();
	private endpointManager?: RegistryEndpointManager;
	private tlsConfig?: TLSConfig;
	private storage: APIKeyStorage;
	private performerCache: PersistentPerformerCache;
	private currentPerformer: Performer | null = null;

	constructor(
		app: App,
		config: CarnivalConfig,
		storage: APIKeyStorage,
		performerCache: PersistentPerformerCache
	) {
		this.app = app;
		this.config = config;
		this.storage = storage;
		this.performerCache = performerCache;
		this.tlsConfig = config.tlsConfig;
		
		this.initializeRegistry();
	}

	/**
	 * Initialize registry service
	 */
	private initializeRegistry(): void {
		try {
			// Get Local REST API configuration
			const { plugins } = (this.app as any);
			const restApiPlugin = plugins.plugins['obsidian-local-rest-api'];
			
			if (restApiPlugin?.enabled) {
				const apiSettings = restApiPlugin.settings;
				this.localApiPort = apiSettings.port ?? 27123;
				this.localApiKey = apiSettings.apiKey ?? '';
			}

			// Initialize default registry endpoints
			// Initialize default registry endpoints. If the config provides a readonly
			// array we copy it into an internal mutable array so the service can
			// manage (filter/update) endpoints without mutating the original config.
			const seededEndpoints = Array.isArray(this.config.registryEndpoints)
				? [...this.config.registryEndpoints]
				: [
					'http://localhost:27123', // Local registry
					...this.getDefaultRegistryEndpoints()
				];

			this.registryEndpoints = seededEndpoints;

			// Enforce HTTPS for all endpoints except localhost/dev
			this.registryEndpoints = this.registryEndpoints.filter(ep => {

				if (ep.startsWith('https://')) {
					return true;
				}

				if (ep.startsWith('http://localhost') || ep.startsWith('http://127.0.0.1')) {
					return true;
				}

				Log.warn(httpRegistryLogger, `Registry endpoint not using HTTPS and will be ignored: ${ep}`);
				return false;
			});

			// Initialize endpoint manager after registry endpoints are known
			this.endpointManager = new RegistryEndpointManager(this.registryEndpoints);

			Log.log(httpRegistryLogger, '📡 HTTP Registry Service: Initialized with endpoints:', this.registryEndpoints);
		} catch (error) {
			Log.error(httpRegistryLogger, '📡 HTTP Registry Service: Initialization failed:', error);
		}
	}

	/**
	 * ============================================================================
	 * PUBLIC API - TerritoryServiceInterface Implementation
	 * ============================================================================
	 */

	/**
	 * Unregister performer from registries
	 */
	async abandonTerritory(): Promise<void> {
		const currentPerformer = await this.getCurrentPerformerInfo();
		
		this.stopHeartbeat();

		for (const registryUrl of this.registryEndpoints) {
			try {
				await this.makeAPIRequest(registryUrl, '/carnival/network/registry', 'DELETE', {
					performer: currentPerformer,
					action: 'unregister'
				});
			} catch (error) {
				Log.error(httpRegistryLogger, `📡 Failed to unregister from ${ registryUrl }:`, error);
			}
		}
	}

	/**
	 * Broadcast performer update to registries
	 */
	async broadcastPerformerUpdate(updatedPerformer: Performer): Promise<void> {
		for (const registryUrl of this.registryEndpoints) {
			try {
				await this.makeAPIRequest(registryUrl, '/carnival/network/registry', 'PUT', {
					performer: updatedPerformer,
					action: 'update'
				});
			} catch (error) {
				Log.error(httpRegistryLogger, `📡 Failed to update performer in ${ registryUrl }:`, error);
			}
		}
	}

	/**
	 * Register current performer with network registries
	 */
	async establishTerritory(territory: string, performerInfo: PerformerRegistrationInfo): Promise<void> {
		// Build a full Performer object
		const performer: Performer = {
			id: performerInfo.performerId,
			name: this.app.vault.getName(),
			territory: performerInfo.territoryName,
			lastSeen: new Date().toISOString(),
			capabilities: performerInfo.capabilities,
			metadata: {
				apiHost: 'localhost',
				apiPort: this.localApiPort,
				useHttps: false,
				...(performerInfo.metadata ?? {})
			}
		};
		
		for (const registryUrl of this.registryEndpoints) {
			try {
				await this.registerWithRegistry(registryUrl, performer);
				Log.log(httpRegistryLogger, `📡 Registered with registry: ${ registryUrl }`);
			} catch (error) {
				Log.error(httpRegistryLogger, `📡 Failed to register with ${registryUrl}:`, error);
			}
		}

		// Start periodic heartbeat
		this.startHeartbeat();
	}

	/**
	 * Find performer by criteria
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
		
		for (const performer of this.performerCache.values()) {
			let matches = true;

			switch(true) {
				case criteria.id && performer.id !== criteria.id:
					matches = false;
					break;
				case criteria.name && performer.name !== criteria.name:
					matches = false;
					break;
				case criteria.territory && performer.territory !== criteria.territory:
					matches = false;
					break;
				default:
					break;
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
	 * Find performers by territory
	 */
	findPerformersByTerritory(territory: string): Performer[] {
		return this.performerCache.values()
			.filter(performer => performer.territory === territory);
	}

	getAllPerformers(): RegistryEntry[] {
		return this.performerCache.values().map(p => this.performerToRegistryEntry(p));
	}

	/**
	 * Return health states for registry endpoints (circuit breaker states)
	 */
	getRegistryHealth(): { [endpoint: string]: string } {
		const health: { [endpoint: string]: string } = {};

		if (!this.endpointManager) {
			return health;
		}

		const states = this.endpointManager.getEndpointStates();
		for (const [endpoint, state] of states) {
			health[endpoint] = state;
		}
		return health;
	}

	/**
	 * Return simple metrics per registry endpoint
	 */
	getRegistryMetrics(): Record<string, { requests: number; successes: number; failures: number }> {

		if (!this.endpointManager) {
			return {};
		}

		return this.endpointManager.getMetrics();
	}

	isAvailable(): boolean {
		return this.registryEndpoints.length > 0 && this.currentPerformer !== null;
	}

	async scoutTerritories(territory: string): Promise<RegistryEntry[]> {
		const performers = await this.discoverPerformers();

		Log.log(httpRegistryLogger, `📡 Discovered ${ performers.length } performers across registries`);

		return performers
			.filter(p => p.territory === territory)
			.map(p => this.performerToRegistryEntry(p));
	}

	/**
	 * Send heartbeat to all registries
	 */
	async sendHeartbeat(): Promise<void> {
		const currentPerformer = await this.getCurrentPerformerInfo();
		
		for (const registryUrl of this.registryEndpoints) {
			try {
				await this.makeAPIRequest(registryUrl, '/carnival/network/heartbeat', 'POST', {
					performer: currentPerformer,
					timestamp: new Date().toISOString()
				});
				Log.log(httpRegistryLogger, `📡 Heartbeat sent to ${ registryUrl }`);
			} catch (error) {
				Log.error(httpRegistryLogger, `📡 Heartbeat failed for ${ registryUrl }:`, error);
			}
		}
	}

	/***********************
	 * HEARTBEAT UTILITIES *
	 ***********************/

	/**
	 * Start heartbeat to maintain registry presence
	 */
	private startHeartbeat(): void {
		// Clear any existing heartbeat
		this.stopHeartbeat();

		// Send heartbeat every 30 seconds
		const heartbeatInterval = setInterval(async () => {
			await this.sendHeartbeat();
		}, 30000);

		this.heartbeatIntervals.set('main', heartbeatInterval);
	}

	/**
	 * Stop heartbeat
	 */
	private stopHeartbeat(): void {
		for (const interval of this.heartbeatIntervals.values()) {
			clearInterval(interval);
		}
		this.heartbeatIntervals.clear();
	}

	/***************************
	 * NODE REGISTRY UTILITIES *
	 ***************************/

	/**
	 * Count active registries
	 */
	private async countActiveRegistries(): Promise<number> {
		let activeCount = 0;

		// If we have an endpoint manager, rely on its state instead of probing every registry
		if (this.endpointManager) {
			const states = this.endpointManager.getEndpointStates();

			for (const [, state] of states) {

				if (state === 'CLOSED') {
					activeCount++;
				}

			}

			return activeCount;
		}

		// Fallback: probe each registry
		for (const registryUrl of this.registryEndpoints) {
			try {
				const response = await this.makeAPIRequest(registryUrl, '/ping', 'GET');

				if (response.ok) {
					activeCount++;
				}

			} catch(error) {
				Log.error(httpRegistryLogger, 'Registry not responding', error);
			}
		}

		return activeCount;
	}

	/**
	 * Get default registry endpoints based on common carnival configurations
	 */
	private getDefaultRegistryEndpoints(): string[] {
		return [
			'http://192.168.1.100:27123', // Common local network address
			'http://10.0.0.100:27123',    // Alternative local network
			// Add more known carnival territory endpoints
		];
	}

	/**
	 * Get secure API key for registry authentication
	 */
	private async getRegistryAPIKey(registryUrl: string): Promise<string | null> {
		try {
			// Try to get registry-specific key first
			const registryKey = await this.storage.retrieve(`registry_${registryUrl}`);

			if (registryKey) {
				return registryKey;
			}

			// Fall back to local API key
			return this.localApiKey || null;

		} catch (error) {
			Log.warn(httpRegistryLogger, 'Failed to retrieve secure API key:', error);
			return this.localApiKey || null;
		}
	}

	/**
	 * Query specific registry for performers
	 */
	private async queryRegistry(registryUrl: string): Promise<Performer[]> {
		const endpoint = '/carnival/network/registry';
		const response = await this.makeAPIRequest(registryUrl, endpoint, 'GET');
		
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
				Log.error(httpRegistryLogger, `📡 Invalid response from registry ${registryUrl}:`, error);
				// Re-throw with context about which registry had the problem
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
	 */
	private async registerWithRegistry(registryUrl: string, performer: Performer): Promise<void> {
		const endpoint = '/carnival/network/registry';
		const response = await this.makeAPIRequest(registryUrl, endpoint, 'POST', {
			performer: performer,
			action: 'register'
		});

		if (!response.ok) {
			throw new Error(`Registration failed: ${response.status}`);
		}
	}

	/**
	 * Remove stored API key for registry
	 */
	async removeRegistryAPIKey(registryUrl: string): Promise<void> {
		try {
			await this.storage.remove(`registry_${registryUrl}`);
			Log.log(httpRegistryLogger, `Removed secure API key for registry: ${registryUrl}`);
		} catch (error) {
			Log.error(httpRegistryLogger, 'Failed to remove secure API key:', error);
			throw error;
		}
	}

	/**
	 * Store secure API key for registry
	 */
	async storeRegistryAPIKey(registryUrl: string, apiKey: string): Promise<void> {
		try {
			await this.storage.store(`registry_${registryUrl}`, apiKey);
			Log.log(httpRegistryLogger, `Stored secure API key for registry: ${registryUrl}`);
		} catch (error) {
			Log.error(httpRegistryLogger, 'Failed to store secure API key:', error);
			throw error;
		}
	}

	/**
	 * Update local performer registry
	 */
	private updateLocalCache(performers: Performer[]): void {
		this.performerCache.clear();
		
		for (const performer of performers) {
			this.performerCache.set(performer.id, performer);
		}
	}

	/**
	 * Get registered performers from local cache
	 */
	getRegisteredPerformers(): Performer[] {
		return this.performerCache.values();
	}

	/**
	 * Update the registry endpoints at runtime and refresh the endpoint manager
	 */
	updateRegistryEndpoints(endpoints: string[]) {
		// Enforce HTTPS for all endpoints except localhost/dev
		const filteredEndpoints = endpoints.filter(ep => {

			if (ep.startsWith('https://')) {
				return true;
			}

			if (ep.startsWith('http://localhost') || ep.startsWith('http://127.0.0.1')) {
				return true;
			}

			Log.warn(httpRegistryLogger, `Registry endpoint not using HTTPS and will be ignored: ${ep}`);
			return false;
		});

		this.registryEndpoints = filteredEndpoints;

		if (this.endpointManager) {
			this.endpointManager.updateEndpoints(filteredEndpoints);
		} else {
			this.endpointManager = new RegistryEndpointManager(filteredEndpoints);
		}

		Log.log(httpRegistryLogger, '📡 Registry endpoints updated:', filteredEndpoints);
	}

	/**************************
	 * NETWORK NODE UTILITIES *
	 **************************/

	/**
	 * Deduplicate performers by ID
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
	 * Discover all network performers across registries
	 */
	private async discoverPerformers(): Promise<Performer[]> {
		const discoveredPerformers: Performer[] = [];
		
		for (const registryUrl of this.registryEndpoints) {
			try {
				const performers = await this.queryRegistry(registryUrl);
				discoveredPerformers.push(...performers);
			} catch (error) {
				Log.error(httpRegistryLogger, `📡 Failed to query registry ${ registryUrl }:`, error);
			}
		}

		// Deduplicate and update local registry
		const uniquePerformers = this.deduplicatePerformers(discoveredPerformers);
		this.updateLocalCache(uniquePerformers);
		
		return uniquePerformers;
	}

	/**
	 * Generate performer ID from path
	 */
	private generatePerformerIdFromPath(vaultPath: string): string {
		const hash = this.simpleHash(vaultPath);
		return `carnival-performer-${hash}`;
	}

	/**
	 * Get current performer information
	 */
	private async getCurrentPerformerInfo(): Promise<Performer> {
		const { vault } = this.app;
		const vaultPath = (vault.adapter as any).path;
		const territory = this.detectTerritory(vaultPath);
		
		return {
			id: this.generatePerformerIdFromPath(vaultPath),
			name: vault.getName(),
			territory,
			capabilities: await this.detectCapabilities(),
			lastSeen: new Date().toISOString(),
			metadata: {
				apiHost: 'localhost',
				apiPort: this.localApiPort,
				useHttps: false,
				vaultPath,
				platform: this.detectPlatform(),
				version: '1.0.0'
			}
		};
	}

	/**
	 * Convert Performer to RegistryEntry (lightweight registry format)
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

	/***********************************
	 * CERTIFICATE AND STORE UTILITIES *
	 ***********************************/

	/**
	 * Add certificate to trust store
	 */

	/* eslint-disable require-await */
	async addTrustedCertificate(
		certPEM: string, 
		endpoints: string[], 
		trustLevel: 'full' | 'conditional' = 'full',
		notes?: string
	): Promise<{ success: boolean; error?: string; fingerprint?: string }> {
		try {
			const certInfo = certificateStore.parseCertificate(certPEM);

			if (!certInfo) {
				return { success: false, error: 'Failed to parse certificate' };
			}

			certificateStore.trustCertificate(certInfo, endpoints, trustLevel, notes);
			Log.log(httpRegistryLogger, `Added trusted certificate: ${certInfo.commonName}`);
			
			return {
				success: true,
				fingerprint: certInfo.fingerprint
			};

		} catch (error: any) {
			Log.error(httpRegistryLogger, 'Failed to add trusted certificate:', error);
			return {
				success: false,
				error: error.message 
			};

		}
	}
	/* eslint-enable require-await */

	/**
	 * Export certificate trust store
	 */
	exportTrustStore(): string {
		return certificateStore.exportTrustStore();
	}

	/**
	 * Get certificate health status
	 */
	getCertificateHealth(): {
		total: number;
		expiringSoon: number;
		expired: number;
		revoked: number;
		healthy: number;
	} {
		return certificateStore.getCertificateHealth();
	}

	/**
	 * Get all trusted certificates
	 */
	getTrustedCertificates(): TrustedCertificate[] {
		return certificateStore.getTrustedCertificates();
	}

	/**
	 * Import certificate trust store
	 */
	importTrustStore(importData: string): { imported: number; errors: string[] } {
		const result = certificateStore.importTrustStore(importData);
		Log.log(httpRegistryLogger, `Imported ${result.imported} certificates with ${result.errors.length} errors`);
		return result;
	}

	/**
	 * Remove certificate from trust store
	 */
	revokeCertificate(fingerprint: string, reason?: string): void {
		certificateStore.revokeCertificate(fingerprint, reason);
		Log.log(httpRegistryLogger, `Revoked certificate: ${fingerprint} - ${reason ?? 'No reason provided'}`);
	}

	/******************
	 * MISC UTILITIES *
	 ******************/

	/**
	 * Detect performer capabilities
	 */
	private detectCapabilities(): Promise<string[]> {
		const capabilities = ['http_communication', 'record_sync'];
		
		// Check for plugin-specific capabilities
		const { plugins } = (this.app as any);
		
		if (plugins.plugins['obsidian-local-rest-api']?.enabled) {
			capabilities.push('rest_api');
		}
		
		if (plugins.plugins['templater-obsidian']?.enabled) {
			capabilities.push('templating');
		}
		
		if (plugins.plugins['dataview']?.enabled) {
			capabilities.push('dataview_queries');
		}

		return Promise.resolve(capabilities);
	}

	/**
	 * Detect platform
	 */
	private detectPlatform(): string {
		// Detect platform from process or navigator
		if (typeof window !== 'undefined') {
			const userAgent = window.navigator.userAgent.toLowerCase();

			switch (true) {
				case userAgent.includes('mac'):
					return 'macos';
				case userAgent.includes('win'):
					return 'windows';
				case userAgent.includes('linux'):
					return 'linux';
			}
		}

		return 'unknown';
	}

	/**
	 * Detect territory from vault path
	 */
	private detectTerritory(vaultPath: string): string {
		const path = vaultPath.toLowerCase();

		switch (true) {
			case path.includes('necropolis'):
				return 'necropolis';
			case path.includes('backstage'):
				return 'backstage';
			case path.includes('boutique'):
				return 'boutique';
			case path.includes('athenaeum'):
				return 'athenaeum';
			case path.includes('carnival'):
				return 'carnival-main';
			default:
				return 'unknown';
		}
	}

	/**
	 * Get network topology overview
	 */
	async getNetworkTopology(): Promise<{
		totalPerformers: number;
		territories: { [territory: string]: number };
		capabilities: { [capability: string]: number };
		activeRegistries: number;
	}> {
		const performers = this.getRegisteredPerformers();
		const territories: { [territory: string]: number } = {};
		const capabilities: { [capability: string]: number } = {};

		for (const performer of performers) {
			// Count by territory
			territories[performer.territory] = (territories[performer.territory] || 0) + 1;
			
			// Count by capabilities
			for (const capability of performer.capabilities) {
				capabilities[capability] = (capabilities[capability] || 0) + 1;
			}
		}

		// Test registry availability
		const activeRegistries = await this.countActiveRegistries();

		return {
			totalPerformers: performers.length,
			territories,
			capabilities,
			activeRegistries
		};
	}

	/**
	 * Make API request with authentication and TLS configuration
	 */
	private async makeAPIRequest(
		baseUrl: string,
		endpoint: string,
		method: string,
		data?: any
	): Promise<Response> {
		const url = `${ baseUrl }${ endpoint }`;
		const headers: Record<string, string> = {
			'Content-Type': 'application/json'
		};

		// Get API key securely
		const apiKey = await this.getRegistryAPIKey(baseUrl);
		if (apiKey) {
			headers['Authorization'] = `Bearer ${apiKey}`;
		}

		// Convert CarnivalConfig tlsConfig to TLSConfig
		const tlsConfig: TLSConfig | undefined = this.tlsConfig ? {
			enabled: this.tlsConfig.enabled,
			caCertPath: this.tlsConfig.caCertPath,
			clientCertPath: this.tlsConfig.clientCertPath,
			clientKeyPath: this.tlsConfig.clientKeyPath,
			allowSelfSigned: this.tlsConfig.allowSelfSigned,
			validateCert: this.tlsConfig.validateCert
		} : undefined;

		const requestOptions: RequestInit & { timeoutMs?: number; tlsConfig?: TLSConfig } = {
			method,
			headers,
			...(data && { body: JSON.stringify(data) }),
			timeoutMs: this.config.communicationTimeout ?? 5000,
			tlsConfig
		};

		const maxRetries = this.config.maxRetries ?? 2;
		const retryBaseDelayMs = this.config.retryBaseDelayMs ?? 200;

		if (this.endpointManager) {
			// Use the circuit-breaker backed executor
			return this.endpointManager.executeEndpoint(baseUrl, () =>
				fetchWithRetry(url, requestOptions, maxRetries, retryBaseDelayMs)
			);
		}

		// Redact sensitive parts when logging endpoint
		const redactedUrl = url.replace(/(apiKey=)[^&]*/i, '$1[REDACTED]');
		const redactedHeaders = { ...headers };
		if (redactedHeaders['Authorization']) {
			redactedHeaders['Authorization'] = 'Bearer [REDACTED]';
		}
		Log.log(httpRegistryLogger, `Making request to ${redactedUrl}`, { 
			method, 
			headers: redactedHeaders,
			tlsEnabled: !!tlsConfig,
			mTLSEnabled: !!(tlsConfig?.clientCertPath ?? tlsConfig?.clientCertContent)
		});

		return fetchWithRetry(url, requestOptions, maxRetries, retryBaseDelayMs);
	}

	/**
	 * Simple hash function
	 */
	private simpleHash(str: string): string {
		let hash = 0;
		for (let i = 0; i < str.length; i++) {
			const char = str.charCodeAt(i);
			hash = ((hash << 5) - hash) + char;
			hash = hash & hash;
		}
		return Math.abs(hash).toString(36);
	}

	/**
	 * Clean up registry service
	 */
	async cleanup(): Promise<void> {
		await this.abandonTerritory();
		this.stopHeartbeat();
		await this.performerCache.cleanup();
		Log.log(httpRegistryLogger, '📡 HTTP Registry Service: Cleanup complete');
	}
}