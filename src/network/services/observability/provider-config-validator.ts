import { ObservabilityConfig } from '../../../types/public';
import { ProviderConfigurationError } from '../../../errors/provider-configuration-error';

/**
 * Provider configuration validator
 */
export class ProviderConfigValidator {
	/**
	 * Validate configuration for any provider
	 */
	static validate(config: ObservabilityConfig): void {
		// Common validation
		if (!config.provider) {
			throw new ProviderConfigurationError(
				'unknown',
				'Provider type is required'
			);
		}

		// Provider-specific validation
		switch (config.provider) {
			case 'prometheus':
				this.validatePrometheus(config);
				break;
			case 'datadog':
				this.validateDatadog(config);
				break;
			case 'sentry':
				this.validateSentry(config);
				break;
			case 'elasticsearch':
				this.validateElasticsearch(config);
				break;
			case 'custom':
				this.validateCustom(config);
				break;
			default:
				throw new ProviderConfigurationError(
					config.provider,
					`Unknown provider type: ${config.provider}`
				);
		}
	}

	/**
	 * Validate Prometheus configuration
	 */
	private static validatePrometheus(config: ObservabilityConfig): void {
		const endpoint = config.endpoint || 'http://localhost:9091';
		
		// Validate endpoint format
		if (!this.isValidUrl(endpoint)) {
			throw new ProviderConfigurationError(
				'prometheus',
				'Invalid pushgateway endpoint URL',
				'endpoint'
			);
		}

		// Warn if not using standard port
		if (!endpoint.includes(':9091')) {
			console.warn('[Prometheus] Non-standard port detected. Default is 9091.');
		}
	}

	/**
	 * Validate Datadog configuration
	 */
	private static validateDatadog(config: ObservabilityConfig): void {
		// API key is required
		if (!config.apiKey) {
			throw new ProviderConfigurationError(
				'datadog',
				'API key is required for Datadog',
				'apiKey'
			);
		}

		// Validate API key format (should be 32 chars)
		if (config.apiKey.length !== 32) {
			console.warn('[Datadog] API key length unusual. Expected 32 characters.');
		}

		// Validate endpoint if provided
		const endpoint = config.endpoint || 'https://api.datadoghq.com';
		if (!this.isValidUrl(endpoint)) {
			throw new ProviderConfigurationError(
				'datadog',
				'Invalid Datadog API endpoint URL',
				'endpoint'
			);
		}

		// Validate region-specific endpoints
		if (endpoint.includes('datadoghq.eu') && !config.endpoint) {
			console.warn('[Datadog] EU region detected. Ensure correct endpoint is configured.');
		}
	}

	/**
	 * Validate Sentry configuration
	 */
	private static validateSentry(config: ObservabilityConfig): void {
		// DSN is required (stored in endpoint field)
		if (!config.endpoint) {
			throw new ProviderConfigurationError(
				'sentry',
				'Sentry DSN is required',
				'endpoint'
			);
		}

		// Validate DSN format
		if (!this.isValidSentryDsn(config.endpoint)) {
			throw new ProviderConfigurationError(
				'sentry',
				'Invalid Sentry DSN format. Expected: https://<key>@<organization>.ingest.sentry.io/<project>',
				'endpoint'
			);
		}

		// Validate sample rate if provided
		const sampleRate = (config as any).sampleRate;
		if (sampleRate !== undefined) {
			if (typeof sampleRate !== 'number' || sampleRate < 0 || sampleRate > 1) {
				throw new ProviderConfigurationError(
					'sentry',
					'Sample rate must be a number between 0 and 1',
					'sampleRate'
				);
			}
		}
	}

	/**
	 * Validate Elasticsearch configuration
	 */
	private static validateElasticsearch(config: ObservabilityConfig): void {
		const endpoint = config.endpoint || 'http://localhost:9200';

		// Validate endpoint format
		if (!this.isValidUrl(endpoint)) {
			throw new ProviderConfigurationError(
				'elasticsearch',
				'Invalid Elasticsearch endpoint URL',
				'endpoint'
			);
		}

		// If using cloud, API key is required
		if (endpoint.includes('elastic.co') && !config.apiKey) {
			throw new ProviderConfigurationError(
				'elasticsearch',
				'API key is required for Elasticsearch Cloud',
				'apiKey'
			);
		}

		// Validate index prefix if provided
		const indexPrefix = (config as any).indexPrefix;
		if (indexPrefix && !/^[a-z0-9][a-z0-9-]*$/.test(indexPrefix)) {
			throw new ProviderConfigurationError(
				'elasticsearch',
				'Index prefix must start with lowercase letter or number and contain only lowercase letters, numbers, and hyphens',
				'indexPrefix'
			);
		}
	}

	/**
	 * Validate custom HTTP provider configuration
	 */
	private static validateCustom(config: ObservabilityConfig): void {
		// Endpoint is required
		if (!config.endpoint) {
			throw new ProviderConfigurationError(
				'custom',
				'Endpoint URL is required for custom provider',
				'endpoint'
			);
		}

		// Validate endpoint format
		if (!this.isValidUrl(config.endpoint)) {
			throw new ProviderConfigurationError(
				'custom',
				'Invalid endpoint URL',
				'endpoint'
			);
		}

		// Validate HTTP method if provided
		const method = config.method || 'POST';
		if (!['POST', 'PUT', 'PATCH'].includes(method)) {
			throw new ProviderConfigurationError(
				'custom',
				'HTTP method must be POST, PUT, or PATCH',
				'method'
			);
		}

		// Validate custom headers if provided
		if (config.customHeaders) {
			for (const [key, value] of Object.entries(config.customHeaders)) {
				if (typeof value !== 'string') {
					throw new ProviderConfigurationError(
						'custom',
						`Custom header "${key}" must be a string`,
						'customHeaders'
					);
				}
			}
		}
	}

	/**
	 * Helper: Validate URL format
	 */
	private static isValidUrl(url: string): boolean {
		try {
			new URL(url);
			return true;
		} catch {
			return false;
		}
	}

	/**
	 * Helper: Validate Sentry DSN format
	 */
	private static isValidSentryDsn(dsn: string): boolean {
		// Sentry DSN format: https://<key>@<organization>.ingest.sentry.io/<project>
		const dsnPattern = /^https:\/\/[a-f0-9]+@[a-z0-9-]+\.ingest\.sentry\.io\/\d+$/;
		return dsnPattern.test(dsn);
	}

	/**
	 * Test provider connectivity
	 */
	static async testConnection(config: ObservabilityConfig): Promise<{
		success: boolean;
		message: string;
		latency?: number;
	}> {
		const startTime = Date.now();

		try {
			switch (config.provider) {
				case 'prometheus':
					return await this.testPrometheus(config);
				case 'datadog':
					return await this.testDatadog(config);
				case 'sentry':
					return await this.testSentry(config);
				case 'elasticsearch':
					return await this.testElasticsearch(config);
				case 'custom':
					return await this.testCustom(config);
				default:
					return {
						success: false,
						message: `Unknown provider: ${config.provider}`
					};
			}
		} catch (error) {
			return {
				success: false,
				message: `Connection test failed: ${error}`,
				latency: Date.now() - startTime
			};
		}
	}

	/**
	 * Test Prometheus connectivity
	 */
	private static async testPrometheus(config: ObservabilityConfig): Promise<{
		success: boolean;
		message: string;
		latency?: number;
	}> {
		const startTime = Date.now();
		const endpoint = config.endpoint || 'http://localhost:9091';

		try {
			// Prometheus pushgateway doesn't have a health endpoint
			// Try to get metrics to verify it's reachable
			const response = await fetch(`${endpoint}/metrics`, {
				method: 'GET'
			});

			const latency = Date.now() - startTime;

			if (response.ok) {
				return {
					success: true,
					message: 'Prometheus pushgateway is reachable',
					latency
				};
			} else {
				return {
					success: false,
					message: `Prometheus returned ${response.status}`,
					latency
				};
			}
		} catch (error) {
			return {
				success: false,
				message: `Cannot reach Prometheus: ${error}`,
				latency: Date.now() - startTime
			};
		}
	}

	/**
	 * Test Datadog connectivity
	 */
	private static async testDatadog(config: ObservabilityConfig): Promise<{
		success: boolean;
		message: string;
		latency?: number;
	}> {
		const startTime = Date.now();
		const endpoint = config.endpoint || 'https://api.datadoghq.com';

		try {
			// Validate API endpoint is reachable
			const response = await fetch(`${endpoint}/api/v1/validate`, {
				method: 'GET',
				headers: {
					'DD-API-KEY': config.apiKey || ''
				}
			});

			const latency = Date.now() - startTime;

			if (response.ok) {
				return {
					success: true,
					message: 'Datadog API is reachable and API key is valid',
					latency
				};
			} else {
				return {
					success: false,
					message: `Datadog API returned ${response.status}`,
					latency
				};
			}
		} catch (error) {
			return {
				success: false,
				message: `Cannot reach Datadog: ${error}`,
				latency: Date.now() - startTime
			};
		}
	}

	/**
	 * Test Sentry connectivity
	 */
	private static async testSentry(config: ObservabilityConfig): Promise<{
		success: boolean;
		message: string;
		latency?: number;
	}> {
		const startTime = Date.now();

		try {
			// Extract project URL from DSN
			const dsnUrl = new URL(config.endpoint || '');
			const projectId = dsnUrl.pathname.substring(1);
			const host = dsnUrl.hostname;

			// Try to reach Sentry's health endpoint
			const response = await fetch(`https://${host}/api/0/projects/${projectId}/`, {
				method: 'HEAD'
			});

			const latency = Date.now() - startTime;

			// Even 401/403 means we reached the endpoint
			if (response.status < 500) {
				return {
					success: true,
					message: 'Sentry endpoint is reachable',
					latency
				};
			} else {
				return {
					success: false,
					message: `Sentry returned ${response.status}`,
					latency
				};
			}
		} catch (error) {
			return {
				success: false,
				message: `Cannot reach Sentry: ${error}`,
				latency: Date.now() - startTime
			};
		}
	}

	/**
	 * Test Elasticsearch connectivity
	 */
	private static async testElasticsearch(config: ObservabilityConfig): Promise<{
		success: boolean;
		message: string;
		latency?: number;
	}> {
		const startTime = Date.now();
		const endpoint = config.endpoint || 'http://localhost:9200';

		try {
			const headers: Record<string, string> = {};
			if (config.apiKey) {
				headers['Authorization'] = `ApiKey ${config.apiKey}`;
			}

			const response = await fetch(`${endpoint}/_cluster/health`, {
				method: 'GET',
				headers
			});

			const latency = Date.now() - startTime;

			if (response.ok) {
				const health = await response.json();
				return {
					success: true,
					message: `Elasticsearch cluster is ${health.status}`,
					latency
				};
			} else {
				return {
					success: false,
					message: `Elasticsearch returned ${response.status}`,
					latency
				};
			}
		} catch (error) {
			return {
				success: false,
				message: `Cannot reach Elasticsearch: ${error}`,
				latency: Date.now() - startTime
			};
		}
	}

	/**
	 * Test custom endpoint connectivity
	 */
	private static async testCustom(config: ObservabilityConfig): Promise<{
		success: boolean;
		message: string;
		latency?: number;
	}> {
		const startTime = Date.now();
		const endpoint = config.endpoint || '';

		try {
			const headers: Record<string, string> = {
				'Content-Type': 'application/json'
			};

			if (config.apiKey) {
				headers['Authorization'] = `Bearer ${config.apiKey}`;
			}

			if (config.customHeaders) {
				Object.assign(headers, config.customHeaders);
			}

			// Send a test payload
			const response = await fetch(endpoint, {
				method: 'HEAD', // Use HEAD to avoid sending actual data
				headers
			});

			const latency = Date.now() - startTime;

			// Any response < 500 is considered success (even 404/405)
			if (response.status < 500) {
				return {
					success: true,
					message: `Custom endpoint is reachable (returned ${response.status})`,
					latency
				};
			} else {
				return {
					success: false,
					message: `Custom endpoint returned ${response.status}`,
					latency
				};
			}
		} catch (error) {
			return {
				success: false,
				message: `Cannot reach custom endpoint: ${error}`,
				latency: Date.now() - startTime
			};
		}
	}
}