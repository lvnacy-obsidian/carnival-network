// src/main.ts
import { Plugin } from 'obsidian';
import { CarnivalNetworkClient } from './network/carnival-network-client';
import {
	joinCarnival,
	leaveCarnival
} from './network/carnival-network';
import type { APIKeyStorage, CarnivalConfig, CarnivalNetworkClientInterface } from './types/public';
import { CarnivalNetworkSettingsTab } from './ui/settings-tab';
import { Log } from './utils/logger';
import { getPlugin } from './utils/plugin-utils';

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
	settings: CarnivalConfig;
	private activeTroupes: Map<string, CarnivalNetworkClient> = new Map();

	async onload(): Promise<void> {
		await this.loadSettings();

		Log.log(mainLogger, '🎪 Carnival Network Plugin loaded');

		// Add settings tab
		this.addSettingTab(new CarnivalNetworkSettingsTab(this.app, this, this.settings));

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

	async loadSettings(): Promise<void> {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
	}

	private verifyDependencies(): void {
		const localRestApi = getPlugin(this.app, 'obsidian-local-rest-api');
		
		if (!localRestApi) {
			Log.warn(mainLogger, 
				'🎪 Local REST API plugin not found. The carnival cannot begin until it is installed!'
			);
		} else {
			Log.log(mainLogger, '🎪 Dependencies verified: Local REST API plugin found. Let the show begin!');
		}
	}

	/**
	 * Public API: Allow other plugins to join the carnival network
	 */
	joinCarnival(
		performerId: string,
		storage: APIKeyStorage,
		config: CarnivalConfig
	): CarnivalNetworkClientInterface {
		return joinCarnival.call(this, performerId, storage, config);
	}

	/**
	 * Public API: Allow performers to leave the carnival network
	 */
	async leaveCarnival(performerId: string): Promise<void> {
		return leaveCarnival.call(this, performerId);
	}
}
