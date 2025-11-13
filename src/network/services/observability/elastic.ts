import { BaseObservabilityProvider } from './provider-abstract-base';
import { Log } from '../../../utils/logger';
import type {
	LogContext,
	MetricDataPoint
} from '../../../types/public';

const elasticObservabilityLogger: LogContext = {
	context: 'Observability Provider | Carnival Network | Elasticsearch',
	path: '/.obsidian/plugins/carnival-network/services/observability'
};

/**
 * Elasticsearch Provider - Log aggregation and metrics storage
 */
export class ElasticsearchProvider extends BaseObservabilityProvider {
	private indexPrefix = 'carnival-metrics';

	constructor() {
		super('Elasticsearch');
	}

	async sendMetrics(metrics: MetricDataPoint[]): Promise<void> {
		this.ensureInitialized();

		if (!this.config) {
			throw new Error('Elasticsearch client not initialized');
		}

		try {
			// Format for Elasticsearch bulk API
			const bulkBody = this.formatElasticsearchBulk(metrics);

			// Send to Elasticsearch bulk API
			const endpoint = this.config.endpoint ?? 'http://localhost:9200';
			const { apiKey } = this.config;

			const headers: Record<string, string> = {
				'Content-Type': 'application/x-ndjson'
			};

			if (apiKey) {
				headers['Authorization'] = `ApiKey ${apiKey}`;
			}

			const response = await fetch(`${endpoint}/_bulk`, {
				method: 'POST',
				headers,
				body: bulkBody
			});

			if (!response.ok) {
				const error = await response.text();
				throw new Error(`Elasticsearch returned ${response.status}: ${error}`);
			}

			const result = await response.json();
			if (result.errors) {
				Log.warn(elasticObservabilityLogger, 'Some Elasticsearch operations failed:', result.items);
			}

			Log.log(elasticObservabilityLogger, `📊 Sent ${metrics.length} metrics to Elasticsearch`);
		} catch (error) {
			Log.error(elasticObservabilityLogger, 'Failed to send metrics to Elasticsearch:', error);
			throw error;
		}
	}

	private formatElasticsearchBulk(metrics: MetricDataPoint[]): string {
		const lines: string[] = [];
		const today = new Date().toISOString().split('T')[0];
		const index = `${this.indexPrefix}-${today}`;

		for (const metric of metrics) {
			// Index operation
			lines.push(JSON.stringify({
				index: { _index: index }
			}));

			// Document
			lines.push(JSON.stringify({
				'@timestamp': metric.timestamp,
				metric_name: metric.name,
				metric_value: metric.value,
				metric_type: metric.type,
				...metric.tags
			}));
		}

		return `${ lines.join('\n') }\n`;
	}
}