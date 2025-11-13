import { BaseObservabilityProvider } from './provider-abstract-base';
import { Log } from '../../../utils/logger';
import type {
	LogContext,
	MetricDataPoint,
	ObservabilityConfig
} from '../../../types/public';

const sentryObservabilityLogger: LogContext = {
	context: 'Observability Provider | Carnival Network | Sentry',
	path: '/.obsidian/plugins/carnival-network/services/observability'
};

/**
 * Sentry Provider - Error tracking and performance monitoring
 * 
 * Note: This provider requires @sentry/browser or @sentry/node to be installed.
 * Install via: npm install @sentry/browser
 * 
 * For Node.js environments: npm install @sentry/node
 */
export class SentryProvider extends BaseObservabilityProvider {
	private Sentry?: any;
	private transaction?: any;
	private isNodeEnvironment: unknown = false;

	constructor() {
		super('Sentry');
	}

	async initialize(config: ObservabilityConfig): Promise<void> {
		await super.initialize(config);

		try {
			
			const dsn = config.endpoint;
			if (!dsn) {
				throw new Error('Sentry DSN is required in endpoint config');
			}

			// Detect environment and load appropriate Sentry SDK
			this.isNodeEnvironment = typeof process !== 'undefined' && process.versions?.node;
			
			try {
				// Try to load Sentry SDK
				if (this.isNodeEnvironment) {
					// Node.js environment
					this.Sentry = await import('@sentry/node');
				} else {
					// Browser environment
					this.Sentry = await import('@sentry/browser');
				}

				// Initialize Sentry with configuration
				this.Sentry.init({
					dsn,
					environment: config.environment || 'production',
					tracesSampleRate: config.sampleRate || 1.0,
					integrations: [
						new this.Sentry.BrowserTracing(),
					],
					beforeSend: (event: any) => {
						// Add custom processing if needed
						return event;
					}
				});

				// Create a long-running transaction for metrics
				this.transaction = this.Sentry.startTransaction({
					name: 'carnival-network-metrics',
					op: 'observability'
				});

				Log.log(sentryObservabilityLogger, `📊 Sentry initialized with DSN: ${dsn}`);
			} catch (importError) {
				// Sentry SDK not installed - provide helpful error
				throw new Error(
					`Sentry SDK not found. Install it with: npm install @sentry/${this.isNodeEnvironment ? 'node' : 'browser'}\n` +
					`Original error: ${importError}`
				);
			}
		} catch (error) {
			Log.error(sentryObservabilityLogger, 'Failed to initialize Sentry:', error);
			throw error;
		}
	}

	async sendMetrics(metrics: MetricDataPoint[]): Promise<void> {
		this.ensureInitialized();

		if (!this.Sentry) {
			throw new Error('Sentry SDK not loaded');
		}

		try {
			// Create a span for this metric batch
			const span = this.transaction?.startChild({
				op: 'metrics.batch',
				description: `Recording ${metrics.length} metrics`
			});

			// Process each metric
			for (const metric of metrics) {
				// Set tags for filtering in Sentry
				if (metric.tags) {
					for (const [key, value] of Object.entries(metric.tags)) {
						this.Sentry.setTag(key, value);
					}
				}

				// Record measurement
				this.Sentry.setMeasurement(
					metric.name,
					metric.value,
					this.getSentryUnit(metric.type)
				);

				// For counters, also create a breadcrumb
				if (metric.type === 'counter') {
					this.Sentry.addBreadcrumb({
						category: 'metric',
						message: `${metric.name}: ${metric.value}`,
						level: 'info',
						data: metric.tags
					});
				}
			}

			span?.finish();

			Log.log(sentryObservabilityLogger, `📊 Sent ${metrics.length} measurements to Sentry`);
		} catch (error) {
			Log.error(sentryObservabilityLogger, 'Failed to send metrics to Sentry:', error);
			
			// Report this error to Sentry itself
			this.Sentry?.captureException(error, {
				tags: {
					component: 'observability',
					provider: 'sentry'
				}
			});
			
			throw error;
		}
	}

	async isHealthy(): Promise<boolean> {
		if (!this.initialized || !this.Sentry) {
			return false;
		}

		try {
			// Check if Sentry client is properly initialized
			const client = this.Sentry.getCurrentHub?.()?.getClient();
			return !!client;
		} catch {
			return false;
		}
	}

	async cleanup(): Promise<void> {
		try {
			// Finish the transaction
			if (this.transaction) {
				this.transaction.finish();
				this.transaction = null;
			}

			// Flush any pending events
			if (this.Sentry) {
				await this.Sentry.close(2000); // 2 second timeout
			}

			await super.cleanup();
		} catch (error) {
			Log.error(sentryObservabilityLogger, 'Error during cleanup:', error);
		}
	}

	/**
	 * Get Sentry measurement unit from metric type
	 */
	private getSentryUnit(type: MetricDataPoint['type']): string {
		switch (type) {
			case 'counter':
				return 'none';
			case 'gauge':
				return 'none';
			case 'histogram':
				return 'millisecond'; // Assuming histograms are timing data
			default:
				return 'none';
		}
	}
}