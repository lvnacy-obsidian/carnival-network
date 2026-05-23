/**
 * ============================================================================
 * TERRITORY SELECTION MODAL
 * ============================================================================
 * 
 * Allows user to create a new territory or join an existing one
 */

import {
	App,
	Modal,
	Notice,
	Setting
} from 'obsidian';
import type CarnivalNetworkPlugin from '../../main';
import { Log } from '../../utils/logger';
import { LogContext } from '../../types/public';

export class TerritorySelectionModal extends Modal {
	private plugin: CarnivalNetworkPlugin;
	private territoryName = '';
	private modalLogger: LogContext;

	constructor(app: App, plugin: CarnivalNetworkPlugin) {
		super(app);
		this.plugin = plugin;
		this.modalLogger = {
			context: 'Territory Selection Modal',
			path: `${ this.app.vault.configDir }/plugins/carnival-network/src/ui/territory-selection-modal`
		};
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass('carnival-territory-modal');

		contentEl.createEl('h2', { text: 'Create or join a territory' });

		contentEl.createEl('p', {
			text: 'Enter a territory name to create a new territory or join an existing one.',
			cls: 'setting-item-description'
		});

		// Known territories
		const knownTerritories = this.plugin.registryManager?.getKnownTerritories() || [];
		
		if (knownTerritories.length > 0) {
			contentEl.createEl('h3', { text: 'Known territories' });
			const territoryGrid = contentEl.createDiv('territory-grid');
			
			knownTerritories.forEach(territory => {
				const isAssigned = (this.plugin.performerTerritories || []).includes(territory);
				const territoryBtn = territoryGrid.createEl('button', {
					text: territory,
					cls: isAssigned ? 'territory-button assigned' : 'territory-button'
				});
				
				if (isAssigned) {
					territoryBtn.createSpan({ text: ' ✓', cls: 'territory-check' });
				}
				
				territoryBtn.addEventListener('click', () => {
					if (isAssigned) {
						new Notice(`Already assigned to: ${territory}`);
					} else {
						this.plugin.registryManager?.addTerritory(territory).catch(error => {
							Log.error(this.modalLogger, 'Failed to add territory', error);
						});
						new Notice(`Joined territory: ${territory}`);
						this.close();
					}
				});
			});
		}

		contentEl.createEl('h3', { text: 'Create a new territory' });

		new Setting(contentEl)
			.setName('Territory name')
			.setDesc('Use lowercase letters, numbers, and hyphens')
			.addText(text => {
				text.setPlaceholder('my-custom-territory')
					.onChange(value => {
						this.territoryName = value.toLowerCase().replace(/[^a-z0-9-]/g, '-');
						text.setValue(this.territoryName);
					});
				text.inputEl.focus();
			});

		// Buttons
		const buttonContainer = contentEl.createDiv('modal-button-container');
		
		const createBtn = buttonContainer.createEl('button', {
			text: 'Create/Join',
			cls: 'mod-cta'
		});
		createBtn.addEventListener('click', () => {
			if (!this.territoryName || this.territoryName.trim().length === 0) {
				new Notice('Please enter a territory name');
				return;
			}

			try {
				this.plugin.registryManager?.addTerritory(this.territoryName).catch(error => {
					Log.error(this.modalLogger, 'Failed to add territory', error);
				});
				new Notice(`Successfully joined: ${this.territoryName}`);
				this.close();
			} catch (error) {
				new Notice(`Error: ${error.message}`);
			}
		});

		const cancelBtn = buttonContainer.createEl('button', { text: 'Cancel' });
		cancelBtn.addEventListener('click', () => this.close());
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}