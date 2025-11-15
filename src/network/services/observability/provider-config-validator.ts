import { ObservabilityConfig } from '../../../types/public';
import { ProviderConfigurationError } from '../../../errors/provider-configuration-error';

/**
 * Provider configuration validator — webhook-only.
 * The plugin exposes a central metrics endpoint; external systems should
 * consume metrics from there when possible. Webhook remains supported for
 * push-style consumers.
 */
export class ProviderConfigValidator {
	static validate(config: ObservabilityConfig): void {
		if (!config.provider) {
			throw new ProviderConfigurationError('unknown', 'Provider type is required');
		}

		if (config.provider !== 'webhook') {
			throw new ProviderConfigurationError(
				config.provider ?? 'unknown',
				`Unsupported provider: ${config.provider}. Only 'webhook' is supported.`
			);
		}

		// For webhook provider, an endpoint must be configured.
		if (!config.endpoint || typeof config.endpoint !== 'string' || config.endpoint.trim() === '') {
			throw new ProviderConfigurationError('webhook', 'Webhook endpoint URL is required', 'endpoint');
		}

		// Optional: basic URL validation
		try {
			new URL(config.endpoint);
		} catch {
			throw new ProviderConfigurationError('webhook', 'Webhook endpoint must be a valid URL', 'endpoint');
		}
	}
}