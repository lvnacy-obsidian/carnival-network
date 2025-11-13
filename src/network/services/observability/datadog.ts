import { BaseObservabilityProvider } from './provider-abstract-base';
import { Log } from '../../../utils/logger';
import type {
	LogContext,
	MetricDataPoint
} from '../../../types/public';

const datadogObservabilityLogger: LogContext = {
	context: 'Observability Provider | Carnival Network | Datadog',
	path: '/.obsidian/plugins/carnival-network/services/observability'
};

/**
 * Datadog Provider - Datadog metrics API
 */
export class DatadogProvider extends BaseObservabilityProvider {
	constructor() {
		super('Datadog');
	}

	async sendMetrics(metrics: MetricDataPoint[]): Promise<void> {
		this.ensureInitialized();

		if (!this.config) {
			throw new Error('Elasticsearch client not initialized');
		}

		try {
			// Format metrics for Datadog API
			const series = this.formatDatadogMetrics(metrics);

			// Send to Datadog API
			const endpoint = this.config.endpoint || 'https://api.datadoghq.com';
			const { apiKey } = this.config;

			if (!apiKey) {
				throw new Error('Datadog API key is required');
			}

			const response = await fetch(`${endpoint}/api/v2/series`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'DD-API-KEY': apiKey
				},
				body: JSON.stringify({ series })
			});

			if (!response.ok) {
				const error = await response.text();
				throw new Error(`Datadog API returned ${response.status}: ${error}`);
			}

			Log.log(datadogObservabilityLogger, `📊 Sent ${metrics.length} metrics to Datadog`);
		} catch (error) {
			Log.error(datadogObservabilityLogger, 'Failed to send metrics to Datadog:', error);
			throw error;
		}
	}

	private formatDatadogMetrics(metrics: MetricDataPoint[]): unknown[] {
		return metrics.map(metric => ({
			metric: metric.name,
			type: this.getDatadogType(metric.type),
			points: [
				{
					timestamp: Math.floor(new Date(metric.timestamp).getTime() / 1000),
					value: metric.value
				}
			],
			tags: this.formatTags(metric.tags),
			resources: [
				{
					name: 'carnival-network',
					type: 'obsidian-plugin'
				}
			]
		}));
	}

	private formatTags(tags?: Record<string, string>): string[] {
		if (!tags) {
			return [];
		}
		
		return Object.entries(tags).map(([key, value]) => `${key}:${value}`);
	}

	private getDatadogType(type: MetricDataPoint['type']): number {
		// Datadog metric types: 0=gauge, 1=rate, 2=count
		switch (type) {
			case 'counter':
				return 2; // count
			case 'gauge':
				return 0; // gauge
			case 'histogram':
				return 0; // gauge (Datadog handles histograms differently)
			default:
				return 0;
		}
	}
}