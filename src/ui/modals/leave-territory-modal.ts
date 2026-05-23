/**
 * ============================================================================
 * LEAVE TERRITORY MODAL
 * ============================================================================
 * 
 * Quick selector for leaving a territory
 */

import {
	App,
	Modal,
	Notice
} from 'obsidian';
import type CarnivalNetworkPlugin from '../../main';
import { Log } from '../../utils/logger';
import { LogContext } from '../../types/public';

export class LeaveTerritoryModal extends Modal {
	private plugin: CarnivalNetworkPlugin;
	private territories: string[];
	private modalLogger: LogContext;

	constructor(app: App, plugin: CarnivalNetworkPlugin, territories: string[]) {
		super(app);
		this.plugin = plugin;
		this.territories = territories;
		this.modalLogger = {
			context: 'Leave Territory Modal',
			path: `${ app.vault.configDir }/plugins/carnival-network/src/ui/leave-territory-modal`
		};
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass('carnival-territory-modal');

		contentEl.createEl('h2', { text: 'Leave territory' });

		contentEl.createEl('p', {
			text: 'Select a territory to leave.',
			cls: 'setting-item-description'
		});

		const territoryList = contentEl.createDiv('carnival-territory-select-list');

		this.territories.forEach((territory, index) => {
			const territoryBtn = territoryList.createEl('button', {
				text: territory,
				cls: 'territory-button warning'
			});

			if (index === 0) {
				territoryBtn.createSpan({ text: ' (Primary)', cls: 'territory-badge' });
			}

			territoryBtn.addEventListener('click', () => {
				if (this.territories.length === 1) {
					if (!confirm(`Leave your only territory (${territory})? You will be assigned to "general".`)) {
						return;
					}
				}

				this.plugin.registryManager?.removeTerritory(territory).catch(error => {
					Log.error(this.modalLogger, 'Failed to remove territory', error);
				});
				new Notice(`Left territory: ${territory}`);
				this.close();
			});
		});

		const buttonContainer = contentEl.createDiv('modal-button-container');
		const cancelBtn = buttonContainer.createEl('button', { text: 'Cancel' });
		cancelBtn.addEventListener('click', () => this.close());
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}