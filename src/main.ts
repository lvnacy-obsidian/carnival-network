// src/main.ts
import { Plugin } from 'obsidian';
import { NetworkClient } from './network/network-client';
import { NetworkSettingsTab } from './ui/settings-tab';
import { Log } from './utils/logger';
import type {
	INetworkClient,
	NetworkConfiguration,
	APIKeyStorage
} from './types';

const mainLogger = {
	context: 'Carnival Network Plugin',
	path: '/.obsidian/plugins/carnival-network/main'
};

interface CarnivalNetworkSettings {
	enableDebugLogging: boolean;
	registeredPerformers: string[]; // Plugins using the network are "performers"
}

const DEFAULT_SETTINGS: CarnivalNetworkSettings = {
	enableDebugLogging: false,
	registeredPerformers: []
};

export default class CarnivalNetworkPlugin extends Plugin {
	settings: CarnivalNetworkSettings;
	private activeTroupes: Map<string, CarnivalNetworkClient> = new Map();

	async onload(): Promise<void> {
		await this.loadSettings();

		Log.log(mainLogger, '🎪 Carnival Network Plugin loaded');

		// Add settings tab
		this.addSettingTab(new NetworkSettingsTab(this.app, this));

		// Verify Local REST API plugin is available
		this.verifyDependencies();
	}

	async onunload(): Promise<void> {
		// Cleanup all active network clients
		for (const [performerId, troupe] of this.activeTroupes.entries()) {
			Log.log(mainLogger, `🎭 Cleaning up troupe for: ${performerId}`);
			await troupe.cleanup();
		}
		this.activeTroupes.clear();

		Log.log(mainLogger, '🎪 Carnival Network Plugin unloaded');
	}

	/**
	 * Public API: Create a network client for a consuming plugin
	 * 
	 * @param performerId - Unique identifier for the consuming plugin (e.g., 'carnival-records')
	 * @param storage - APIKeyStorage instance from Secure Storage plugin
	 * @param config - Network configuration
	 * @returns ICarnivalNetworkClient - Network client interface for the consuming plugin
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
	public joinCarnival(
		performerId: string,
		storage: APIKeyStorage,
		config: NetworkConfiguration
	): ICarnivalNetworkClient {
		// Check if troupe already exists
		if (this.activeTroupes.has(performerId)) {
			Log.warn(mainLogger, `🎭 Troupe already exists for: ${performerId}`);
			return this.activeTroupes.get(performerId) as ICarnivalNetworkClient;
		}

		// Verify dependencies before creating client
		const localRestApi = (this.app as any).plugins?.plugins?.['obsidian-local-rest-api'];
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

		Log.log(mainLogger, `🎭 New performer joined the carnival: ${performerId}`);

		return troupe;
	}

	/**
	 * Get list of plugins currently performing in the carnival
	 */
	public getPerformers(): string[] {
		return Array.from(this.activeTroupes.keys());
	}

	/**
	 * Check if a specific plugin has an active troupe
	 */
	public hasTroupe(performerId: string): boolean {
		return this.activeTroupes.has(performerId);
	}

	/**
	 * Remove a troupe (cleanup without destroying it)
	 */
	public async leaveCarnival(performerId: string): Promise<void> {
		const troupe = this.activeTroupes.get(performerId);
		if (troupe) {
			await troupe.cleanup();
			this.activeTroupes.delete(performerId);
			
			// Update settings
			this.settings.registeredPerformers = this.settings.registeredPerformers.filter(
				id => id !== performerId
			);
			await this.saveSettings();

			Log.log(mainLogger, `🎭 Performer left the carnival: ${performerId}`);
		}
	}

	private verifyDependencies(): void {
		const localRestApi = (this.app as any).plugins?.plugins?.['obsidian-local-rest-api'];
		
		if (!localRestApi) {
			Log.warn(mainLogger, 
				'🎪 Local REST API plugin not found. The carnival cannot begin until it is installed!'
			);
		} else {
			Log.log(mainLogger, '🎪 Dependencies verified: Local REST API plugin found. Let the show begin!');
		}
	}

	async loadSettings(): Promise<void> {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
	}
}