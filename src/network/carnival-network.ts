/**
 * ============================================================================
 * PUBLIC API METHODS & PRIVATE HELPERS
 * ============================================================================
 * 
 * Index of exports:
 * - getPerformers
 * - hasTroupe
 * - joinCarnival
 * - leaveCarnival
 * - setRegistryEndpoints
 */

import { CarnivalNetworkClient } from './carnival-network-client';
import { registerMetricsEndpoint } from './services/observability/metrics';
import { ObservabilityProviderFactory } from './services/observability';
import { Log } from '../utils/logger';
import { getPlugin } from '../utils/plugin-utils';
import type {
	APIKeyStorage,
	CarnivalConfig,
	CarnivalNetworkClientInterface,
	LocalRestAPIPublic
} from '../types/public';

const networkLogger = {
	context: 'Carnival Network',
	path: '.obsidian/plugins/carnival-network/network/carnival-network.ts'
};

/**
 * ============================================================================
 * Public API: Create a network client for a consuming plugin
 * ============================================================================
 * 
 * @param performerId - Unique identifier for the consuming plugin (e.g., 'carnival-records')
 * @param storage - APIKeyStorage instance from Secure Storage plugin
 * @param config - Network configuration
 * @returns CarnivalNetworkClientInterface - Network client interface for the consuming plugin
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
	return Array.from(this.activeTroupes.keys());
}

/**
 * Check if a specific plugin has an active troupe
 */
export function hasTroupe(performerId: string): boolean {
	return this.activeTroupes.has(performerId);
}

export function joinCarnival(
	performerId: string,
	storage: APIKeyStorage,
	config: CarnivalConfig
): CarnivalNetworkClientInterface {
	// Check if troupe already exists
	if (this.activeTroupes.has(performerId)) {
		Log.warn(networkLogger, `🎭 Troupe already exists for: ${performerId}`);
		return this.activeTroupes.get(performerId) as CarnivalNetworkClientInterface;
	}

	// Verify dependencies before creating client
	const localRestApi = getPlugin(this.app, 'obsidian-local-rest-api');
	
	if (!localRestApi) {
		throw new Error(
			'🎪 Carnival Network requires "Local REST API" plugin. ' +
			'Please install it from Community Plugins to join the show!'
		);
	}

	// Create new network client (troupe)
	const troupe = new CarnivalNetworkClient(
		this.app,
		config,
		storage,
		performerId
	);

	// Track the troupe
	this.activeTroupes.set(performerId, troupe);
	
	// Update settings
	if (!this.settings.registeredPerformers.includes(performerId)) {
		this.settings.registeredPerformers.push(performerId);
		this.saveSettings();
	}

	Log.log(networkLogger, `🎭 New performer joined the carnival: ${performerId}`);

	return troupe;
}

/**
 * Remove a troupe (cleanup without destroying it)
 */
export async function leaveCarnival(performerId: string): Promise<void> {
	const troupe = this.activeTroupes.get(performerId);
	if (troupe) {
		await troupe.cleanup();
		this.activeTroupes.delete(performerId);
		
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