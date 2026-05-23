// src/main.ts
import {
	Notice,
	Plugin
} from 'obsidian';
import { CarnivalPerformer } from './network/performer/carnival-performer';
import { ObservabilityManager } from './network/services/observability/observability-manager';
import { CarnivalRegistryManager } from './network/carnival-registry-manager';
import {
	APIRouter,
	initializeAPIRouter
} from './api/api-router';
import { CarnivalStatusMonitor } from './network/observability/carnival-status-monitor';
import { CarnivalNetworkSettingsTab } from './ui/settings-tab';
import {
	LeaveTerritoryModal,
	PrimaryTerritorySelectorModal,
	TerritoryManagementModal,
	TerritorySelectionModal
} from './ui/modals';
import { Log } from './utils/logger';
import { verifyDependencies } from './utils/plugin-utils';
import type {
	APIKeyStore,
	CarnivalConfig,
	CarnivalNetworkSettings,
	CarnivalPerformerInterface,
	LocalRestAPIPublic,
	LogContext,
	ObservabilityProvider
} from './types/public';

const DEFAULT_SETTINGS: CarnivalNetworkSettings = {
	enableDebugLogging: false
};

export default class CarnivalNetworkPlugin extends Plugin {
	private routeManager?: APIRouter;
	private mainLogger: LogContext = {
		context: 'Carnival Network Plugin | onload',
		path: `${ this.app.vault.configDir }/plugins/carnival-network/src/main`
	};
	public activePerformers: Map<string, CarnivalPerformer> = new Map();
	public localRestAPIPublic?: LocalRestAPIPublic | null;
	public observabilityManager: ObservabilityManager;
	public observabilityProvider?: ObservabilityProvider | null;
	public performerTerritories: string[];
	public registeredPerformers: string[];
	public registryEndpoints: string[]; // solely managed by the Booking Coordinator (Carnival Registry Manager)
	public registryManager: CarnivalRegistryManager;
	public settings: CarnivalConfig;
	public statusMonitor?: CarnivalStatusMonitor;

	async onload(): Promise<void> {

		await this.loadSettings();

		Log.log(this.mainLogger, '🎪 Carnival Network Plugin loaded');

		this.observabilityManager = new ObservabilityManager(this);
		this.registryManager = new CarnivalRegistryManager(this);

		// Add settings tab
		this.addSettingTab(new CarnivalNetworkSettingsTab(this.app, this, this.settings));

		// ✅ ADD TERRITORY COMMANDS
		this.addCommand({
			id: 'create-join-territory',
			name: 'Create or Join Territory',
			callback: () => {
				const modal = new TerritorySelectionModal(this.app, this);
				modal.open();
			}
		});
		
		this.addCommand({
			id: 'manage-territories',
			name: 'Manage Territory Assignments',
			callback: () => {
				const modal = new TerritoryManagementModal(this.app, this);
				modal.open();
			}
		});
		
		this.addCommand({
			id: 'set-primary-territory',
			name: 'Set Primary Territory',
			callback: () => {
				const assigned = this.performerTerritories || [];
	
				if (assigned.length === 0) {
					new Notice('No territories assigned. Join a territory first.');
					return;
				}
				
				if (assigned.length === 1) {
					new Notice(`${assigned[0]} is already your only (and primary) territory.`);
					return;
				}
				
				const modal = new PrimaryTerritorySelectorModal(this.app, this, assigned);
				modal.open();
			}
		});
		
		this.addCommand({
			id: 'leave-territory',
			name: 'Leave Territory',
			callback: () => {
				const assigned = this.performerTerritories || [];
	
				if (assigned.length === 0) {
					new Notice('Not assigned to any territories.');
					return;
				}
				
				const modal = new LeaveTerritoryModal(this.app, this, assigned);
				modal.open();
			}
		});

		// Initialize API router
		this.app.workspace.onLayoutReady(async () => {
			// Verify Local REST API plugin is available
			verifyDependencies('obsidian-local-rest-api', this.app, this.mainLogger);
			verifyDependencies('secure-store', this.app, this.mainLogger);

			// Apply observability configuration (register endpoints, initialize providers)
			await this.observabilityManager.applyObservabilityConfig();

			// initialize the API router
			this.routeManager = initializeAPIRouter(this.app, this, this.manifest);

			// Initialize status monitor
			this.statusMonitor = new CarnivalStatusMonitor(this);
		});
	}

	onunload(): void {

		// Unregister API routes (NEW - add this first)
		if (this.routeManager) {
			this.routeManager.unregisterRoutes();
			this.routeManager = undefined;
		}

		// Cleanup all active network clients
		for (const [performerId, performer] of this.activePerformers.entries()) {
			Log.log(this.mainLogger, `🎭 Cleaning up performer: ${performerId}`);
			performer.leaveRing().catch(error => {
				Log.error(this.mainLogger, 'Error leaving the ring.', error);
			});
		}
		this.activePerformers.clear();

		// Cleanup observability provider and unregister metrics endpoint
		try {
			if (this.observabilityProvider) {
				this.observabilityProvider.cleanup().catch(error => {
					Log.error(this.mainLogger, 'Error cleaning up observability provider.', error);
				});
				this.observabilityProvider = null;
			}
		} catch (err) {
			Log.warn(this.mainLogger, 'Error cleaning up observability provider:', err);
		}

		try {
			if (this.localRestAPIPublic && typeof this.localRestAPIPublic.unregister === 'function') {
				this.localRestAPIPublic.unregister();
				this.localRestAPIPublic = null;
			}
		} catch (err) {
			Log.warn(this.mainLogger, 'Error unregistering Local REST API extension:', err);
		}

		// Cleanup status monitor
		this.statusMonitor?.cleanup();

		Log.log(this.mainLogger, '🎪 Carnival Network Plugin unloaded');
	}

	async loadSettings(): Promise<void> {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
	}

	/**
	 * Public API: Allow other plugins to join the carnival network
	 */
	async joinCarnival(
		performerId: string,
		store: APIKeyStore,
		config: CarnivalConfig
	): Promise<CarnivalPerformerInterface> {
		// Check if performer already exists
		if (this.activePerformers.has(performerId)) {
			Log.warn(this.mainLogger, `🎭 Performer already exists for: ${ performerId }`);
			return this.activePerformers.get(performerId) as CarnivalPerformerInterface;
		}
	
		// Verify dependencies before creating client
		const localRestApi = verifyDependencies('obsidian-local-rest-api', this.app, this.mainLogger);
		const secureStore = verifyDependencies('secure-store', this.app, this.mainLogger);
		
		if (!localRestApi || !secureStore) {
			throw new Error(
				`🎪 Carnival Network requires Local REST API and Secure Store plugins. 
				Please install them from Community Plugins to join the show!`
			);
		}
	
		// Create new network client (performer)
		const performer = new CarnivalPerformer(
			this.app,
			config,
			endpointManager,
			performerId
		);
	
		// Track the performer
		this.activePerformers.set(performerId, performer);
		
		// Update settings
		if (!this.registeredPerformers.includes(performerId)) {
			this.registeredPerformers.push(performerId);
			await this.saveSettings();
		}
	
		Log.log(this.mainLogger, `🎭 New performer joined the carnival: ${performerId}`);
	
		return performer;
	}

	/**
	 * Remove a performer (cleanup without destroying it)
	 */
	async leaveCarnival(performerId: string): Promise<void> {
		const performer = this.activePerformers.get(performerId);
		if (performer) {
			await performer.cleanup();
			this.activePerformers.delete(performerId);
			
			// Update settings
			this.registeredPerformers = this.registeredPerformers.filter(
				(id: string) => id !== performerId
			);
			await this.saveSettings();

			Log.log(this.mainLogger, `🎭 Performer left the carnival: ${performerId}`);
		}
	}
}