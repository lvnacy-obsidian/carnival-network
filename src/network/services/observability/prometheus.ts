import { BaseObservabilityProvider } from './provider-abstract-base';
import { Log } from '../../../utils/logger';
import type {
	LogContext,
	MetricDataPoint
} from '../../../types/public';

const prometheusObservabilityLogger: LogContext = {
	context: 'Observability Provider | Carnival Network | Prometheus',
	path: '/.obsidian/plugins/carnival-network/services/observability'
};

/**
 * Prometheus Provider - Pushgateway integration
 */
export class PrometheusProvider extends BaseObservabilityProvider {
	constructor() {
		super('Prometheus');
	}

	async sendMetrics(metrics: MetricDataPoint[]): Promise<void> {
		this.ensureInitialized();

		try {
			// Format metrics in Prometheus text format
			const prometheusText = this.formatPrometheusMetrics(metrics);

			if (!this.config || this.config.provider !== 'prometheus') {
				throw new Error('PrometheusProvider is not properly configured.');
			}

			// Send to pushgateway
			const endpoint = this.config.endpoint ?? 'http://localhost:9091';
			const job = 'carnival_network';
			const instance = 'obsidian';

			const response = await fetch(
				`${endpoint}/metrics/job/${job}/instance/${instance}`,
				{
					method: 'POST',
					headers: {
						'Content-Type': 'text/plain'
					},
					body: prometheusText
				}
			);

			if (!response.ok) {
				throw new Error(`Prometheus pushgateway returned ${response.status}`);
			}

			Log.log(prometheusObservabilityLogger, `📊 Sent ${metrics.length} metrics to Prometheus`);
		} catch (error) {
			Log.error(prometheusObservabilityLogger, 'Failed to send metrics to Prometheus:', error);
			throw error;
		}
	}

	private formatPrometheusMetrics(metrics: MetricDataPoint[]): string {
		const lines: string[] = [];

		for (const metric of metrics) {
			// Format: metric_name{tag1="value1",tag2="value2"} value timestamp
			const labels = this.formatLabels(metric.tags);
			const metricName = this.sanitizeMetricName(metric.name);
			
			// Add type hint
			const typeHint = this.getPrometheusType(metric.type);
			lines.push(`# TYPE ${metricName} ${typeHint}`);
			
			// Add metric value
			const timestamp = new Date(metric.timestamp).getTime();
			lines.push(`${metricName}${labels} ${metric.value} ${timestamp}`);
		}

		return `${ lines.join('\n') }\n`;
	}

	private formatLabels(tags?: Record<string, string>): string {
		if (!tags || Object.keys(tags).length === 0) {
			return '';
		}

		const labelPairs = Object.entries(tags)
			.map(([key, value]) => `${this.sanitizeLabel(key)}="${this.escapeLabel(value)}"`)
			.join(',');

		return `{${labelPairs}}`;
	}

	private sanitizeMetricName(name: string): string {
		// Prometheus metric names can only contain [a-zA-Z0-9:_]
		return name.replace(/[^a-zA-Z0-9:_]/g, '_');
	}

	private sanitizeLabel(label: string): string {
		// Label names can only contain [a-zA-Z0-9_]
		return label.replace(/[^a-zA-Z0-9_]/g, '_');
	}

	private escapeLabel(value: string): string {
		// Escape backslashes, newlines, and quotes
		return value
			.replace(/\\/g, '\\\\')
			.replace(/\n/g, '\\n')
			.replace(/"/g, '\\"');
	}

	private getPrometheusType(type: MetricDataPoint['type']): string {
		switch (type) {
			case 'counter':
				return 'counter';
			case 'gauge':
				return 'gauge';
			case 'histogram':
				return 'histogram';
			default:
				return 'gauge';
		}
	}
}