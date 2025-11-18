// src/main.ts
import { Plugin } from 'obsidian';
import { CarnivalPerformer } from './network/carnival-performer';
import {
	applyObservabilityConfig,
	initializeAPIRouter,
	joinCarnival,
	leaveCarnival
} from './network/carnival-troupe-manager';
import { APIRouter } from './api/api-router';
import { CarnivalNetworkSettingsTab } from './ui/settings-tab';
import { Log } from './utils/logger';
import { getPlugin } from './utils/plugin-utils';
import type {
	APIKeyStorage,
	CarnivalConfig,
	CarnivalPerformerInterface,
	ObservabilityProvider,
	LocalRestAPIPublic
} from './types/public';

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
	public activePerformers: Map<string, CarnivalPerformer> = new Map();
	private observabilityProvider?: ObservabilityProvider | null;
	private localRestAPIPublic?: LocalRestAPIPublic | null;
	private apiRouter?: APIRouter;

	async onload(): Promise<void> {
		await this.loadSettings();

		Log.log(mainLogger, '🎪 Carnival Network Plugin loaded');

		// Add settings tab
		this.addSettingTab(new CarnivalNetworkSettingsTab(this.app, this, this.settings));

		// Verify Local REST API plugin is available
		this.verifyDependencies();

		// Apply observability configuration (register endpoints, initialize providers)
		await applyObservabilityConfig();

		// Initialize API router (NEW - add this)
		this.app.workspace.onLayoutReady(async () => {
			await initializeAPIRouter.call(this);
		});
	}

	async onunload(): Promise<void> {

		// Unregister API routes (NEW - add this first)
		if (this.apiRouter) {
			this.apiRouter.unregisterRoutes();
			this.apiRouter = undefined;
		}

		// Cleanup all active network clients
		for (const [performerId, performer] of this.activePerformers.entries()) {
			Log.log(mainLogger, `🎭 Cleaning up performer: ${performerId}`);
			await performer.leaveRing();
		}
		this.activePerformers.clear();

		// Cleanup observability provider and unregister metrics endpoint
		try {
			if (this.observabilityProvider) {
				await this.observabilityProvider.cleanup();
				this.observabilityProvider = null;
			}
		} catch (err) {
			Log.warn(mainLogger, 'Error cleaning up observability provider:', err);
		}

		try {
			if (this.localRestAPIPublic && typeof this.localRestAPIPublic.unregister === 'function') {
				this.localRestAPIPublic.unregister();
				this.localRestAPIPublic = null;
			}
		} catch (err) {
			Log.warn(mainLogger, 'Error unregistering Local REST API extension:', err);
		}

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
	): CarnivalPerformerInterface {
		return joinCarnival.call(this, performerId, storage, config);
	}

	/**
	 * Public API: Allow performers to leave the carnival network
	 */
	async leaveCarnival(performerId: string): Promise<void> {
		await leaveCarnival.call(this, performerId);
	}
}