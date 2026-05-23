/* eslint-disable obsidianmd/ui/sentence-case */

/**
 * ============================================================================
 * 🎪 CARNIVAL NETWORK SETTINGS - TABBED INTERFACE
 * ============================================================================
 * 
 * A modern tabbed settings interface for the Carnival Network plugin.
 * Organized into logical sections for better UX and maintainability.
 * 
 * Tabs:
 * - 🌐 Network: Core connectivity and discovery
 * - 🔐 API & Auth: API keys and authentication
 * - 📡 Observability: Metrics and monitoring
 * - 📊 Status: Real-time dashboard
 * - ⚙️ Advanced: Power user settings
 * 
 * @module settings-tab
 * @category UI
 */

import {
	App,
	ButtonComponent,
	Notice,
	PluginSettingTab,
	Setting,
	SliderComponent,
	TextComponent,
	ToggleComponent
} from 'obsidian';
import CarnivalNetworkPlugin from '../main';
import { getPlugin } from '../utils/plugin-utils';
import { Log } from '../utils/logger';
import {
	CarnivalConfig,
	LogContext
} from '../types/public';

/**
 * Tab identifiers
 */
type TabId = 'network' | 'api' | 'observability' | 'status' | 'advanced';

/**
 * Tab configuration
 */
interface TabConfig {
	id: TabId;
	icon: string;
	label: string;
	render: (container: HTMLElement) => void;
}

/**
 * Extended settings for UI-specific properties
 */
interface UISettings extends CarnivalConfig {
	autoDiscovery?: boolean;
	autoRefreshStatus?: boolean;
	networkEnabled?: boolean;
	syncChangelogs?: boolean;
	syncConversations?: boolean;
	broadcastByDefault?: boolean;
	debugLogging?: boolean;
	logAPIRequests?: boolean;
	externalApiKeys?: Record<string, {
		enabled: boolean;
		permissions: string[];
		sessionDuration: number;
		allowedTypes: string[];
		description?: string;
	}>;
	tls?: {
		checkServerIdentity?: boolean;
		minVersion?: string;
		maxVersion?: string;
		rejectUnauthorized?: boolean;
	}
	carnivalNetworkSettings?: {
		network?: {
			communicationTimeout?: number;
			maxConnections?: number;
			registryEndpoints?: readonly string[];
		};
	};
}

/**
 * Main tabbed settings class
 */
export class CarnivalNetworkSettingsTab extends PluginSettingTab {
	plugin: CarnivalNetworkPlugin;
	settings: CarnivalConfig;
	private activeTab: TabId = 'network';
	private tabs: TabConfig[];
	private settingsLogger: LogContext;

	constructor(
		app: App,
		plugin: CarnivalNetworkPlugin,
		settings: CarnivalConfig
	) {
		super(app, plugin);
		this.plugin = plugin;
		this.settings = settings;
		this.settingsLogger = {
			context: 'Settings Tab',
			path: `${ app.vault.configDir }/plugins/carnival-network/src/ui/settings-tab`
		};
		
		// Initialize tab configurations
		this.tabs = [
			{
				id: 'network',
				icon: '🌐',
				label: 'Network',
				render: (container) => this.renderNetworkTab(container)
			},
			{
				id: 'api',
				icon: '🔐',
				label: 'API & Auth',
				render: (container) => this.renderAPITab(container)
			},
			{
				id: 'observability',
				icon: '📡',
				label: 'Observability',
				render: (container) => this.renderObservabilityTab(container)
			},
			{
				id: 'status',
				icon: '📊',
				label: 'Status',
				render: (container) => this.renderStatusTab(container)
			},
			{
				id: 'advanced',
				icon: '⚙️',
				label: 'Advanced',
				render: (container) => this.renderAdvancedTab(container)
			}
		];
	}

	/**
	 * Main display method - renders the tabbed interface
	 */
	display(): void {
		const { containerEl } = this;
		containerEl.empty();
		containerEl.addClass('carnival-settings-container');

		// Header
		const header = containerEl.createDiv({ cls: 'carnival-settings-header' });
		new Setting(containerEl).setName('🎪 Welcome to the Carnival!').setHeading();
		header.createEl('p', {
			text: 'Configure your distributed vault network and monitoring system',
			cls: 'carnival-settings-subtitle'
		});

		// Tab navigation
		const tabNav = containerEl.createDiv({ cls: 'carnival-tab-nav' });
		this.renderTabButtons(tabNav);

		// Tab content
		const tabContent = containerEl.createDiv({ cls: 'carnival-tab-content' });
		this.renderActiveTab(tabContent);
	}

	/**
	 * Render tab navigation buttons
	 */
	private renderTabButtons(container: HTMLElement): void {
		this.tabs.forEach(tab => {
			const button = container.createEl('button', {
				text: `${tab.icon} ${tab.label}`,
				cls: `carnival-tab-button ${this.activeTab === tab.id ? 'active' : ''}`
			});
			
			button.onclick = () => {
				this.activeTab = tab.id;
				this.display();
			};
		});
	}

	/**
	 * Render the active tab content
	 */
	private renderActiveTab(container: HTMLElement): void {
		const activeTabConfig = this.tabs.find(tab => tab.id === this.activeTab);
		if (activeTabConfig) {
			activeTabConfig.render(container);
		}
	}

	/**
	 * Helper: Create a collapsible section
	 */
	private createCollapsibleSection(
		container: HTMLElement,
		title: string,
		icon: string,
		expanded: boolean = false
	): { header: HTMLElement; content: HTMLElement } {
		const section = container.createDiv({ cls: 'carnival-collapsible-section' });
		
		const header = section.createDiv({
			cls: `carnival-section-header ${expanded ? 'expanded' : 'collapsed'}`
		});
		header.createSpan({ text: `${icon} ${title}`, cls: 'section-title' });
		const toggle = header.createSpan({
			text: expanded ? '▼' : '▶',
			cls: 'section-toggle'
		});
		
		const content = section.createDiv({
			cls: 'carnival-section-content'
		});
		
		if (!expanded) {
			content.style.display = 'none';
		}
		
		header.onclick = () => {
			const isExpanded = content.style.display !== 'none';
			content.style.display = isExpanded ? 'none' : '';
			toggle.textContent = isExpanded ? '▶' : '▼';
			header.removeClass(isExpanded ? 'expanded' : 'collapsed');
			header.addClass(isExpanded ? 'collapsed' : 'expanded');
		};
		
		return { header, content };
	}

	// ========================================================================
	// NETWORK TAB
	// ========================================================================

	private renderNetworkTab(container: HTMLElement): void {
		const pluginSettings = this.plugin.settings as UISettings;

		// Check for Secure Store plugin
		const secureStorePlugin = getPlugin(this.app, 'obsidian-secure-store');
		if (!secureStorePlugin) {
			const warningEl = container.createDiv({ cls: 'carnival-warning mod-warning' });
			warningEl.createEl('strong', { text: '⚠️ Secure Store Required' });
			warningEl.createEl('p', {
				text: 'Network features require the "Secure Store" plugin. Please install it from Community Plugins to enable network functionality.'
			});
			return;
		}

		// Connection Section
		const connectionSection = this.createCollapsibleSection(
			container,
			'Connection',
			'🔗',
			true
		);

		new Setting(connectionSection.content)
			.setName('Enable Network')
			.setDesc('Connect to other carnival territories across your ecosystem')
			.addToggle((toggle: ToggleComponent) => {
				toggle
					.setValue(pluginSettings.networkEnabled ?? false)
					.onChange(async (value) => {
						pluginSettings.networkEnabled = value;
						await this.plugin.saveSettings();
						new Notice(`Network ${value ? 'enabled' : 'disabled'}`);
					});
			});

		new Setting(connectionSection.content)
			.setName('Auto Discovery')
			.setDesc('Automatically discover other carnival territories on the network')
			.addToggle((toggle: ToggleComponent) => {
				toggle
					.setValue(pluginSettings.autoDiscovery ?? false)
					.onChange(async (value) => {
						pluginSettings.autoDiscovery = value;
						await this.plugin.saveSettings();
					});
			});

		new Setting(connectionSection.content)
			.setName('Heartbeat Interval')
			.setDesc('How often to send heartbeat signals to maintain connections (ms)')
			.addSlider((slider: SliderComponent) => {
				slider
					.setLimits(1000, 60000, 1000)
					.setValue(this.settings.heartbeatInterval)
					.setDynamicTooltip()
					.onChange(async (value) => {
						this.settings.heartbeatInterval = value;
						await this.plugin.saveSettings();
					});
			})
			.addText((text: TextComponent) => {
				text.setPlaceholder('30000')
					.setValue(String(this.settings.heartbeatInterval))
					.onChange(async (value) => {
						const numValue = parseInt(value);
						if (!isNaN(numValue) && numValue >= 1000 && numValue <= 60000) {
							this.settings.heartbeatInterval = numValue;
							await this.plugin.saveSettings();
						}
					});
			});

		new Setting(connectionSection.content)
			.setName('Communication Timeout')
			.setDesc('Request timeout in milliseconds (1000-30000)')
			.addSlider((slider: SliderComponent) => {
				slider
					.setLimits(1000, 30000, 500)
					.setValue(this.settings.communicationTimeout)
					.setDynamicTooltip()
					.onChange(async (value) => {
						this.settings.communicationTimeout = value;
						await this.plugin.saveSettings();
					});
			})
			.addText((text: TextComponent) => {
				text.setPlaceholder('5000')
					.setValue(String(this.settings.communicationTimeout))
					.onChange(async (value) => {
						const numValue = parseInt(value);
						if (!isNaN(numValue) && numValue >= 1000 && numValue <= 30000) {
							this.settings.communicationTimeout = numValue;
							await this.plugin.saveSettings();
						}
					});
			});

		new Setting(connectionSection.content)
			.setName('Maximum Connections')
			.setDesc('Maximum concurrent network connections (1-50)')
			.addSlider((slider: SliderComponent) => {
				slider
					.setLimits(1, 50, 1)
					.setValue(pluginSettings.carnivalNetworkSettings?.network?.maxConnections ?? 10)
					.setDynamicTooltip()
					.onChange(async (value) => {
						pluginSettings.carnivalNetworkSettings ??= { network: {} };
						pluginSettings.carnivalNetworkSettings.network ??= {};
						pluginSettings.carnivalNetworkSettings.network.maxConnections = value;
						await this.plugin.saveSettings();
					});
			});
		
		// Territory Management Section
		const territorySection = this.createCollapsibleSection(
			container,
			'Territory Management',
			'🗺️',
			true
		);

		territorySection.content.createEl('p', {
			text: 'Assign this performer to one or more territories. The first territory is your primary territory.',
			cls: 'setting-item-description'
		});

		// Current Territory Assignments
		const assignedTerritories = this.plugin.performerTerritories || [];
		// const primaryTerritory = assignedTerritories.length > 0 ? assignedTerritories[0] : 'general';

		// Display current assignments
		const currentAssignmentDiv = territorySection.content.createDiv('carnival-current-territory');
		currentAssignmentDiv.createEl('strong', { text: 'Current Assignments:' });

		if (assignedTerritories.length === 0) {
			const defaultMsg = currentAssignmentDiv.createDiv('carnival-info-box');
			defaultMsg.createSpan({ text: 'No territories assigned. Using default: ' });
			defaultMsg.createEl('code', { text: 'general' });
		} else {
			const territoryList = currentAssignmentDiv.createEl('ul', { cls: 'carnival-territory-list' });
			assignedTerritories.forEach((territory, index) => {
				const li = territoryList.createEl('li');
				li.createSpan({ text: territory });
				if (index === 0) {
					li.createSpan({ text: ' (Primary)', cls: 'carnival-badge carnival-badge-primary' });
				}
			});
		}

		// Known Territories (from network discovery)
		const knownTerritories = this.plugin.registryManager?.getKnownTerritories() || ['general'];

		// Add Territory Selector
		new Setting(territorySection.content)
			.setName('Add Territory')
			.setDesc('Select a known territory or enter a custom name')
			.addDropdown(dropdown => {
				// Add known territories
				dropdown.addOption('', '-- Select Territory --');
				knownTerritories.forEach(territory => {
					if (!assignedTerritories.includes(territory)) {
						dropdown.addOption(territory, territory);
					}
				});
				dropdown.addOption('__custom__', '✏️ Enter Custom Name...');
				
				dropdown.onChange(async (value) => {
					if (value === '__custom__') {
						// Show custom input
						this.showCustomTerritoryInput();
					} else if (value && value !== '') {
						// Add selected territory
						await this.plugin.registryManager?.addTerritory(value);
						this.display(); // Refresh UI
						new Notice(`Added to territory: ${value}`);
					}
				});
			});

		// Current Territory List (with remove buttons)
		if (assignedTerritories.length > 0) {
			const managementContainer = territorySection.content.createDiv('carnival-territory-management');
			
			assignedTerritories.forEach((territory, index) => {
				const territoryItem = managementContainer.createDiv('territory-item');
				
				new Setting(territoryItem)
					.setName(territory)
					.setDesc(index === 0 ? 'Primary Territory' : 'Additional Territory')
					.addButton(button => button
						.setIcon('arrow-up')
						.setTooltip('Set as Primary')
						.setDisabled(index === 0)
						.onClick(async () => {
							// Move to first position
							const newOrder = [territory, ...assignedTerritories.filter(t => t !== territory)];
							await this.plugin.registryManager?.assignTerritories(newOrder);
							this.display();
							new Notice(`${territory} is now your primary territory`);
						})
					)
					.addButton(button => button
						.setIcon('trash')
						.setTooltip('Remove')
						.setWarning()
						.onClick(async () => {
							if (assignedTerritories.length === 1) {
								if (!confirm('Remove your only territory? You will be assigned to "general".')) {
									return;
								}
							}
							await this.plugin.registryManager?.removeTerritory(territory);
							this.display();
							new Notice(`Removed from territory: ${territory}`);
						})
					);
			});
		}

		// Bulk Actions
		const bulkActionsDiv = territorySection.content.createDiv('carnival-bulk-actions');

		const clearAllBtn = bulkActionsDiv.createEl('button', {
			text: 'Clear All Territories',
			cls: 'mod-warning'
		});
		clearAllBtn.addEventListener('click', () => {
			if (confirm('Remove all territory assignments? You will be assigned to "general".')) {
				this.plugin.registryManager?.assignTerritories(['general']).catch(error => {
					Log.error(this.settingsLogger, 'Territory Assignment removal failed', error);
				});
				this.display();
				new Notice('All territories cleared. Now assigned to: general');
			}
		});

		// Quick Presets (optional - comment out if not wanted)
		const presetsDiv = territorySection.content.createDiv('carnival-territory-presets');
		presetsDiv.createEl('p', {
			text: 'Quick Presets:',
			cls: 'setting-item-description'
		});

		const presets = [
			{ name: 'General', territories: ['general'] },
			{ name: 'Personal Vaults', territories: ['personal', 'private'] },
			{ name: 'Work Vaults', territories: ['work', 'professional'] },
			{ name: 'Archive', territories: ['archive', 'storage'] }
		];

		const presetButtons = presetsDiv.createDiv('carnival-preset-buttons');
		presets.forEach(preset => {
			const btn = presetButtons.createEl('button', {
				text: preset.name,
				cls: 'mod-muted'
			});
			btn.addEventListener('click', () => {
				if (confirm(`Assign to: ${preset.territories.join(', ')}?`)) {
					this.plugin.registryManager?.assignTerritories(preset.territories).catch(error => {
						Log.error(this.settingsLogger, 'Failed to assign territories', error);
					});
					this.display();
					new Notice(`Assigned to preset: ${preset.name}`);
				}
			});
		});

		// Registry Endpoints Section
		const registrySection = this.createCollapsibleSection(
			container,
			'Registry Endpoints',
			'📡',
			true
		);

		registrySection.content.createEl('p', {
			text: 'Configure registry endpoints for territory discovery. HTTPS is required (except localhost).',
			cls: 'setting-item-description'
		});

		const endpointsContainer = registrySection.content.createDiv('registry-endpoints-container');
		
		const renderEndpoints = () => {
			endpointsContainer.empty();

			const endpoints = Array.isArray(pluginSettings.carnivalNetworkSettings?.network?.registryEndpoints)
				? [...pluginSettings.carnivalNetworkSettings.network.registryEndpoints]
				: [];

			endpoints.forEach((endpoint: string, index: number) => {
				const endpointDiv = endpointsContainer.createDiv('endpoint-item');
				new Setting(endpointDiv)
					.setName(`Registry ${index + 1}`)
					.setDesc('HTTPS endpoints are enforced (except localhost)')
					.addText((text: TextComponent) => {
						text.setPlaceholder('https://registry.example.com:27123')
							.setValue(endpoint)
							.onChange(async (value) => {
								const newEndpoints = [...endpoints];
								newEndpoints[index] = value;
								await this.plugin.registryManager.updateEndpoints(newEndpoints);
							});
					})
					.addButton((button: ButtonComponent) => {
						button.setButtonText('Remove')
							.setWarning()
							.onClick(async () => {
								const newEndpoints = endpoints.filter((_, i) => i !== index);
								await this.plugin.registryManager.updateEndpoints(newEndpoints);
								renderEndpoints();
							});
					});
			});

			const addEndpointBtn = endpointsContainer.createEl('button', { 
				text: '+ Add Registry Endpoint',
				cls: 'mod-cta'
			});
			addEndpointBtn.addEventListener('click', () => {
				const newEndpoints = [...endpoints, 'https://'];
				this.plugin.registryManager.updateEndpoints(newEndpoints)
					.catch(error => {
						Log.error(
							this.settingsLogger,
							'Error calling updateEndpoints',
							error
						);
					});
				renderEndpoints();
			});
		};

		renderEndpoints();

		// Circuit Breaker Section
		const circuitSection = this.createCollapsibleSection(
			container,
			'Circuit Breaker',
			'🔴',
			false
		);

		circuitSection.content.createEl('p', {
			text: 'Automatic failure protection to prevent cascading errors',
			cls: 'setting-item-description'
		});

		new Setting(circuitSection.content)
			.setName('Failure Threshold')
			.setDesc('Number of failures before opening circuit (1-10)')
			.addSlider((slider: SliderComponent) => {
				slider
					.setLimits(1, 10, 1)
					.setValue(this.settings.circuitBreakerThreshold)
					.setDynamicTooltip()
					.onChange(async (value) => {
						this.settings.circuitBreakerThreshold = value;
						await this.plugin.saveSettings();
					});
			});

		new Setting(circuitSection.content)
			.setName('Circuit Timeout')
			.setDesc('Timeout before attempting requests on failing endpoints (ms)')
			.addSlider((slider: SliderComponent) => {
				slider
					.setLimits(1000, 30000, 1000)
					.setValue(this.settings.circuitBreakerTimeout)
					.setDynamicTooltip()
					.onChange(async (value) => {
						this.settings.circuitBreakerTimeout = value;
						await this.plugin.saveSettings();
					});
			})
			.addText((text: TextComponent) => {
				text.setValue(String(this.settings.circuitBreakerTimeout))
					.onChange(async (value) => {
						const numValue = parseInt(value);
						if (!isNaN(numValue) && numValue >= 1000) {
							this.settings.circuitBreakerTimeout = numValue;
							await this.plugin.saveSettings();
						}
					});
			});

		new Setting(circuitSection.content)
			.setName('Reset Timeout')
			.setDesc('Time before attempting to close an open circuit (ms)')
			.addSlider((slider: SliderComponent) => {
				slider
					.setLimits(5000, 60000, 5000)
					.setValue(this.settings.circuitBreakerResetTimeout)
					.setDynamicTooltip()
					.onChange(async (value) => {
						this.settings.circuitBreakerResetTimeout = value;
						await this.plugin.saveSettings();
					});
			})
			.addText((text: TextComponent) => {
				text.setValue(String(this.settings.circuitBreakerResetTimeout))
					.onChange(async (value) => {
						const numValue = parseInt(value);
						if (!isNaN(numValue) && numValue >= 5000) {
							this.settings.circuitBreakerResetTimeout = numValue;
							await this.plugin.saveSettings();
						}
					});
			});

		// Content Sync Section
		const syncSection = this.createCollapsibleSection(
			container,
			'Content Sync',
			'🔄',
			true
		);

		new Setting(syncSection.content)
			.setName('Sync Changelogs')
			.setDesc('Share changelog records across connected territories')
			.addToggle((toggle: ToggleComponent) => {
				toggle
					.setValue(pluginSettings.syncChangelogs ?? false)
					.onChange(async (value) => {
						pluginSettings.syncChangelogs = value;
						await this.plugin.saveSettings();
					});
			});

		new Setting(syncSection.content)
			.setName('Sync Conversations')
			.setDesc('Share conversation records across connected territories')
			.addToggle((toggle: ToggleComponent) => {
				toggle
					.setValue(pluginSettings.syncConversations ?? false)
					.onChange(async (value) => {
						pluginSettings.syncConversations = value;
						await this.plugin.saveSettings();
					});
			});

		new Setting(syncSection.content)
			.setName('Broadcast by Default')
			.setDesc('Automatically broadcast new records to all connected territories')
			.addToggle((toggle: ToggleComponent) => {
				toggle
					.setValue(pluginSettings.broadcastByDefault ?? false)
					.onChange(async (value) => {
						pluginSettings.broadcastByDefault = value;
						await this.plugin.saveSettings();
					});
			});
	}

	/**
	 * HELPER METHOD - Add this to the CarnivalNetworkSettingsTab class
	 */
	private showCustomTerritoryInput(): void {
		const modal = document.createElement('div');
		modal.addClass('modal-container', 'mod-dim');
		modal.style.display = 'flex';
		
		const modalBg = modal.createDiv('modal-bg');
		modalBg.onclick = () => modal.remove();
		
		const modalContent = modal.createDiv('modal');
		modalContent.addClass('carnival-territory-modal');
		
		const modalTitle = modalContent.createDiv('modal-title');
		modalTitle.textContent = 'Create/Join Territory';
		
		const modalBody = modalContent.createDiv('modal-content');
		
		modalBody.createEl('p', {
			text: 'Enter a territory name. If this territory doesn\'t exist on the network, it will be created.',
			cls: 'setting-item-description'
		});
		
		let territoryName = '';
		
		new Setting(modalBody)
			.setName('Territory Name')
			.setDesc('Use lowercase letters, numbers, and hyphens')
			.addText(text => text
				.setPlaceholder('my-custom-territory')
				.onChange(value => {
					territoryName = value.toLowerCase().replace(/[^a-z0-9-]/g, '-');
					text.setValue(territoryName);
				})
			);
		
		// Show existing territories for reference
		const knownTerritories = this.plugin.registryManager?.getKnownTerritories() || [];
		if (knownTerritories.length > 0) {
			modalBody.createEl('p', {
				text: 'Known territories:',
				cls: 'setting-item-description'
			});
			const territoryList = modalBody.createEl('ul', { cls: 'carnival-known-territories' });
			knownTerritories.forEach(t => {
				territoryList.createEl('li', { text: t });
			});
		}
		
		const modalFooter = modalContent.createDiv('modal-button-container');
		
		const createBtn = modalFooter.createEl('button', { text: 'Add Territory', cls: 'mod-cta' });
		createBtn.onclick = async () => {
			if (!territoryName || territoryName.trim().length === 0) {
				new Notice('Please enter a territory name');
				return;
			}
			
			try {
				await this.plugin.registryManager?.addTerritory(territoryName);
				modal.remove();
				this.display();
				new Notice(`Added to territory: ${territoryName}`);
			} catch (error) {
				new Notice(`Error: ${error.message}`);
			}
		};
		
		const cancelBtn = modalFooter.createEl('button', { text: 'Cancel' });
		cancelBtn.onclick = () => modal.remove();
		
		document.body.appendChild(modal);
	}

	// ========================================================================
	// API & AUTH TAB
	// ========================================================================

	private renderAPITab(container: HTMLElement): void {
		const pluginSettings = this.plugin.settings as UISettings;

		// External API Keys Section
		const apiKeysSection = this.createCollapsibleSection(
			container,
			'External API Keys',
			'🔑',
			true
		);

		apiKeysSection.content.createEl('p', {
			text: 'Manage API keys for external clients to access the REST API',
			cls: 'setting-item-description'
		});

		new Setting(apiKeysSection.content)
			.setName('API Key Management')
			.setDesc('Generate and manage API keys for external access')
			.addButton(button => button
				.setButtonText('Generate New Key')
				.setCta()
				.onClick(async () => {
					const apiKey = this.generateAPIKey();

					pluginSettings.externalApiKeys ??= {};
					
					pluginSettings.externalApiKeys[apiKey] = {
						enabled: true,
						permissions: ['read', 'write'],
						sessionDuration: 24,
						allowedTypes: ['discord', 'external'],
						description: 'New API key'
					};
					
					await this.plugin.saveSettings();
					this.display(); // Refresh UI
					
					// Show key to user (only time it's shown)
					new Notice(`API Key created: ${apiKey}\n\nSave this key securely - it won't be shown again!`, 10000);
				})
			);

		// Display existing API keys
		const apiKeys = pluginSettings.externalApiKeys ?? {};
		const apiKeysContainer = apiKeysSection.content.createDiv('api-keys-list');
		
		if (Object.keys(apiKeys).length === 0) {
			apiKeysContainer.createEl('p', {
				text: 'No API keys configured. Click "Generate New Key" to create one.',
				cls: 'setting-item-description carnival-empty-state'
			});
		} else {
			for (const [key, config] of Object.entries(apiKeys)) {
				const maskedKey = this.maskAPIKey(key);
				const keyItem = apiKeysContainer.createDiv('api-key-item');
				
				new Setting(keyItem)
					.setName(maskedKey)
					.setDesc(config.description ?? 'No description')
					.addToggle(toggle => toggle
						.setValue(config.enabled)
						.setTooltip(config.enabled ? 'Enabled' : 'Disabled')
						.onChange(async (value) => {
							config.enabled = value;
							await this.plugin.saveSettings();
							new Notice(`API key ${value ? 'enabled' : 'disabled'}`);
						})
					)
					.addButton(button => button
						.setButtonText('Edit')
						.onClick(() => {
							this.showAPIKeyEditModal(key, config);
						})
					)
					.addButton(button => button
						.setButtonText('Delete')
						.setWarning()
						.onClick(async () => {
							if (confirm(`Delete API key ${maskedKey}?`)) {
								if (pluginSettings.externalApiKeys) {
									delete pluginSettings.externalApiKeys[key];
								}
								await this.plugin.saveSettings();
								this.display();
								new Notice('API key deleted');
							}
						})
					);
			}
		}

		// Authentication System Section (Phase 3.5 Preview)
		const authSection = this.createCollapsibleSection(
			container,
			'Authentication System',
			'🎭',
			false
		);

		const authBadge = authSection.header.createSpan({
			text: 'Coming in Phase 3.5',
			cls: 'carnival-badge carnival-badge-future'
		});

		authSection.content.createEl('p', {
			text: 'Full authentication system with backstage passes, performance tickets, and JWT tokens. Available in Phase 3.5.',
			cls: 'setting-item-description'
		});

		// Placeholder settings (disabled)
		new Setting(authSection.content)
			.setName('Enable Authentication')
			.setDesc('Enable the full authentication and authorization system')
			.addToggle(toggle => toggle
				.setValue(false)
				.setDisabled(true)
			);

		new Setting(authSection.content)
			.setName('Require Credentials')
			.setDesc('Require authentication for all API endpoints')
			.addToggle(toggle => toggle
				.setValue(false)
				.setDisabled(true)
			);

		// Rate Limiting Section
		const rateLimitSection = this.createCollapsibleSection(
			container,
			'Rate Limiting',
			'🎫',
			false
		);

		rateLimitSection.content.createEl('p', {
			text: 'Control request rates to prevent abuse and ensure fair resource allocation',
			cls: 'setting-item-description'
		});

		const { rateLimitConfig } = this.settings;

		if (rateLimitConfig) {
			new Setting(rateLimitSection.content)
				.setName('Max Requests per Minute')
				.setDesc('Maximum API requests allowed per minute')
				.addSlider(slider => slider
					.setLimits(10, 1000, 10)
					.setValue(rateLimitConfig.maxRequestsPerMinute || 100)
					.setDynamicTooltip()
					.onChange(async (value) => {
						this.settings.rateLimitConfig ??= {
							maxRequestsPerMinute: 100,
							maxRequestsPerHour: 5000,
							burstLimit: 20
						};
						this.settings.rateLimitConfig.maxRequestsPerMinute = value;
						await this.plugin.saveSettings();
					})
				);

			new Setting(rateLimitSection.content)
				.setName('Max Requests per Hour')
				.setDesc('Maximum API requests allowed per hour')
				.addSlider(slider => slider
					.setLimits(100, 10000, 100)
					.setValue(rateLimitConfig.maxRequestsPerHour || 5000)
					.setDynamicTooltip()
					.onChange(async (value) => {
						this.settings.rateLimitConfig ??= {
							maxRequestsPerMinute: 100,
							maxRequestsPerHour: 5000,
							burstLimit: 20
						};
						this.settings.rateLimitConfig.maxRequestsPerHour = value;
						await this.plugin.saveSettings();
					})
				);

			new Setting(rateLimitSection.content)
				.setName('Burst Limit')
				.setDesc('Maximum requests allowed in a short burst')
				.addSlider(slider => slider
					.setLimits(5, 100, 5)
					.setValue(rateLimitConfig.burstLimit || 20)
					.setDynamicTooltip()
					.onChange(async (value) => {
						this.settings.rateLimitConfig ??= {
							maxRequestsPerMinute: 100,
							maxRequestsPerHour: 5000,
							burstLimit: 20
						};
						this.settings.rateLimitConfig.burstLimit = value;
						await this.plugin.saveSettings();
					})
				);
		} else {
			rateLimitSection.content.createEl('p', {
				text: 'Rate limiting is not configured. This is optional and can be enabled later.',
				cls: 'setting-item-description'
			});
		}

		// Security Section (Phase 3.5 Preview)
		const securitySection = this.createCollapsibleSection(
			container,
			'Security Settings',
			'🔒',
			false
		);

		const securityBadge = securitySection.header.createSpan({
			text: 'Coming in Phase 3.5',
			cls: 'carnival-badge carnival-badge-future'
		});

		securitySection.content.createEl('p', {
			text: 'Advanced security settings including HTTPS enforcement, key entropy requirements, and lockout policies. Available in Phase 3.5.',
			cls: 'setting-item-description'
		});
	}

	// ========================================================================
	// OBSERVABILITY TAB
	// ========================================================================

	private renderObservabilityTab(container: HTMLElement): void {
		const pluginSettings = this.plugin.settings as UISettings;
		const obs = pluginSettings.observability ?? { enabled: false };

		// Metrics Endpoint Section
		const metricsSection = this.createCollapsibleSection(
			container,
			'Metrics Endpoint',
			'📊',
			true
		);

		metricsSection.content.createEl('p', {
			text: 'Expose Prometheus-style metrics endpoint for monitoring tools',
			cls: 'setting-item-description'
		});

		new Setting(metricsSection.content)
			.setName('Enable Metrics Endpoint')
			.setDesc('Expose metrics at GET /metrics via Local REST API')
			.addToggle(toggle => toggle
				.setValue(obs.metricsEnabled ?? false)
				.onChange(async (value) => {
					pluginSettings.observability ??= { enabled: false };
					pluginSettings.observability.metricsEnabled = value;
					await this.plugin.saveSettings();
					await this.plugin.observabilityManager.applyObservabilityConfig();
					this.display();
				})
			);

		if (obs.metricsEnabled) {
			const endpointInfo = metricsSection.content.createDiv('carnival-info-box');
			endpointInfo.createEl('strong', { text: 'Endpoint: ' });
			endpointInfo.createEl('code', { text: 'GET /metrics' });
			endpointInfo.createEl('br');
			endpointInfo.createEl('strong', { text: 'Format: ' });
			endpointInfo.createSpan({ text: 'Prometheus text format' });
		}

		// Metrics Export Section
		const exportSection = this.createCollapsibleSection(
			container,
			'Metrics Export',
			'📤',
			false
		);

		exportSection.content.createEl('p', {
			text: 'Push metrics to external monitoring platforms',
			cls: 'setting-item-description'
		});

		new Setting(exportSection.content)
			.setName('Enable Metrics Export')
			.setDesc('Push metrics to external observability provider')
			.addToggle(toggle => toggle
				.setValue(obs.enabled ?? false)
				.onChange(async (value) => {
					pluginSettings.observability ??= { enabled: false };
					pluginSettings.observability.enabled = value;
					await this.plugin.saveSettings();
					await this.plugin.observabilityManager.applyObservabilityConfig();
					this.display();
				})
			);

		if (obs.enabled) {
			new Setting(exportSection.content)
				.setName('Provider')
				.setDesc('Select observability provider')
				.addDropdown(dropdown => {
					dropdown.addOption('none', 'None');
					dropdown.addOption('webhook', 'Webhook (push)');
					dropdown.setValue(obs.provider ?? 'none')
						.onChange(async (value) => {
							pluginSettings.observability ??= { enabled: obs.enabled ?? false };
							pluginSettings.observability.provider = value === 'none' ? undefined : value as 'webhook' | undefined;
							await this.plugin.saveSettings();
							await this.plugin.observabilityManager.applyObservabilityConfig();
							this.display();
						});
				});

			if (obs.enabled && obs.provider === 'webhook') {
				new Setting(exportSection.content)
					.setName('Webhook Endpoint')
					.setDesc('URL to POST metrics to')
					.addText(text => text
						.setValue(obs.endpoint ?? '')
						.setPlaceholder('https://metrics.example.com/push')
						.onChange(async (value) => {
							pluginSettings.observability ??= { enabled: obs.enabled ?? false };
							pluginSettings.observability.endpoint = value;
							await this.plugin.saveSettings();
							await this.plugin.observabilityManager.applyObservabilityConfig();
						})
					);

				new Setting(exportSection.content)
					.setName('API Key')
					.setDesc('Optional API key for authentication')
					.addText(text => {
						text.inputEl.type = 'password';
						text.setValue(obs.apiKey ?? '')
							.setPlaceholder('Optional')
							.onChange(async (value) => {
								pluginSettings.observability ??= { enabled: obs.enabled ?? false };
								pluginSettings.observability.apiKey = value;
								await this.plugin.saveSettings();
								await this.plugin.observabilityManager.applyObservabilityConfig();
							});
					});

				new Setting(exportSection.content)
					.setName('Webhook Secret')
					.setDesc('Secret for HMAC-signing webhook payloads (optional)')
					.addText(text => {
						text.inputEl.type = 'password';
						text.setValue(obs.webhookSecret ?? '')
							.setPlaceholder('Optional')
							.onChange(async (value) => {
								pluginSettings.observability ??= { enabled: obs.enabled ?? false };
								pluginSettings.observability.webhookSecret = value;
								await this.plugin.saveSettings();
								await this.plugin.observabilityManager.applyObservabilityConfig();
							});
					});
			}
		}

		// Buffer Configuration Section
		const bufferSection = this.createCollapsibleSection(
			container,
			'Buffer Configuration',
			'💾',
			false
		);

		bufferSection.content.createEl('p', {
			text: 'Configure metrics buffering and overflow behavior',
			cls: 'setting-item-description'
		});

		new Setting(bufferSection.content)
			.setName('Max Buffer Size')
			.setDesc('Maximum number of metrics to buffer (100-10000)')
			.addSlider(slider => slider
				.setLimits(100, 10000, 100)
				.setValue(obs.maxBufferSize ?? 1000)
				.setDynamicTooltip()
				.onChange(async (value) => {
					pluginSettings.observability ??= { enabled: obs.enabled ?? false };
					pluginSettings.observability.maxBufferSize = value;
					await this.plugin.saveSettings();
				})
			);

		new Setting(bufferSection.content)
			.setName('Batch Size')
			.setDesc('Number of metrics per batch when flushing (10-1000)')
			.addSlider(slider => slider
				.setLimits(10, 1000, 10)
				.setValue(obs.batchSize ?? 100)
				.setDynamicTooltip()
				.onChange(async (value) => {
					pluginSettings.observability ??= { enabled: obs.enabled ?? false };
					pluginSettings.observability.batchSize = value;
					await this.plugin.saveSettings();
				})
			);

		// Delivery Configuration Section
		const deliverySection = this.createCollapsibleSection(
			container,
			'Delivery Configuration',
			'🚀',
			false
		);

		deliverySection.content.createEl('p', {
			text: 'Configure how and when metrics are sent to the provider',
			cls: 'setting-item-description'
		});

		new Setting(deliverySection.content)
			.setName('Flush Interval')
			.setDesc('How often to send buffered metrics (ms, 1000-60000)')
			.addSlider(slider => slider
				.setLimits(1000, 60000, 1000)
				.setValue(obs.flushIntervalMs ?? 10000)
				.setDynamicTooltip()
				.onChange(async (value) => {
					pluginSettings.observability ??= { enabled: obs.enabled ?? false };
					pluginSettings.observability.flushIntervalMs = value;
					await this.plugin.saveSettings();
				})
			)
			.addText(text => text
				.setValue(String(obs.flushIntervalMs ?? 10000))
				.setPlaceholder('10000')
				.onChange(async (value) => {
					const numValue = parseInt(value);
					if (!isNaN(numValue) && numValue >= 1000 && numValue <= 60000) {
						pluginSettings.observability = { enabled: obs.enabled ?? false };
						pluginSettings.observability.flushIntervalMs = numValue;
						await this.plugin.saveSettings();
					}
				})
			);

		new Setting(deliverySection.content)
			.setName('Max Retries')
			.setDesc('Maximum number of retry attempts (0-10)')
			.addSlider(slider => slider
				.setLimits(0, 10, 1)
				.setValue(obs.maxRetries ?? 3)
				.setDynamicTooltip()
				.onChange(async (value) => {
					pluginSettings.observability ??= { enabled: obs.enabled ?? false };
					pluginSettings.observability.maxRetries = value;
					await this.plugin.saveSettings();
				})
			);

		new Setting(deliverySection.content)
			.setName('Retry Base Delay')
			.setDesc('Initial delay before retrying (ms, 100-5000)')
			.addSlider(slider => slider
				.setLimits(100, 5000, 100)
				.setValue(obs.retryBaseDelayMs ?? 1000)
				.setDynamicTooltip()
				.onChange(async (value) => {
					pluginSettings.observability ??= { enabled: obs.enabled ?? false };
					pluginSettings.observability.retryBaseDelayMs = value;
					await this.plugin.saveSettings();
				})
			);
	}

	// ========================================================================
	// STATUS TAB
	// ========================================================================

	private renderStatusTab(container: HTMLElement): void {
		const pluginSettings = this.plugin.settings as UISettings;
		const typedPlugin = this.plugin;

		// Refresh Controls Section
		const controlsSection = this.createCollapsibleSection(
			container,
			'Refresh Controls',
			'🔄',
			true
		);

		const refreshContainer = controlsSection.content.createDiv('carnival-refresh-controls');
		
		const refreshBtn = refreshContainer.createEl('button', {
			text: 'Refresh Status',
			cls: 'mod-cta'
		});
		refreshBtn.addEventListener('click', () => {
			refreshBtn.disabled = true;
			refreshBtn.textContent = 'Refreshing...';
			try {
				if (typedPlugin.statusMonitor) {
					typedPlugin.statusMonitor.refreshCarnivalStatus().catch(error => {
						Log.error(this.settingsLogger, 'Error refreshing carnival status.', error);
					});
				}
				this.display(); // Refresh the entire display
			} finally {
				refreshBtn.disabled = false;
				refreshBtn.textContent = 'Refresh Status';
			}
		});

		const autoRefreshToggle = new Setting(refreshContainer)
			.setName('Auto-refresh')
			.setDesc('Refresh every 30 seconds')
			.addToggle(toggle => toggle
				.setValue(pluginSettings.autoRefreshStatus ?? false)
				.onChange(async (value) => {
					pluginSettings.autoRefreshStatus = value;
					await this.plugin.saveSettings();
					if (value && typedPlugin.statusMonitor) {
						typedPlugin.statusMonitor.startAutoRefresh();
					} else if (!value && typedPlugin.statusMonitor) {
						typedPlugin.statusMonitor.stopAutoRefresh();
					}
				})
			);

		// Network Overview Section
		const overviewSection = this.createCollapsibleSection(
			container,
			'Network Overview',
			'🌐',
			true
		);

		const carnivalStatus = typedPlugin.statusMonitor?.getCarnivalStatus() ?? {};
		const overviewGrid = overviewSection.content.createDiv('carnival-status-grid');

		this.addStatusCard(overviewGrid, 'Status', carnivalStatus.status ?? 'Unknown', this.getStatusClass(carnivalStatus.status));
		this.addStatusCard(overviewGrid, 'Territories', String(carnivalStatus.territories ?? 0));
		this.addStatusCard(overviewGrid, 'Uptime', this.formatUptime(carnivalStatus.uptimeMs ?? 0));
		this.addStatusCard(overviewGrid, 'Error Rate', `${((carnivalStatus.errorRate ?? 0) * 100).toFixed(1)}%`);

		// Circuit Breaker Health Section
		const circuitSection = this.createCollapsibleSection(
			container,
			'Circuit Breaker Health',
			'⚡',
			false
		);

		const circuitStatus = typedPlugin.statusMonitor?.getCircuitBreakerStatus() ?? {};
		const circuitGrid = circuitSection.content.createDiv('carnival-circuit-grid');

		const endpoints = ['registry', 'performers', 'territories', 'capabilities', 'certificates', 'revocations', 'attestations'];
		endpoints.forEach(endpoint => {
			const state = circuitStatus[endpoint] ?? 'Unknown';
			this.addCircuitCard(circuitGrid, endpoint, state);
		});

		// Registry Metrics Section
		const registrySection = this.createCollapsibleSection(
			container,
			'Registry Metrics',
			'📈',
			false
		);

		const registryMetrics = typedPlugin.statusMonitor?.getRegistryMetrics() ?? { requestCount: 0, successCount: 0, failureCount: 0 };
		const registryGrid = registrySection.content.createDiv('carnival-status-grid');

		const successRate = registryMetrics.requestCount > 0 ? registryMetrics.successCount / registryMetrics.requestCount : 0;
		this.addStatusCard(registryGrid, 'Total Requests', String(registryMetrics.requestCount));
		this.addStatusCard(registryGrid, 'Successes', String(registryMetrics.successCount), 'status-connected');
		this.addStatusCard(registryGrid, 'Failures', String(registryMetrics.failureCount), registryMetrics.failureCount > 0 ? 'status-error' : '');
		this.addStatusCard(registryGrid, 'Success Rate', `${(successRate * 100).toFixed(1)}%`);

		// Certificate Health Section
		const certSection = this.createCollapsibleSection(
			container,
			'Certificate Health',
			'🔒',
			false
		);

		const certHealth = typedPlugin.statusMonitor?.getCertificateHealth() ?? {};
		const certGrid = certSection.content.createDiv('carnival-status-grid');

		this.addStatusCard(certGrid, 'Total', String(certHealth.total ?? 0));
		this.addStatusCard(certGrid, 'Healthy', String(certHealth.healthy ?? 0), 'status-connected');
		this.addStatusCard(certGrid, 'Expiring Soon', String(certHealth.expiring ?? 0), (certHealth.expiring ?? 0) > 0 ? 'status-warning' : '');
		this.addStatusCard(certGrid, 'Expired', String(certHealth.expired ?? 0), (certHealth.expired ?? 0) > 0 ? 'status-error' : '');
		this.addStatusCard(certGrid, 'Revoked', String(certHealth.revoked ?? 0), (certHealth.revoked ?? 0) > 0 ? 'status-error' : '');

		// Cache Performance Section
		const cacheSection = this.createCollapsibleSection(
			container,
			'Cache Performance',
			'🗄️',
			false
		);

		const cacheStats = typedPlugin.statusMonitor?.getCacheStats() ?? { hitRate: 0, missRate: 0, totalPerformers: 0, evictionCount: 0 };
		const cacheGrid = cacheSection.content.createDiv('carnival-status-grid');

		const totalOps = cacheStats.hitRate + cacheStats.missRate;
		const hitRate = totalOps > 0 ? cacheStats.hitRate / totalOps : 0;

		this.addStatusCard(cacheGrid, 'Size', String(cacheStats.totalPerformers));
		this.addStatusCard(cacheGrid, 'Hit Rate', `${(hitRate * 100).toFixed(1)}%`, this.getCacheHitRateClass(hitRate));
		this.addStatusCard(cacheGrid, 'Hits', String(cacheStats.hitRate));
		this.addStatusCard(cacheGrid, 'Misses', String(cacheStats.missRate));
		this.addStatusCard(cacheGrid, 'Evictions', String(cacheStats.evictionCount));

		// Network Topology Section
		const topologySection = this.createCollapsibleSection(
			container,
			'Network Topology',
			'🗺️',
			false
		);

		const topology = typedPlugin.statusMonitor?.getCarnivalTopology() ?? { territories: {}, capabilities: [] };
		
		const territoryEntries = Object.entries(topology.territories);
		if (territoryEntries.length > 0) {
			new Setting(topologySection.content).setName('Territories').setHeading();
			const territoryList = topologySection.content.createEl('ul', { cls: 'carnival-topology-list' });
			territoryEntries.forEach(([name, count]) => {
				territoryList.createEl('li', { text: `${name} (${count} performers)` });
			});
		} else {
			topologySection.content.createDiv('carnival-info-box')
				.createSpan({ text: 'No topology data available. Connect to the carnival to see details.' });
		}

		if (topology.capabilities && topology.capabilities.length > 0) {
			new Setting(topologySection.content).setName('Capabilities').setHeading();
			// topologySection.content.createEl('h4', { text: 'Capabilities' });
			const capList = topologySection.content.createEl('ul', { cls: 'carnival-topology-list' });
			topology.capabilities.forEach((cap: string) => {
				capList.createEl('li', { text: cap });
			});
		}

		// Management Actions Section
		const actionsSection = this.createCollapsibleSection(
			container,
			'Management Actions',
			'⚙️',
			false
		);

		actionsSection.content.createEl('p', {
			text: 'Dangerous operations that affect network connectivity and cache',
			cls: 'setting-item-description mod-warning'
		});

		const actionsContainer = actionsSection.content.createDiv('carnival-action-buttons');

		const flushCacheBtn = actionsContainer.createEl('button', {
			text: 'Flush Cache',
			cls: 'mod-warning'
		});
		flushCacheBtn.addEventListener('click', () => {
			if (confirm('Flush cache? This will write all pending changes to storage.')) {
				flushCacheBtn.disabled = true;
				try {
					if (typedPlugin.statusMonitor) {
						typedPlugin.statusMonitor.flushCache().catch(error => {
							Log.error(this.settingsLogger, 'Error flushing cache.', error);
						});
						new Notice('Cache flushed successfully');
					}
				} finally {
					flushCacheBtn.disabled = false;
				}
			}
		});

		const clearCacheBtn = actionsContainer.createEl('button', {
			text: 'Clear Cache',
			cls: 'mod-warning'
		});
		clearCacheBtn.addEventListener('click', () => {
			if (confirm('Clear cache? This will remove all cached data.')) {
				clearCacheBtn.disabled = true;
				try {
					if (typedPlugin.statusMonitor) {
						typedPlugin.statusMonitor.clearCache().catch(error => {
							Log.error(this.settingsLogger, 'Error clearing cache.', error);
						});
						new Notice('Cache cleared successfully');
						this.display();
					}
				} finally {
					clearCacheBtn.disabled = false;
				}
			}
		});

		const disconnectBtn = actionsContainer.createEl('button', {
			text: 'Disconnect Network',
			cls: 'mod-warning'
		});
		disconnectBtn.addEventListener('click', () => {
			if (confirm('Disconnect from the Carnival? This will close all connections.')) {
				disconnectBtn.disabled = true;
				try {
					if (typedPlugin.statusMonitor) {
						typedPlugin.statusMonitor.disconnectCarnival().catch(error => {
							Log.error(this.settingsLogger, `Error disconnecting from carnival.`, error);
						});
						new Notice('Disconnected from carnival');
						this.display();
					}
				} finally {
					disconnectBtn.disabled = false;
				}
			}
		});
	}

	// Helper methods for status display
	private addStatusCard(container: HTMLElement, label: string, value: string, statusClass?: string): void {
		const card = container.createDiv('carnival-status-card');
		if (statusClass) {
			card.addClass(statusClass);
		}
		card.createEl('div', { text: label, cls: 'carnival-status-label' });
		card.createEl('div', { text: value, cls: 'carnival-status-value' });
	}

	private addCircuitCard(container: HTMLElement, endpoint: string, state: string): void {
		const card = container.createDiv('carnival-circuit-card');
		const statusClass = state === 'CLOSED' ? 'status-connected'
			: state === 'OPEN' ? 'status-error'
				: state === 'HALF_OPEN' ? 'status-warning'
					: '';
		if (statusClass) {
			card.addClass(statusClass);
		}
		card.createEl('div', { text: endpoint, cls: 'carnival-circuit-label' });
		card.createEl('div', { text: state, cls: 'carnival-circuit-state' });
	}

	private getStatusClass(status: string): string {
		switch (status?.toLowerCase()) {
			case 'connected': return 'status-connected';
			case 'disconnected': return 'status-disconnected';
			case 'error': return 'status-error';
			case 'connecting': return 'status-warning';
			default: return '';
		}
	}

	private formatUptime(uptimeMs: number): string {
		if (!uptimeMs || uptimeMs <= 0) {
			return 'N/A';
		}

		const seconds = Math.floor(uptimeMs / 1000);
		const minutes = Math.floor(seconds / 60);
		const hours = Math.floor(minutes / 60);
		const days = Math.floor(hours / 24);

		if (days > 0) {
			return `${days}d ${hours % 24}h`;
		}
		if (hours > 0) {
			return `${hours}h ${minutes % 60}m`;
		}
		if (minutes > 0) {
			return `${minutes}m ${seconds % 60}s`;
		}
		return `${seconds}s`;
	}

	private getCacheHitRateClass(hitRate: number): string {
		if (hitRate >= 0.8) {
			return 'status-connected';
		}
		if (hitRate >= 0.5) {
			return 'status-warning';
		}
		return 'status-error';
	}

	private formatBytes(bytes: number): string {
		if (!bytes || bytes <= 0) {
			return '0 B';
		}
		const k = 1024;
		const sizes = ['B', 'KB', 'MB', 'GB'];
		const i = Math.floor(Math.log(bytes) / Math.log(k));
		return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
	}

	// ========================================================================
	// ADVANCED TAB
	// ========================================================================

	private renderAdvancedTab(container: HTMLElement): void {
		const pluginSettings = this.plugin.settings as UISettings;

		// TLS/Security Section
		const tlsSection = this.createCollapsibleSection(
			container,
			'TLS / Security',
			'🔒',
			true
		);

		tlsSection.content.createEl('p', {
			text: 'Configure TLS certificate validation and security policies',
			cls: 'setting-item-description'
		});

		new Setting(tlsSection.content)
			.setName('Reject Unauthorized')
			.setDesc('Reject TLS connections with invalid certificates (recommended: enabled)')
			.addToggle(toggle => toggle
				.setValue(pluginSettings.tls?.rejectUnauthorized ?? true)
				.onChange(async (value) => {
					pluginSettings.tls ??= {};
					pluginSettings.tls.rejectUnauthorized = value;
					await this.plugin.saveSettings();
				})
			);

		new Setting(tlsSection.content)
			.setName('Check Server Identity')
			.setDesc('Verify server hostname matches certificate (recommended: enabled)')
			.addToggle(toggle => toggle
				.setValue(pluginSettings.tls?.checkServerIdentity ?? true)
				.onChange(async (value) => {
					pluginSettings.tls ??= {};
					pluginSettings.tls.checkServerIdentity = value;
					await this.plugin.saveSettings();
				})
			);

		new Setting(tlsSection.content)
			.setName('Minimum TLS Version')
			.setDesc('Minimum TLS protocol version to accept')
			.addDropdown(dropdown => {
				dropdown.addOption('TLSv1.2', 'TLS 1.2');
				dropdown.addOption('TLSv1.3', 'TLS 1.3');
				dropdown.setValue(pluginSettings.tls?.minVersion ?? 'TLSv1.2')
					.onChange(async (value) => {
						pluginSettings.tls ??= {};
						pluginSettings.tls.minVersion = value as 'TLSv1.2' | 'TLSv1.3';
						await this.plugin.saveSettings();
					});
			});

		new Setting(tlsSection.content)
			.setName('Maximum TLS Version')
			.setDesc('Maximum TLS protocol version to accept')
			.addDropdown(dropdown => {
				dropdown.addOption('TLSv1.2', 'TLS 1.2');
				dropdown.addOption('TLSv1.3', 'TLS 1.3');
				dropdown.setValue(pluginSettings.tls?.maxVersion ?? 'TLSv1.3')
					.onChange(async (value) => {
						pluginSettings.tls ??= {};
						pluginSettings.tls.maxVersion = value as 'TLSv1.2' | 'TLSv1.3';
						await this.plugin.saveSettings();
					});
			});

		// Webhook Handlers Section (Phase 3.4 Preview)
		const webhookSection = this.createCollapsibleSection(
			container,
			'Webhook Handlers (Phase 3.4 Preview)',
			'🔗',
			false
		);

		webhookSection.content.createEl('p', {
			text: 'Configure webhook endpoints to receive real-time notifications',
			cls: 'setting-item-description'
		});

		const webhookInfo = webhookSection.content.createDiv('carnival-info-box');
		webhookInfo.createEl('strong', { text: '⚠️ Phase 3.4 Feature' });
		webhookInfo.createEl('p', {
			text: 'Webhook handlers are planned for Phase 3.4. Configuration UI will be available in a future update.'
		});

		// Cache Tuning Section
		const cacheSection = this.createCollapsibleSection(
			container,
			'Cache Tuning',
			'🔧',
			false
		);

		cacheSection.content.createEl('p', {
			text: 'Fine-tune performer cache behavior and memory limits',
			cls: 'setting-item-description'
		});

		new Setting(cacheSection.content)
			.setName('Performer Cache TTL')
			.setDesc('How long to cache performer data (ms, 60000-3600000)')
			.addSlider(slider => slider
				.setLimits(60000, 3600000, 60000)
				.setValue(pluginSettings.performerCacheTTL ?? 300000)
				.setDynamicTooltip()
				.onChange(async (value) => {
					pluginSettings.performerCacheTTL = value;
					await this.plugin.saveSettings();
				})
			)
			.addText(text => text
				.setValue(String(pluginSettings.performerCacheTTL ?? 300000))
				.setPlaceholder('300000')
				.onChange(async (value) => {
					const numValue = parseInt(value);
					if (!isNaN(numValue) && numValue >= 60000 && numValue <= 3600000) {
						pluginSettings.performerCacheTTL = numValue;
						await this.plugin.saveSettings();
					}
				})
			);

		new Setting(cacheSection.content)
			.setName('Max Cached Performers')
			.setDesc('Maximum number of performers to cache (10-1000)')
			.addSlider(slider => slider
				.setLimits(10, 1000, 10)
				.setValue(pluginSettings.maxCachedPerformers ?? 100)
				.setDynamicTooltip()
				.onChange(async (value) => {
					pluginSettings.maxCachedPerformers = value;
					await this.plugin.saveSettings();
				})
			);

		// Retry Configuration Section
		const retrySection = this.createCollapsibleSection(
			container,
			'Retry Configuration',
			'🔁',
			false
		);

		retrySection.content.createEl('p', {
			text: 'Configure retry behavior for failed network requests',
			cls: 'setting-item-description'
		});

		new Setting(retrySection.content)
			.setName('Max Retries')
			.setDesc('Maximum retry attempts for failed requests (0-10)')
			.addSlider(slider => slider
				.setLimits(0, 10, 1)
				.setValue(pluginSettings.maxRetries ?? 3)
				.setDynamicTooltip()
				.onChange(async (value) => {
					pluginSettings.maxRetries = value;
					await this.plugin.saveSettings();
				})
			);

		new Setting(retrySection.content)
			.setName('Retry Delay')
			.setDesc('Base delay before retrying (ms, 100-5000)')
			.addSlider(slider => slider
				.setLimits(100, 5000, 100)
				.setValue(pluginSettings.retryBaseDelayMs ?? 1000)
				.setDynamicTooltip()
				.onChange(async (value) => {
					pluginSettings.retryBaseDelayMs = value;
					await this.plugin.saveSettings();
				})
			);

		// Debug Options Section
		const debugSection = this.createCollapsibleSection(
			container,
			'Debug Options',
			'🐞',
			false
		);

		debugSection.content.createEl('p', {
			text: 'Enable additional logging and diagnostic features',
			cls: 'setting-item-description'
		});

		new Setting(debugSection.content)
			.setName('Enable Debug Logging')
			.setDesc('Log detailed network operations to console')
			.addToggle(toggle => toggle
				.setValue(pluginSettings.debugLogging ?? false)
				.onChange(async (value) => {
					pluginSettings.debugLogging = value;
					await this.plugin.saveSettings();
				})
			);

		new Setting(debugSection.content)
			.setName('Log API Requests')
			.setDesc('Log all API requests and responses')
			.addToggle(toggle => toggle
				.setValue(pluginSettings.logAPIRequests ?? false)
				.onChange(async (value) => {
					pluginSettings.logAPIRequests = value;
					await this.plugin.saveSettings();
				})
			);

		// About Section
		const aboutSection = this.createCollapsibleSection(
			container,
			'About',
			'ℹ️',
			false
		);

		const aboutContent = aboutSection.content.createDiv('carnival-about');
		new Setting(aboutContent).setName('About this plugin').setHeading();
		aboutContent.createEl('p', { text: `Version: ${this.plugin.manifest.version}` });
		aboutContent.createEl('p', { text: 'Phase: 3.3 Complete ✅' });
		
		const statusList = aboutContent.createEl('ul');
		statusList.createEl('li', { text: 'Phase 3.1: Network Discovery ✅' });
		statusList.createEl('li', { text: 'Phase 3.2: Certificate & Content Management ✅' });
		statusList.createEl('li', { text: 'Phase 3.3: External REST API ✅' });
		statusList.createEl('li', { text: 'Phase 3.4: Webhook Handlers (Planned)' });
		statusList.createEl('li', { text: 'Phase 3.5: Authentication (Planned)' });

		const dependencies = aboutContent.createEl('div');
		new Setting(dependencies).setName('Dependencies').setHeading();
		const depList = dependencies.createEl('ul');
		depList.createEl('li', { text: 'Obsidian API: Latest' });
		depList.createEl('li', { text: 'Secure Store Plugin: Required for API key storage' });

		const links = aboutContent.createEl('div');
		new Setting(links).setName('Links').setHeading();
		const linkList = links.createEl('ul');
		const githubLink = linkList.createEl('li');
		githubLink.createEl('a', {
			text: 'GitHub Repository',
			href: 'https://github.com/carnival-network/obsidian-plugin'
		});
		const docsLink = linkList.createEl('li');
		docsLink.createEl('a', {
			text: 'Documentation',
			href: 'https://docs.carnival.network'
		});
	}

	// ========================================================================
	// HELPER METHODS
	// ========================================================================

	/**
	 * Generate a secure random API key
	 */
	private generateAPIKey(): string {
		const array = new Uint8Array(32);
		crypto.getRandomValues(array);
		return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
	}

	/**
	 * Mask an API key for display
	 */
	private maskAPIKey(key: string): string {
		if (key.length <= 8) {
			return '****';
		}
		return `${key.substring(0, 4)}...${key.substring(key.length - 4)}`;
	}

	/**
	 * Show API key edit modal
	 */
	private showAPIKeyEditModal(
		key: string,
		config: {
			enabled: boolean;
			permissions: string[];
			sessionDuration: number;
			allowedTypes: string[];
			description?: string;
		}
	): void {
		// Create a simple modal for editing
		const modal = document.createElement('div');
		modal.addClass('modal-container', 'mod-dim');
		modal.style.display = 'flex';
		
		const modalBg = modal.createDiv('modal-bg');
		modalBg.onclick = () => modal.remove();
		
		const modalContent = modal.createDiv('modal');
		modalContent.addClass('carnival-api-key-modal');
		
		const modalTitle = modalContent.createDiv('modal-title');
		modalTitle.textContent = `Edit API Key: ${this.maskAPIKey(key)}`;
		
		const modalBody = modalContent.createDiv('modal-content');
		
		// Description
		new Setting(modalBody)
			.setName('Description')
			.setDesc('A friendly name for this API key')
			.addText(text => text
				.setValue(config.description ?? '')
				.setPlaceholder('e.g., Discord Bot, GitHub Webhook')
				.onChange(value => {
					config.description = value;
				})
			);
		
		// Session Duration
		new Setting(modalBody)
			.setName('Session Duration (hours)')
			.setDesc('How long sessions remain valid')
			.addSlider(slider => slider
				.setLimits(1, 168, 1)
				.setValue(config.sessionDuration)
				.setDynamicTooltip()
				.onChange(value => {
					config.sessionDuration = value;
				})
			);
		
		// Permissions
		new Setting(modalBody)
			.setName('Permissions')
			.setDesc(`Current: ${ config.permissions.join(', ') }`)
			.setDesc('Permissions system will be enhanced in Phase 3.5');
		
		const modalFooter = modalContent.createDiv('modal-button-container');
		
		const saveBtn = modalFooter.createEl('button', { text: 'Save', cls: 'mod-cta' });
		saveBtn.onclick = async () => {
			await this.plugin.saveSettings();
			modal.remove();
			this.display();
			new Notice('API key updated');
		};
		
		const cancelBtn = modalFooter.createEl('button', { text: 'Cancel' });
		cancelBtn.onclick = () => modal.remove();
		
		document.body.appendChild(modal);
	}
}
