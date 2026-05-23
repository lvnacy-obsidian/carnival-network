/**
 * ============================================================================
 * TERRITORY MANAGEMENT MODAL
 * ============================================================================
 * 
 * Shows all assigned territories with management options
 */

import {
	App,
	Modal,
	Notice,
} from 'obsidian';
import { TerritorySelectionModal } from './territory-selection-modal';
import type CarnivalNetworkPlugin from '../../main';
import { Log } from '../../utils/logger';
import { LogContext } from '../../types/public';

export class TerritoryManagementModal extends Modal {
	private plugin: CarnivalNetworkPlugin;
	private modalLogger: LogContext;

	constructor(app: App, plugin: CarnivalNetworkPlugin) {
		super(app);
		this.plugin = plugin;
		this.modalLogger = {
			context: 'Territory Management Modal',
			path: `${ app.vault.configDir }/plugins/carnival-network/src/ui/modals/territory-management-modal`
		};
	}

	onOpen() {
		this.render();
	}

	private render() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass('carnival-territory-modal');

		contentEl.createEl('h2', { text: 'Manage territories' });

		const assigned = this.plugin.performerTerritories || [];

		if (assigned.length === 0) {
			contentEl.createEl('p', {
				text: 'No territories assigned. Using default: general',
				cls: 'carnival-info-box'
			});
		} else {
			contentEl.createEl('p', {
				text: `Assigned to ${assigned.length} ${assigned.length === 1 ? 'territory' : 'territories'}`,
				cls: 'setting-item-description'
			});

			const territoryList = contentEl.createDiv('carnival-territory-list');

			assigned.forEach((territory, index) => {
				const territoryItem = territoryList.createDiv('territory-item');
				
				const territoryName = territoryItem.createDiv('territory-name');
				territoryName.createSpan({ text: territory });
				
				if (index === 0) {
					territoryName.createSpan({
						text: ' Primary',
						cls: 'carnival-badge carnival-badge-primary'
					});
				}

				const territoryActions = territoryItem.createDiv('territory-actions');

				// Set as Primary button
				if (index !== 0) {
					const primaryBtn = territoryActions.createEl('button', {
						text: 'Set primary',
						cls: 'mod-muted'
					});
					primaryBtn.addEventListener('click', () => {
						const newOrder = [territory, ...assigned.filter(t => t !== territory)];
						this.plugin.registryManager?.assignTerritories(newOrder).catch(error => {
							Log.error(this.modalLogger, 'Failed to assign territories', error);
						});
						new Notice(`${territory} is now your primary territory`);
						this.render();
					});
				}

				// Remove button
				const removeBtn = territoryActions.createEl('button', {
					text: 'Leave',
					cls: 'mod-warning'
				});
				removeBtn.addEventListener('click', () => {
					if (assigned.length === 1) {
						if (!confirm('Leave your only territory? You will be assigned to "general".')) {
							return;
						}
					}
					this.plugin.registryManager?.removeTerritory(territory).catch(error => {
						Log.error(this.modalLogger, 'Failed to remove territory', error);
					});
					new Notice(`Left territory: ${territory}`);
					this.render();
				});
			});
		}

		// Add Territory button
		const buttonContainer = contentEl.createDiv('modal-button-container');
		
		const addBtn = buttonContainer.createEl('button', {
			text: 'Add Territory',
			cls: 'mod-cta'
		});
		addBtn.addEventListener('click', () => {
			this.close();
			const modal = new TerritorySelectionModal(this.app, this.plugin);
			modal.open();
		});

		const closeBtn = buttonContainer.createEl('button', { text: 'Close' });
		closeBtn.addEventListener('click', () => this.close());
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}