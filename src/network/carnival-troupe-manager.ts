/**
 * ============================================================================
 * CARNIVAL TROUPE MANAGER - Network Performer Collection Management
 * ============================================================================
 * 
 * Manages the troupe of performers (collection of CarnivalPerformer instances)
 * and provides public API methods for the Carnival Network plugin lifecycle.
 * This module handles performer registration, tracking, and cleanup across the
 * entire carnival network.
 * 
 * Architecture:
 * - Maintains activePerformers Map in CarnivalNetworkPlugin
 * - Creates and tracks CarnivalPerformer instances
 * - Handles observability configuration
 * - Manages registry endpoint updates
 * 
 * Core Responsibilities:
 * - Performer lifecycle (join/leave carnival)
 * - Troupe membership tracking
 * - Observability provider initialization
 * - Registry endpoint configuration
 * - Settings persistence
 * 
 * Exports:
 * 
 * Public API Functions (bound to CarnivalNetworkPlugin context):
 * - getPerformers(): string[] - List all active performer IDs
 * - hasPerformer(performerId: string): boolean - Check if performer exists
 * - initializeAPIRouter: void - onload() method to instantiate API routes
 * - joinCarnival(performerId, storage, config): CarnivalPerformerInterface - Add performer
 * - leaveCarnival(performerId: string): Promise<void> - Remove performer
 * 
 * Private Helper Functions (internal use):
 * - applyObservabilityConfig(): Promise<void> - Configure metrics and monitoring
 * - setRegistryEndpoints(endpoints: string[]): Promise<void> - Update registry list
 * 
 * Function Details:
 * 
 * getPerformers():
 * - Returns array of all active performer IDs
 * - Accesses: this.activePerformers.keys()
 * - Used for: Listing current troupe members
 * 
 * hasPerformer(performerId):
 * - Checks if specific performer is active
 * - Accesses: this.activePerformers.has(performerId)
 * - Used for: Preventing duplicate registrations
 * 
 * joinCarnival(performerId, storage, config):
 * - Creates new CarnivalPerformer instance
 * - Adds to this.activePerformers Map
 * - Updates this.settings.registeredPerformers
 * - Returns: CarnivalPerformerInterface for plugin use
 * - Called by: CarnivalNetworkPlugin.joinCarnival() (main.ts)
 * - Validates: Local REST API plugin dependency
 * 
 * leaveCarnival(performerId):
 * - Retrieves performer from this.activePerformers
 * - Calls performer.cleanup()
 * - Removes from Map and settings
 * - Called by: CarnivalNetworkPlugin.leaveCarnival() (main.ts)
 * 
 * applyObservabilityConfig():
 * - Initializes/reinitializes observability provider
 * - Registers /carnival/metrics endpoint with Local REST API plugin
 * - Accesses: this.settings.observability config
 * - Called by: CarnivalNetworkPlugin.onload() (main.ts)
 * 
 * setRegistryEndpoints(endpoints):
 * - Updates registry endpoints in settings
 * - Notifies active HttpRegistryService instances
 * - Persists to vault storage
 * - Called by: Settings UI when user updates endpoints
 * 
 * Context Binding:
 * All exported functions use `this` context bound to CarnivalNetworkPlugin instance.
 * This provides access to:
 * - this.app - Obsidian App instance
 * - this.activePerformers - Map<string, CarnivalPerformer>
 * - this.settings - CarnivalConfig
 * - this.saveSettings() - Persistence method
 * - this.observabilityProvider - ObservabilityProvider instance
 * - this.localRestApiPublicApi - Local REST API plugin interface
 * 
 * Implementation Pattern:
 * Functions are exported and bound in main.ts:
 * ```typescript
 * joinCarnival(performerId, storage, config) {
 *     return joinCarnival.call(this, performerId, storage, config);
 * }
 * ```
 * 
 * Dependencies:
 * - CarnivalPerformer - Performer class (carnival-performer.ts)
 * - ObservabilityProviderFactory - Creates monitoring providers
 * - registerMetricsEndpoint - Metrics endpoint registration
 * 
 * Used by:
 * - main.ts - CarnivalNetworkPlugin (primary consumer)
 * - settings-tab.ts - Settings UI (setRegistryEndpoints)
 * 
 * @see main.ts - Plugin integration and context binding
 * @see carnival-performer.ts - Performer implementation
 * @see carnival-performer-types.ts - Type definitions
 */

import { CarnivalPerformer } from './carnival-performer';
import { APIRouter } from '../api/api-router';
import { registerMetricsEndpoint } from './services/observability/metrics';
import { ObservabilityProviderFactory } from './services/observability';
import { Log } from '../utils/logger';
import { getPlugin } from '../utils/plugin-utils';
import type {
	APIKeyStorage,
	CarnivalConfig,
	CarnivalPerformerInterface,
	LocalRestAPIPublic
} from '../types/public';

const networkLogger = {
	context: 'Carnival Network',
	path: '.obsidian/plugins/carnival-network/network/carnival-network.ts'
};

/**
 * ============================================================================
 * Initialize API Router
 * ============================================================================
 * 
 * Creates and registers the external REST API router with the Local REST API
 * plugin. This function is called during plugin initialization (onload).
 * 
 * @example
 * ```typescript
 * // In main.ts onload():
 * this.app.workspace.onLayoutReady(async () => {
 *   await initializeAPIRouter.call(this);
 * });
 * ```
 */
export async function initializeAPIRouter(): Promise<void> {
	try {
		// Get Local REST API plugin
		const localRestPlugin = getPlugin(this.app, 'obsidian-local-rest-api');
		
		if (!localRestPlugin) {
			Log.warn(networkLogger, 'Local REST API plugin not found - API routes not registered');
			return;
		}

		// Get public API from Local REST API plugin
		const restAPI = localRestPlugin.getPublicApi?.(this.manifest);
		
		if (!restAPI) {
			Log.warn(networkLogger, 'Could not get Local REST API public API');
			return;
		}

		// Create and register API router
		this.apiRouter = new APIRouter(this.app, this);
		this.apiRouter.registerRoutes(restAPI);
		
		Log.log(networkLogger, '🎪 API router initialized successfully');
	} catch (error) {
		Log.error(networkLogger, 'Failed to initialize API router:', error);
	}
}

/**
 * ============================================================================
 * Public API: Create a network client for a consuming plugin
 * ============================================================================
 * 
 * @param performerId - Unique identifier for the consuming plugin (e.g., 'carnival-records')
 * @param storage - APIKeyStorage instance from Secure Storage plugin
 * @param config - Network configuration
 * @returns CarnivalPerformerInterface - Network client interface for the consuming plugin
 * 
 * @example
 * ```typescript
 * const networkPlugin = app.plugins.plugins['carnival-network'];
 * const client = networkPlugin.joinCarnival(
 *   'my-plugin',
 *   secureStorage,
 *   {
 *     maxRetries: 3,
 *     communicationTimeout: 5000,
 *     // ... other config
 *   }
 * );
 * await client.enterRing(); // Initialize
 * ```
 */
/**
 * Get list of plugins currently performing in the carnival
 */
export function getPerformers(): string[] {
	return Array.from(this.activePerformers.keys());
}

/**
 * Check if a specific plugin has an active performer
 */
export function hasPerformer(performerId: string): boolean {
	return this.activePerformers.has(performerId);
}

export function joinCarnival(
	performerId: string,
	storage: APIKeyStorage,
	config: CarnivalConfig
): CarnivalPerformerInterface {
	// Check if performer already exists
	if (this.activePerformers.has(performerId)) {
		Log.warn(networkLogger, `🎭 Performer already exists for: ${performerId}`);
		return this.activePerformers.get(performerId) as CarnivalPerformerInterface;
	}

	// Verify dependencies before creating client
	const localRestApi = getPlugin(this.app, 'obsidian-local-rest-api');
	
	if (!localRestApi) {
		throw new Error(
			'🎪 Carnival Network requires "Local REST API" plugin. ' +
			'Please install it from Community Plugins to join the show!'
		);
	}

	// Create new network client (performer)
	const performer = new CarnivalPerformer(
		this.app,
		config,
		storage,
		performerId
	);

	// Track the performer
	this.activePerformers.set(performerId, performer);
	
	// Update settings
	if (!this.settings.registeredPerformers.includes(performerId)) {
		this.settings.registeredPerformers.push(performerId);
		this.saveSettings();
	}

	Log.log(networkLogger, `🎭 New performer joined the carnival: ${performerId}`);

	return performer;
}

/**
 * Remove a performer (cleanup without destroying it)
 */
export async function leaveCarnival(performerId: string): Promise<void> {
	const performer = this.activePerformers.get(performerId);
	if (performer) {
		await performer.cleanup();
		this.activePerformers.delete(performerId);
		
		// Update settings
		this.settings.registeredPerformers = this.settings.registeredPerformers.filter(
			(id: string) => id !== performerId
		);
		await this.saveSettings();

		Log.log(networkLogger, `🎭 Performer left the carnival: ${performerId}`);
	}
}

/**
 * ============================================================================
 * PRIVATE HELPERS
 * ============================================================================
 */

/**
 * Apply the current observability configuration: unregister any existing
 * metrics endpoint, cleanup existing provider, then register/initialize
 * according to the saved settings.
 */
export async function applyObservabilityConfig(): Promise<void> {
	// Cleanup existing provider
	try {
		if (this.observabilityProvider) {
			await this.observabilityProvider.cleanup();
			this.observabilityProvider = null;
		}
	} catch (err) {
		Log.warn(networkLogger, 'Error cleaning up previous observability provider:', err);
	}

	// Unregister previously registered metrics route (if any)
	try {
		if (this.localRestApiPublicApi && typeof this.localRestApiPublicApi.unregister === 'function') {
			this.localRestApiPublicApi.unregister();
			this.localRestApiPublicApi = null;
		}
	} catch (err) {
		Log.warn(networkLogger, 'Error unregistering previous Local REST API extension:', err);
	}

	// Re-register according to new settings
	try {
		const obsCfg = this.settings?.observability;
		const localRestApi = getPlugin(this.app, 'obsidian-local-rest-api');

		if (localRestApi && obsCfg?.metricsEnabled) {
			const restApiAccessor = localRestApi as unknown as {
				getPublicApi?: (manifest: unknown) => unknown;
				getAPI?: (app: unknown, manifest: unknown) => unknown;
			};

			const publicApi = restApiAccessor.getPublicApi?.(this.manifest) ?? restApiAccessor.getAPI?.(this.app, this.manifest);
			if (publicApi) {
				this.localRestApiPublicApi = publicApi as LocalRestAPIPublic;
				registerMetricsEndpoint(this.localRestApiPublicApi);
			}
		}

		if (obsCfg?.enabled && obsCfg.provider) {
			this.observabilityProvider = await ObservabilityProviderFactory.createWithFallback(obsCfg);
			if (this.observabilityProvider) {
				Log.log(networkLogger, `📡 Observability provider ready: ${obsCfg.provider}`);
			}
		}
	} catch (err) {
		Log.warn(networkLogger, 'Failed to apply observability configuration:', err);
	}
}

/**
 * Update registry endpoints in saved settings and notify the runtime service.
 * Accepts the new endpoints array and persists it. If the runtime registry
 * service is active it will be asked to update its internal list.
 */
export async function setRegistryEndpoints(endpoints: string[]): Promise<void> {
	
	// Try to update legacy carnivalNetworkSettings if present (UI code uses it)
	type MaybeInternals = {
		carnivalNetworkSettings?: { network?: { registryEndpoints?: readonly string[] } };
		carnivalNetwork?: { getRegistryService?: () => { updateRegistryEndpoints?: (e: string[]) => void } };
	};

	try {

		const internals = this as unknown as MaybeInternals;

		if (internals.carnivalNetworkSettings?.network) {
			internals.carnivalNetworkSettings.network.registryEndpoints = endpoints;
		}

		// Update typed runtime settings as a fallback
		if (this.settings) {
			this.settings = Object.assign({}, this.settings, { registryEndpoints: endpoints });
		}

		await this.saveSettings();

		// Notify running carnival network (if initialized)
		const { carnivalNetwork } = internals;
		const svc = carnivalNetwork?.getRegistryService?.();
		if (svc?.updateRegistryEndpoints) {
			try {
				svc.updateRegistryEndpoints(endpoints);
			} catch (err) {
				Log.warn(networkLogger, 'Failed to notify registry service of endpoint change', err);
			}
		}
	
	} catch (err) {
		Log.error(networkLogger, 'Failed to set registry endpoints', err);
		throw err;
	}
}