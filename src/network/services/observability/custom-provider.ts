import { BaseObservabilityProvider } from './provider-abstract-base';
import { Log } from '../../../utils/logger';
import type {
	LogContext,
	MetricDataPoint
} from '../../../types/public';

const customObservabilityLogger: LogContext = {
	context: 'Observability Provider | Carnival Network | Custom HTTP',
	path: '/.obsidian/plugins/carnival-network/services/observability'
};

/**
 * Custom HTTP Provider - Generic HTTP endpoint
 */
export class CustomHTTPProvider extends BaseObservabilityProvider {
	constructor() {
		super('Custom HTTP');
	}

	async sendMetrics(metrics: MetricDataPoint[]): Promise<void> {
		this.ensureInitialized();

		if (!this.config) {
			throw new Error('Elasticsearch client not initialized');
		}

		try {
			const { endpoint } = this.config;
			if (!endpoint) {
				throw new Error('Custom HTTP endpoint is required');
			}

			const headers: Record<string, string> = {
				'Content-Type': 'application/json'
			};

			// Add API key if provided
			if (this.config.apiKey) {
				headers['Authorization'] = `Bearer ${this.config.apiKey}`;
			}

			// Allow custom headers from config
			const { customHeaders } = (this.config as any);
			if (customHeaders) {
				Object.assign(headers, customHeaders);
			}

			const response = await fetch(endpoint, {
				method: (this.config as any).method ?? 'POST',
				headers,
				body: JSON.stringify({
					metrics,
					timestamp: new Date().toISOString(),
					source: 'carnival-network'
				})
			});

			if (!response.ok) {
				throw new Error(`Custom endpoint returned ${response.status}`);
			}

			Log.log(customObservabilityLogger, `📊 Sent ${metrics.length} metrics to custom endpoint`);
		} catch (error) {
			Log.error(customObservabilityLogger, 'Failed to send metrics to custom endpoint:', error);
			throw error;
		}
	}
}