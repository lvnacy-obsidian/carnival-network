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
import { CarnivalConfig } from '../types/public';

export class CarnivalNetworkSettingsTab extends PluginSettingTab {
	plugin: CarnivalNetworkPlugin;
	settings: CarnivalConfig;

	constructor(
		app: App,
		plugin: CarnivalNetworkPlugin,
		settings: CarnivalConfig
	) {
		super(app, plugin);
		this.plugin = plugin;
		this.settings = settings;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		containerEl.createEl('h2', { text: '🎪 Carnival Records Settings' });
		containerEl.createEl('p', { 
			text: 'Configure your supernatural template automation system.',
			cls: 'setting-item-description'
		});

		// Network Settings Section
		containerEl.createEl('h3', { text: '🌐 Carnival Network Settings' });
		containerEl.createEl('p', { 
			text: 'Configure cross-vault communication and synchronization.',
			cls: 'setting-item-description'
		});

		// containerEl.createEl('h3', { text: 'Network Settings' });

		// Check if Secure Storage is available
		const secureStoragePlugin = getPlugin(this.app, 'obsidian-secure-storage');
		if (!secureStoragePlugin) {
			const warningEl = containerEl.createDiv({ cls: 'mod-warning' });
			warningEl.createEl('strong', { text: '⚠️ Secure Storage Required' });
			warningEl.createEl('p', { 
				text: 'Network features require the "Secure Storage" plugin. Please install it from Community Plugins to enable network functionality.'
			});
			return; // Don't show network settings if plugin is missing
		}

		new Setting(containerEl)
			.setName('Enable Network')
			.setDesc('Connect to other carnival territories across your ecosystem')
			.addToggle((toggle: ToggleComponent) => {
				toggle
					.setValue(this.plugin.settings.networkEnabled)
					.onChange(async (value) => {
						this.plugin.settings.networkEnabled = value;
						await this.plugin.saveSettings();
						
						// Reinitialize network if enabled
						if (value && !this.plugin.carnivalNetwork) {
							await initializeCarnivalNetwork(this.app, this.settings);
						} else if (!value && this.plugin.carnivalNetwork) {
							await this.plugin.carnivalNetwork.disconnectNetwork();
							// this.plugin.carnivalNetwork = null;
						}
					});
			});

		new Setting(containerEl)
			.setName('Auto Discovery')
			.setDesc('Automatically discover other carnival territories')
			.addToggle((toggle: ToggleComponent) => {
				toggle
					.setValue(this.plugin.settings.autoDiscovery)
					.onChange(async (value) => {
						this.plugin.settings.autoDiscovery = value;
						await this.plugin.saveSettings();
					});
			});

		new Setting(containerEl)
			.setName('Sync Changelogs')
			.setDesc('Share changelog records across connected territories')
			.addToggle((toggle: ToggleComponent) => {
				toggle
					.setValue(this.plugin.settings.syncChangelogs)
					.onChange(async (value) => {
						this.plugin.settings.syncChangelogs = value;
						await this.plugin.saveSettings();
					});
			});

		new Setting(containerEl)
			.setName('Sync Conversations')
			.setDesc('Share conversation records across connected territories')
			.addToggle((toggle: ToggleComponent) => {
				toggle
					.setValue(this.plugin.settings.syncConversations)
					.onChange(async (value) => {
						this.plugin.settings.syncConversations = value;
						await this.plugin.saveSettings();
					});
			});

		new Setting(containerEl)
			.setName('Broadcast by Default')
			.setDesc('Automatically broadcast new records to all connected territories')
			.addToggle((toggle: ToggleComponent) => {
				toggle
					.setValue(this.plugin.settings.broadcastByDefault)
					.onChange(async (value) => {
						this.plugin.settings.broadcastByDefault = value;
						await this.plugin.saveSettings();
					});
			});

		// Advanced Network Configuration Section
		containerEl.createEl('h3', { text: '⚙️ Network Configuration' });
		containerEl.createEl('p', { 
			text: 'Configure timeouts, retries, and endpoint management.',
			cls: 'setting-item-description'
		});

		// Communication Timeout
		new Setting(containerEl)
			.setName('Communication Timeout')
			.setDesc('Request timeout in milliseconds (1000-30000)')
			.addSlider((slider: SliderComponent) => {
				slider
					.setLimits(1000, 30000, 500)
					.setValue(this.plugin.carnivalNetworkSettings.network.communicationTimeout)
					.setDynamicTooltip()
					.onChange(async (value) => {
						this.plugin.carnivalNetworkSettings.network.communicationTimeout = value;
						await this.plugin.saveSettings();
						// Update network configuration if active
						if (this.plugin.carnivalNetwork?.getRegistryService()) {
							// Registry service will pick up new config on next request
						}
					});
			})
			.addText((text: TextComponent) => {
				text.setPlaceholder('5000')
					.setValue(String(this.plugin.carnivalNetworkSettings.network.communicationTimeout))
					.onChange(async (value) => {
						const numValue = parseInt(value);
						if (!isNaN(numValue) && numValue >= 1000 && numValue <= 30000) {
							this.plugin.carnivalNetworkSettings.network.communicationTimeout = numValue;
							await this.plugin.saveSettings();
						}
					});
			});

		// Max Connections
		new Setting(containerEl)
			.setName('Maximum Connections')
			.setDesc('Maximum concurrent network connections (1-50)')
			.addSlider((slider: SliderComponent) => {
				slider
					.setLimits(1, 50, 1)
					.setValue(this.plugin.carnivalNetworkSettings.network.maxConnections)
					.setDynamicTooltip()
					.onChange(async (value) => {
						this.plugin.carnivalNetworkSettings.network.maxConnections = value;
						await this.plugin.saveSettings();
					});
			});

		// Registry Endpoints Management
		containerEl.createEl('h4', { text: 'Registry Endpoints' });
		const endpointsContainer = containerEl.createDiv('registry-endpoints-container');
		
		const renderEndpoints = () => {
			endpointsContainer.empty();
			const endpoints = this.plugin.carnivalNetworkSettings.network.registryEndpoints;
			
			endpoints.forEach((endpoint: string, index: string) => {
				const endpointDiv = endpointsContainer.createDiv('endpoint-item');
				new Setting(endpointDiv)
					.setName(`Registry ${index + 1}`)
					.setDesc('HTTPS endpoints are enforced (except localhost)')
					.addText((text: TextComponent) => {
						text.setPlaceholder('https://registry.example.com:27123')
							.setValue(endpoint)
							.onChange(async (value) => {
								this.plugin.carnivalNetworkSettings.network.registryEndpoints[index] = value;
								await this.plugin.saveSettings();
								// Update registry endpoints if network is active
								if (this.plugin.carnivalNetwork?.getRegistryService()) {
									this.plugin.carnivalNetwork.getRegistryService().updateRegistryEndpoints(
										this.plugin.carnivalNetworkSettings.network.registryEndpoints
									);
								}
							});
					})
					.addButton((button: ButtonComponent) => {
						button.setButtonText('Remove')
							.setWarning()
							.onClick(async () => {
								this.plugin.carnivalNetworkSettings.network.registryEndpoints.splice(index, 1);
								await this.plugin.saveSettings();
								renderEndpoints();
								// Update registry endpoints if network is active
								if (this.plugin.carnivalNetwork?.getRegistryService()) {
									this.plugin.carnivalNetwork.getRegistryService().updateRegistryEndpoints(
										this.plugin.carnivalNetworkSettings.network.registryEndpoints
									);
								}
							});
					});
			});
			
			const addEndpointBtn = endpointsContainer.createEl('button', { text: 'Add Registry Endpoint' });
			addEndpointBtn.addEventListener('click', async () => {
				this.plugin.carnivalNetworkSettings.network.registryEndpoints.push('https://');
				await this.plugin.saveSettings();
				renderEndpoints();
			});
		};

		// External API Settings
		containerEl.createEl('h2', { text: 'External API Settings' });
		
		new Setting(containerEl)
			.setName('API Keys')
			.setDesc('Manage API keys for external clients')
			.addButton(button => button
				.setButtonText('Add API Key')
				.onClick(async () => {
					const apiKey = this.generateAPIKey();

					this.plugin.settings.externalApiKeys ??= {};
					
					/*
					if (!this.plugin.settings.externalApiKeys) {
						this.plugin.settings.externalApiKeys = {};
					}
					*/
					
					this.plugin.settings.externalApiKeys[apiKey] = {
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
		const apiKeys = this.plugin.settings.externalApiKeys ?? {};
		for (const [key, config] of Object.entries(apiKeys)) {
			const maskedKey = this.maskAPIKey(key);
			
			new Setting(containerEl)
				.setName(maskedKey)
				.setDesc(config.description ?? 'No description')
				.addToggle(toggle => toggle
					.setValue(config.enabled)
					.onChange(async (value) => {
						config.enabled = value;
						await this.plugin.saveSettings();
					})
				)
				.addButton(button => button
					.setButtonText('Delete')
					.setWarning()
					.onClick(async () => {

						if (this.plugin.settings.externalApiKeys) {
							delete this.plugin.settings.externalApiKeys[key];
						}
						await this.plugin.saveSettings();
						this.display();
					})
				);
		}
		
		renderEndpoints();

		// Comprehensive Network Health & Monitoring Section
		if (this.plugin.carnivalNetwork) {
			containerEl.createEl('h3', { text: '📊 Network Health & Monitoring' });
			
			// Network Status Overview
			const statusEl = containerEl.createDiv('carnival-network-status');
			const networkStatusContainer = statusEl.createDiv('network-status-container');
			
			// Registry Health & Circuit Breaker Status
			const registryEl = containerEl.createDiv('carnival-registry-health');
			registryEl.createEl('h4', { text: '🔴 Circuit Breaker Status' });
			registryEl.createEl('p', { 
				text: 'Real-time endpoint health and circuit breaker states',
				cls: 'setting-item-description'
			});
			
			const healthContainer = registryEl.createDiv('health-container');
			const metricsContainer = registryEl.createDiv('metrics-container');
			
			// Certificate Health Section
			const certEl = containerEl.createDiv('carnival-certificate-health');
			certEl.createEl('h4', { text: '📜 Certificate Health' });
			const certificateContainer = certEl.createDiv('certificate-container');
			
			// Cache Performance Section
			const cacheEl = containerEl.createDiv('carnival-cache-performance');
			cacheEl.createEl('h4', { text: '📋 Cache Performance' });
			const cacheContainer = cacheEl.createDiv('cache-container');
			
			// Network Topology Section
			const topoEl = containerEl.createDiv('carnival-network-topology');
			topoEl.createEl('h4', { text: '🌐 Network Topology' });
			const topologyContainer = topoEl.createDiv('topology-container');
			
			// Comprehensive refresh function
			const refreshAll = async () => {
				networkStatusContainer.empty();
				healthContainer.empty();
				metricsContainer.empty();
				certificateContainer.empty();
				topologyContainer.empty();
				cacheContainer.empty();
				
				try {
					const registryService = this.plugin.carnivalNetwork.getRegistryService();
					
					// Network Status Overview
					const networkStatus = await this.plugin.carnivalNetwork.getNetworkStatus();
					const networkMetrics = await this.plugin.carnivalNetwork.getNetworkMetrics();
					
					const statusDiv = networkStatusContainer.createDiv('status-overview');
					statusDiv.createEl('h5', { text: 'Network Overview' });
					const statusGrid = statusDiv.createDiv('status-grid');
					
					const statusItems = [
						{ label: 'Status', value: networkStatus.status, className: this.getStatusClass(networkStatus.status) },
						{ label: 'Connected Territories', value: networkStatus.totalConnections },
						{ label: 'Uptime', value: this.formatUptime(networkMetrics.uptime) },
						{ label: 'Error Rate', value: `${(networkMetrics.errorRate * 100).toFixed(1)}%` }
					];
					
					statusItems.forEach(item => {
						const itemEl = statusGrid.createDiv('status-item');
						itemEl.createEl('span', { text: item.label, cls: 'status-label' });
						const valueEl = itemEl.createEl('span', { text: String(item.value), cls: 'status-value' });
						if (item.className) {
							valueEl.addClass(item.className);
						}
					});
					
					// Circuit Breaker Health
					const health = registryService.getRegistryHealth();
					const healthDiv = healthContainer.createDiv('health-display');
					
					if (Object.keys(health).length === 0) {
						healthDiv.createEl('p', { text: 'No registry endpoints configured', cls: 'setting-item-description' });
					} else {
						for (const [endpoint, state] of Object.entries(health)) {
							const healthItem = healthDiv.createDiv('health-item');
							const stateIndicator = healthItem.createEl('span', { 
								text: '•', 
								cls: `circuit-state circuit-${state}` 
							});
							healthItem.createEl('span', { text: ` ${ endpoint }`, cls: 'endpoint-url' });
							healthItem.createEl('span', { text: ` (${ state })`, cls: 'circuit-state-text' });
							healthItem.createEl('span', { text: ` (${ stateIndicator })`, cls: 'circuit-state-text' });
						}
					}
					
					// Metrics Display
					const metrics = registryService.getRegistryMetrics();
					const metricsDiv = metricsContainer.createDiv('metrics-display');
					metricsDiv.createEl('h5', { text: 'Request Metrics' });
					
					if (Object.keys(metrics).length === 0) {
						metricsDiv.createEl('p', { text: 'No metrics available', cls: 'setting-item-description' });
					} else {
						for (const [endpoint, m] of Object.entries(metrics)) {
							const metricItem = metricsDiv.createDiv('metric-item');
							metricItem.createEl('div', { text: endpoint, cls: 'metric-endpoint' });
							const metricStats = metricItem.createDiv('metric-stats');
							metricStats.createEl('span', { text: `📈 ${m.requests}`, cls: 'metric-requests', title: 'Total Requests' });
							metricStats.createEl('span', { text: `✓ ${m.successes}`, cls: 'metric-successes', title: 'Successful Requests' });
							metricStats.createEl('span', { text: `✗ ${m.failures}`, cls: 'metric-failures', title: 'Failed Requests' });
							const successRate = m.requests > 0 ? ((m.successes / m.requests) * 100).toFixed(1) : '0';
							metricStats.createEl('span', { text: `${successRate}%`, cls: 'metric-rate', title: 'Success Rate' });
						}
					}
					
					// Certificate Health
					const certHealth = registryService.getCertificateHealth();
					const certDiv = certificateContainer.createDiv('cert-display');
					
					const certItems = [
						{ label: 'Total Certificates', value: certHealth.total },
						{ label: 'Healthy', value: certHealth.healthy, className: 'cert-healthy' },
						{ label: 'Expiring Soon', value: certHealth.expiringSoon, className: 'cert-warning' },
						{ label: 'Expired', value: certHealth.expired, className: 'cert-error' },
						{ label: 'Revoked', value: certHealth.revoked, className: 'cert-revoked' }
					];
					
					const certGrid = certDiv.createDiv('cert-grid');
					certItems.forEach(item => {
						const itemEl = certGrid.createDiv('cert-item');
						itemEl.createEl('span', { text: item.label, cls: 'cert-label' });
						const valueEl = itemEl.createEl('span', { text: String(item.value), cls: 'cert-value' });
						if (item.className) {
							valueEl.addClass(item.className);
						}
					});
					
					// Network Topology
					const topology = await registryService.getNetworkTopology();
					const topoDiv = topologyContainer.createDiv('topology-display');
					
					// Territory breakdown
					const territoryDiv = topoDiv.createDiv('territory-breakdown');
					territoryDiv.createEl('h5', { text: 'Territories' });
					if (Object.keys(topology.territories).length === 0) {
						territoryDiv.createEl('p', { text: 'No territories discovered', cls: 'setting-item-description' });
					} else {
						for (const [territory, count] of Object.entries(topology.territories)) {
							territoryDiv.createEl('p', { text: `${territory}: ${count} performers` });
						}
					}
					
					// Capability breakdown
					const capabilityDiv = topoDiv.createDiv('capability-breakdown');
					capabilityDiv.createEl('h5', { text: 'Network Capabilities' });
					if (Object.keys(topology.capabilities).length === 0) {
						capabilityDiv.createEl('p', { text: 'No capabilities detected', cls: 'setting-item-description' });
					} else {
						for (const [capability, count] of Object.entries(topology.capabilities)) {
							capabilityDiv.createEl('p', { text: `${capability}: ${count} performers` });
						}
					}
				
					// Cache Performance
					const cacheMetrics = registryService.getCacheMetrics();
					const cacheStatus = registryService.getCacheStatus();
					const cacheDiv = cacheContainer.createDiv('cache-display');
					
					const cacheOverview = cacheDiv.createDiv('cache-overview');
					cacheOverview.createEl('h5', { text: 'Cache Overview' });
					
					const cacheItems = [
						{ label: 'Cache Size', value: `${cacheStatus.size}/${cacheStatus.maxSize}` },
						{ label: 'Hit Rate', value: `${cacheMetrics.hitRate}%`, className: this.getCacheHitRateClass(cacheMetrics.hitRate) },
						{ label: 'Total Operations', value: cacheMetrics.totalOperations },
						{ label: 'Cache Hits', value: cacheMetrics.hits, className: 'cache-hits' },
						{ label: 'Cache Misses', value: cacheMetrics.misses, className: 'cache-misses' },
						{ label: 'Evictions', value: cacheMetrics.evictions, className: cacheMetrics.evictions > 0 ? 'cache-warning' : '' },
						{ label: 'Storage Writes', value: cacheMetrics.storageWrites },
						{ label: 'Storage Reads', value: cacheMetrics.storageReads },
						{ label: 'Memory Usage', value: this.formatBytes(cacheMetrics.memoryUsage) },
						{ label: 'Persistence', value: cacheStatus.persistenceEnabled ? 'Enabled' : 'Disabled', className: cacheStatus.persistenceEnabled ? 'cache-enabled' : 'cache-disabled' }
					];
					
					const cacheGrid = cacheOverview.createDiv('cache-grid');
					cacheItems.forEach(item => {
						const itemEl = cacheGrid.createDiv('cache-item');
						itemEl.createEl('span', { text: item.label, cls: 'cache-label' });
						const valueEl = itemEl.createEl('span', { text: String(item.value), cls: 'cache-value' });
						if (item.className) {
							valueEl.addClass(item.className);
						}
					});
				
				} catch (e) {
					networkStatusContainer.createEl('p', { text: 'Error retrieving network status', cls: 'setting-item-description' });
					console.error('Network status error:', e);
				}
			};
			
			// Refresh controls
			const controlsDiv = containerEl.createDiv('network-controls');
			const refreshBtn = controlsDiv.createEl('button', { text: '🔄 Refresh Network Status' });
			refreshBtn.addEventListener('click', refreshAll);
			
			const autoRefreshBtn = controlsDiv.createEl('button', { text: '⏱️ Auto Refresh (30s)' });
			let autoRefreshInterval: number | null = null;
			
			autoRefreshBtn.addEventListener('click', () => {
				if (autoRefreshInterval) {
					clearInterval(autoRefreshInterval);
					autoRefreshInterval = null;
					autoRefreshBtn.textContent = '⏱️ Auto Refresh (30s)';
					autoRefreshBtn.removeClass('active');
				} else {
					autoRefreshInterval = window.setInterval(refreshAll, 30000);
					autoRefreshBtn.textContent = '⏹️ Stop Auto Refresh';
					autoRefreshBtn.addClass('active');
				}
			});
			
			// Network management actions
			const actionsDiv = containerEl.createDiv('network-actions');
			actionsDiv.createEl('h4', { text: 'Network Management' });
			
			const refreshNetworkBtn = actionsDiv.createEl('button', { text: '🔄 Refresh Network Topology' });
			refreshNetworkBtn.addEventListener('click', async () => {
				try {
					await this.plugin.carnivalNetwork.refreshNetwork();
					refreshAll(); // Refresh the display
				} catch (e) {
					console.error('Network refresh error:', e);
				}
			});
			
			const disconnectBtn = actionsDiv.createEl('button', { text: '🚫 Disconnect Network' });
			disconnectBtn.addClass('mod-warning');
			disconnectBtn.addEventListener('click', async () => {
				try {
					await this.plugin.carnivalNetwork.disconnectNetwork();
					this.display(); // Re-render settings
				} catch (e) {
					console.error('Network disconnect error:', e);
				}
			});
			
			// Cache management actions
			const cacheActionsDiv = containerEl.createDiv('cache-actions');
			cacheActionsDiv.createEl('h4', { text: 'Cache Management' });
			
			const flushCacheBtn = cacheActionsDiv.createEl('button', { text: '💾 Flush Cache to Storage' });
			flushCacheBtn.addEventListener('click', async () => {
				try {
					const registryService = this.plugin.carnivalNetwork.getRegistryService();
					await registryService.flushCache();
					refreshAll(); // Refresh the display
				} catch (e) {
					console.error('Cache flush error:', e);
				}
			});
			
			const clearCacheBtn = cacheActionsDiv.createEl('button', { text: '🗑️ Clear Cache' });
			clearCacheBtn.addClass('mod-warning');
			clearCacheBtn.addEventListener('click', async () => {
				try {
					const registryService = this.plugin.carnivalNetwork.getRegistryService();
					await registryService.performerCache['clear'](); // Clear cache
					refreshAll(); // Refresh the display
				} catch (e) {
					console.error('Cache clear error:', e);
				}
			});
			
			// Initial load
			refreshAll();
		}
	}

	/**
	 * Get CSS class for network status
	 */
	private getStatusClass(status: string): string {
		switch (status.toLowerCase()) {
			case 'connected':
			case 'healthy':
				return 'status-healthy';
			case 'degraded':
			case 'warning':
				return 'status-warning';
			case 'disconnected':
			case 'error':
			case 'failed':
				return 'status-error';
			default:
				return 'status-unknown';
		}
	}

	/**
	 * Format uptime duration into human-readable format
	 */
	private formatUptime(uptimeMs: number): string {
		const seconds = Math.floor(uptimeMs / 1000);
		const minutes = Math.floor(seconds / 60);
		const hours = Math.floor(minutes / 60);
		const days = Math.floor(hours / 24);

		if (days > 0) {
			return `${days}d ${hours % 24}h`;
		} else if (hours > 0) {
			return `${hours}h ${minutes % 60}m`;
		} else if (minutes > 0) {
			return `${minutes}m ${seconds % 60}s`;
		} else {
			return `${seconds}s`;
		}
	}

	/**
	 * Get CSS class for cache hit rate
	 */
	private getCacheHitRateClass(hitRate: number): string {
		switch (true) {
			case hitRate >= 90:
				return 'cache-exceptional';
			case hitRate >= 80:
				return 'cache-excellent';
			case hitRate >= 60:
				return 'cache-good';
			case hitRate >= 40:
				return 'cache-fair';
			default:
				return 'cache-poor';
		}
	}

	/**
	 * Format bytes into human-readable format
	 */
	private formatBytes(bytes: number): string {
		if (bytes === 0) {
			return '0 B';
		}
		const k = 1024;
		const sizes = ['B', 'KB', 'MB', 'GB'];
		const i = Math.floor(Math.log(bytes) / Math.log(k));
		return `${Math.round((bytes / Math.pow(k, i)) * 100) / 100} ${sizes[i]}`;
	}

	private generateAPIKey(): string {
		// Generate secure random API key
		const array = new Uint8Array(32);
		crypto.getRandomValues(array);
		return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
	}
	
	private maskAPIKey(key: string): string {
		if (key.length <= 8) {
			return '****';
		}
		return `${key.substring(0, 4)}...${key.substring(key.length - 4)}`;
	}
}