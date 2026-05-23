/**
 * ============================================================================
 * PRIMARY TERRITORY SELECTOR MODAL
 * ============================================================================
 * 
 * Quick selector for changing primary territory
 */

import {
	App,
	Modal,
	Notice,
} from 'obsidian';
import type CarnivalNetworkPlugin from '../../main';
import { Log } from '../../utils/logger';
import { LogContext } from '../../types/public';

export class PrimaryTerritorySelectorModal extends Modal {
	private plugin: CarnivalNetworkPlugin;
	private territories: string[];
	private modalLogger: LogContext;

	constructor(app: App, plugin: CarnivalNetworkPlugin, territories: string[]) {
		super(app);
		this.plugin = plugin;
		this.territories = territories;
		this.modalLogger = {
			context: 'Primary Territory Selector Modal',
			path: `${ app.vault.configDir }/plugins/carnival-network/src/ui/modals/primary-territory-selector`
		};
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass('carnival-territory-modal');

		contentEl.createEl('h2', { text: 'Set primary territory' });

		contentEl.createEl('p', {
			text: 'Select which territory should be your primary territory. This is used for default registration.',
			cls: 'setting-item-description'
		});

		const territoryList = contentEl.createDiv('carnival-territory-select-list');

		this.territories.forEach((territory, index) => {
			const territoryBtn = territoryList.createEl('button', {
				text: territory,
				cls: index === 0 ? 'territory-button primary' : 'territory-button'
			});

			if (index === 0) {
				territoryBtn.createSpan({ text: ' (Current Primary)', cls: 'territory-badge' });
			}

			territoryBtn.addEventListener('click', () => {
				if (index === 0) {
					new Notice('Already set as primary');
					return;
				}

				const newOrder = [territory, ...this.territories.filter(t => t !== territory)];
				this.plugin.registryManager?.assignTerritories(newOrder).catch(error => {
					Log.error(this.modalLogger, 'Failed to assign territories', error);
				});
				new Notice(`${territory} is now your primary territory`);
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