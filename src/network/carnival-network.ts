import { CarnivalNetworkClient } from './carnival-network-client';
import { Log } from '../utils/logger';
import { getPlugin } from '../utils/plugin-utils';
import type {
	APIKeyStorage,
	CarnivalConfig,
	CarnivalNetworkClientInterface
} from '../types/public';

const networkLogger = {
	context: 'Carnival Network',
	path: '.obsidian/plugins/carnival-network/network/carnival-network.ts'
};

/**
 * Public API: Create a network client for a consuming plugin
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