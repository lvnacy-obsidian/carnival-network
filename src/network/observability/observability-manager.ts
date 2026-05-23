import {
	App,
	PluginManifest
} from 'obsidian';
import { Log } from '../../utils/logger';
import type CarnivalNetworkPlugin from '../../main';
import { ObservabilityProviderFactory } from './provider-factory';
import { registerMetricsEndpoint } from './metrics';
import { getPlugin } from '../../utils/plugin-utils';
import type {
	LocalRestAPIPlugin,
	LocalRestAPIPublic,
	LogContext
} from '../../types/public';

interface LocalRestAPIAccessor {
	getPublicApi?: (manifest: PluginManifest) => unknown;
	getAPI?: (app: App, manifest: PluginManifest) => unknown;
}

export class ObservabilityManager {
	private observabilityLogger: LogContext;

	constructor(
		private plugin: CarnivalNetworkPlugin
	) {
		this.observabilityLogger = {
			context: 'Observability Manager',
			path: `${ plugin.app.vault.configDir }/plugins/carnival-network/src/network/services/observability/observability-manager`
		};
	}

	/**
	 * Apply the current observability configuration: unregister any existing
	 * metrics endpoint, cleanup existing provider, then register/initialize
	 * according to the saved settings.
	 */
	async applyObservabilityConfig(): Promise<void> {
		// Cleanup existing provider
		try {
			if (this.plugin.observabilityProvider) {
				await this.plugin.observabilityProvider.cleanup();
				this.plugin.observabilityProvider = null;
			}
		} catch (err) {
			Log.warn(this.observabilityLogger, 'Error cleaning up previous observability provider:', err);
		}

		// Unregister previously registered metrics route (if any)
		try {
			if (this.plugin.localRestAPIPublic && typeof this.plugin.localRestAPIPublic.unregister === 'function') {
				this.plugin.localRestAPIPublic.unregister();
				this.plugin.localRestAPIPublic = null;
			}
		} catch (err) {
			Log.warn(this.observabilityLogger, 'Error unregistering previous Local REST API extension:', err);
		}

		// Re-register according to new settings
		try {
			const obsCfg = this.plugin.settings?.observability;
			const localRestApi = getPlugin<LocalRestAPIPlugin>(this.plugin.app, 'obsidian-local-rest-api');

			if (localRestApi && obsCfg?.metricsEnabled) {
				const restApiAccessor = localRestApi as unknown as LocalRestAPIAccessor;

				const publicApi = restApiAccessor.getPublicApi?.(this.plugin.manifest) ?? restApiAccessor.getAPI?.(this.plugin.app, this.plugin.manifest);
				if (publicApi) {
					this.plugin.localRestAPIPublic = publicApi as LocalRestAPIPublic;
					registerMetricsEndpoint(this.plugin.localRestAPIPublic);
				}
			}

			if (obsCfg?.enabled && obsCfg.provider) {
				this.plugin.observabilityProvider = await ObservabilityProviderFactory.createWithFallback(obsCfg);
				if (this.plugin.observabilityProvider) {
					Log.log(this.observabilityLogger, `📡 Observability provider ready: ${obsCfg.provider}`);
				}
			}
		} catch (err) {
			Log.warn(this.observabilityLogger, 'Failed to apply observability configuration:', err);
		}
	}
}