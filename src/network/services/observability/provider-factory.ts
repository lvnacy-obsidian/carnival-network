import { CustomHTTPProvider } from './custom-provider';
import { DatadogProvider } from './datadog';
import { ElasticsearchProvider } from './elastic';
import { PrometheusProvider } from './prometheus';
import { SentryProvider } from './sentry';
import { ProviderConfigValidator } from './provider-config-validator';
import { ProviderConfigurationError } from '../../../errors/provider-configuration-error';
import { Log } from '../../../utils/logger';
import type {
	LogContext,
	ObservabilityConfig,
	ObservabilityProvider
} from '../../../types/public';

const providerFactoryLogger: LogContext = {
	context: 'Observability Provider Factory',
	path: '/.obsidian/plugins/carnival-network/services/observability'
};

/**
 * Provider Factory - Creates the appropriate provider instance
 */
export class ObservabilityProviderFactory {
	static createProvider(config: ObservabilityConfig): ObservabilityProvider {
		switch (config.provider) {
			case 'prometheus':
				return new PrometheusProvider();
			case 'datadog':
				return new DatadogProvider();
			case 'sentry':
				return new SentryProvider();
			case 'elasticsearch':
				return new ElasticsearchProvider();
			case 'custom':
				return new CustomHTTPProvider();
			default:
				throw new ProviderConfigurationError(
					'unknown',
					`Unknown observability provider: ${ config.provider }`
				);
		}
	}

	static async createAndInitialize(
		config: ObservabilityConfig,
		options?: {
			validateConfig?: boolean;
			testConnection?: boolean;
			throwOnValidationError?: boolean;
		}
	): Promise<ObservabilityProvider> {
		const {
			validateConfig = true,
			testConnection = false,
			throwOnValidationError = true
		} = options || {};

		if (!config.provider) {
			throw new ProviderConfigurationError(
				'unknown',
				'No observability provider specified in configuration'
			);
		}

		try {
			// Step 1: Validate configuration
			if (validateConfig) {
				Log.log(providerFactoryLogger, `🔍 Validating ${config.provider} configuration...`);
				
				try {
					ProviderConfigValidator.validate(config);
					Log.log(providerFactoryLogger, `✅ ${config.provider} configuration is valid`);
				} catch (error) {
					if (throwOnValidationError) {
						throw error;
					} else {
						Log.warn(providerFactoryLogger, `⚠️ Configuration validation warning: ${error}`);
					}
				}
			}

			// Step 2: Test connection (optional)
			if (testConnection) {
				Log.log(providerFactoryLogger, `🌐 Testing ${config.provider} connectivity...`);
				
				const connectionTest = await ProviderConfigValidator.testConnection(config);
				
				if (connectionTest.success) {
					Log.log(
						providerFactoryLogger,
						`✅ ${ config.provider } is reachable (${ connectionTest.latency }ms): ${ connectionTest.message }`
					);
				} else {
					const errorMsg = `❌ ${ config.provider } connection test failed: ${ connectionTest.message }`;
					
					if (throwOnValidationError) {
						throw new ProviderConfigurationError(
							config.provider,
							connectionTest.message
						);
					} else {
						Log.warn(providerFactoryLogger, errorMsg);
					}
				}
			}

			// Step 3: Create provider instance
			Log.log(providerFactoryLogger, `🏭 Creating ${config.provider} provider instance...`);
			const provider = this.createProvider(config);

			// Step 4: Initialize provider
			Log.log(providerFactoryLogger, `🚀 Initializing ${config.provider} provider...`);
			await provider.initialize(config);

			// Step 5: Verify initialization
			const isHealthy = await provider.isHealthy();
			if (!isHealthy) {
				throw new ProviderConfigurationError(
					config.provider,
					'Provider initialized but health check failed'
				);
			}

			Log.log(providerFactoryLogger, `✅ ${config.provider} provider ready!`);
			return provider;
		} catch (error) {
			Log.error(
				providerFactoryLogger,
				`❌ Failed to create ${config.provider} provider:`,
				error
			);
			throw error;
		}
	}

	/**
	 * Create provider with graceful degradation
	 * Returns null if provider creation fails instead of throwing
	 */
	static async createWithFallback(
		config: ObservabilityConfig
	): Promise<ObservabilityProvider | null> {
		try {
			return await this.createAndInitialize(config, {
				validateConfig: true,
				testConnection: false,
				throwOnValidationError: false
			});
		} catch (error) {
			Log.error(
				providerFactoryLogger,
				`Failed to create ${config.provider} provider, falling back to no observability:`,
				error
			);
			return null;
		}
	}

	/**
	 * Validate configuration without creating provider
	 */
	static validateConfiguration(config: ObservabilityConfig): {
		valid: boolean;
		errors: string[];
		warnings: string[];
	} {
		const errors: string[] = [];
		const warnings: string[] = [];

		try {
			ProviderConfigValidator.validate(config);
		} catch (error) {
			if (error instanceof ProviderConfigurationError) {
				errors.push(error.message);
			} else {
				errors.push(String(error));
			}
		}

		// Additional checks
		if (!config.enabled) {
			warnings.push('Provider is disabled in configuration');
		}

		if (config.flushIntervalMs && config.flushIntervalMs < 1000) {
			warnings.push('Flush interval is very short (< 1s), may cause high load');
		}

		if (config.batchSize && config.batchSize > 1000) {
			warnings.push('Batch size is very large (> 1000), may cause memory issues');
		}

		return {
			valid: errors.length === 0,
			errors,
			warnings
		};
	}

	/**
	 * Test all providers in a configuration array
	 */
	static async testMultipleProviders(
		configs: ObservabilityConfig[]
	): Promise<Map<string, {
		success: boolean;
		message: string;
		latency?: number;
	}>> {
		const results = new Map();

		for (const config of configs) {
			if (!config.enabled) {
				continue;
			}

			const result = await ProviderConfigValidator.testConnection(config);
			results.set(config.provider, result);
		}

		return results;
	}
}