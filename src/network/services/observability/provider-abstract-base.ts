/**
 * Initialize the provider with configuration.
 * Base implementation is synchronous but returns Promise to satisfy interface contract.
 * Concrete providers may override with actual async initialization.
 */

/* eslint-disable require-await */
import { CircuitBreaker } from '../../circuit-breaker';
import { Log } from '../../../utils/logger';
import type {
	DeadLetterEntry,
	LogContext,
	MetricDataPoint,
	ObservabilityConfig,
	ObservabilityProvider,
	RetryConfig
} from '../../../types/public';

const observabilityLogger: LogContext = {
	context: 'Observability Providers',
	path: '/.obsidian/plugins/carnival-network/services/observability'
};

/**
 * Abstract base class for observability providers
 */
export abstract class BaseObservabilityProvider implements ObservabilityProvider {
	protected config?: ObservabilityConfig;
	protected initialized = false;
	protected circuitBreaker?: CircuitBreaker;
	protected deadLetterQueue: DeadLetterEntry[] = [];

	// Retry configuration
	private retryConfig: RetryConfig = {
		maxRetries: 3,
		baseDelayMs: 1000,
		maxDelayMs: 30000,
		backoffMultiplier: 2
	};

	// Metrics tracking
	private metricsSucceeded = 0;
	private metricsFailed = 0;
	private metricsInDeadLetter = 0;

	constructor(public readonly name: string) {}

	/**
	 * ============================================================================
	 * INTERFACE IMPLEMENTATION
	 * ============================================================================
	 */

	/**
	 * Initialize the provider with configuration
	 */
	async initialize(config: ObservabilityConfig): Promise<void> {
		this.config = config;
		
		// Initialize circuit breaker for this provider
		this.circuitBreaker = new CircuitBreaker(
			`observability-${ this.name }`,
			{
				failureThreshold: 5,
				successThreshold: 2,
				timeout: 60000, // 1 minute
				resetTimeout: 30000 // 30 seconds
			}
		);

		this.initialized = true;
		Log.log(observabilityLogger, `📊 ${ this.name } provider initialized`);
	}

	/**
	 * Send metrics with retry logic and circuit breaker protection
	 */
	abstract sendMetrics(metrics: MetricDataPoint[]): Promise<void>;

	/**
	 * Send metrics with retry and circuit breaker (wrapper for concrete implementations)
	 */
	protected async sendMetricsWithRetry(
		metrics: MetricDataPoint[],
		sendFn: () => Promise<void>
	): Promise<void> {
		if (!this.circuitBreaker) {
			throw new Error('Circuit breaker not initialized');
		}

		try {
			// Try to send via circuit breaker
			await this.circuitBreaker.execute(
				async () => {
					await this.retryOperation(sendFn);
				},
				// Classify errors - only trip circuit on actual provider failures
				(error) => {
					// Don't trip circuit on validation errors or rate limits
					if (error instanceof Error) {
						const message = error.message.toLowerCase();
						return !(
							message.includes('validation') ||
							message.includes('rate limit') ||
							message.includes('quota')
						);
					}
					return true;
				}
			);

			this.metricsSucceeded += metrics.length;
			Log.log(observabilityLogger, `✅ Successfully sent ${ metrics.length } metrics to ${ this.name }`);

		} catch (error) {
			this.metricsFailed += metrics.length;
			
			// Add to dead letter queue
			this.addToDeadLetterQueue(metrics, error);
			
			Log.error(
				observabilityLogger,
				`❌ Failed to send metrics to ${ this.name } after retries:`,
				error
			);
			
			throw error;
		}
	}

	/**
	 * Check if provider is healthy
	 */
	async isHealthy(): Promise<boolean> {
		if (!this.initialized) {
			return false;
		}

		// Check circuit breaker state
		if (this.circuitBreaker?.getState() === 'OPEN') {
			return false;
		}

		return true;
	}

	/**
	 * Cleanup provider resources
	 */
	async cleanup(): Promise<void> {
		// Try to process remaining dead letter queue
		if (this.deadLetterQueue.length > 0) {
			Log.log(
				observabilityLogger,
				`🔄 Processing ${ this.deadLetterQueue.length } dead letter entries before cleanup...`
			);
			await this.processDeadLetterQueue();
		}

		this.initialized = false;
		this.deadLetterQueue = [];
		Log.log(observabilityLogger, `🧹 ${ this.name } provider cleaned up`);
	}

	/**
	 * Helper to ensure provider is initialized
	 */
	protected ensureInitialized(): void {
		if (!this.initialized || !this.config) {
			throw new Error(`${ this.name } provider not initialized`);
		}
	}

	/**
	 * Attempt to process dead letter queue
	 */
	async processDeadLetterQueue(): Promise<{
		processed: number;
		failed: number;
		remaining: number;
	}> {
		let processed = 0;
		let failed = 0;
		const maxReprocessAttempts = 3;

		// Process entries oldest first
		const entriesToProcess = [...this.deadLetterQueue];
		this.deadLetterQueue = [];

		for (const entry of entriesToProcess) {
			// Skip if too many attempts
			if (entry.attemptCount >= maxReprocessAttempts) {
				Log.warn(
					observabilityLogger,
					`⚠️ Dropping ${entry.metrics.length} metrics after ${entry.attemptCount} failed attempts`
				);
				this.metricsInDeadLetter -= entry.metrics.length;
				failed++;
				continue;
			}

			// Try to send again
			try {
				await this.sendMetrics(entry.metrics);
				this.metricsInDeadLetter -= entry.metrics.length;
				processed++;
			} catch (error) {
				// Re-add to queue with incremented attempt count
				entry.attemptCount++;
				entry.lastAttempt = Date.now();
				entry.error = error instanceof Error ? error.message : String(error);
				this.deadLetterQueue.push(entry);
				failed++;
			}
		}

		return {
			processed,
			failed,
			remaining: this.deadLetterQueue.length
		};
	}

	/**
	 * Get dead letter queue statistics
	 */
	getDeadLetterStats(): {
		queueSize: number;
		metricsInQueue: number;
		oldestEntry?: number;
	} {
		const oldestEntry = this.deadLetterQueue.length > 0
			? this.deadLetterQueue[0].lastAttempt
			: undefined;

		return {
			queueSize: this.deadLetterQueue.length,
			metricsInQueue: this.metricsInDeadLetter,
			oldestEntry
		};
	}

	/**
	 * Get provider metrics
	 */
	getProviderMetrics(): {
		succeeded: number;
		failed: number;
		inDeadLetter: number;
		successRate: number;
		circuitState?: string;
	} {
		const total = this.metricsSucceeded + this.metricsFailed;
		const successRate = total > 0 ? (this.metricsSucceeded / total) * 100 : 0;

		return {
			succeeded: this.metricsSucceeded,
			failed: this.metricsFailed,
			inDeadLetter: this.metricsInDeadLetter,
			successRate: Math.round(successRate * 100) / 100,
			circuitState: this.circuitBreaker?.getState()
		};
	}

	/**
	 * Reset provider metrics
	 */
	resetMetrics(): void {
		this.metricsSucceeded = 0;
		this.metricsFailed = 0;
		// Don't reset metricsInDeadLetter as those are still pending
	}

	/**
	 * ============================================================================
	 * PRIVATE HELPER METHODS
	 * ============================================================================
	 */

	/**
	 * Add metrics to dead letter queue
	 */
	private addToDeadLetterQueue(metrics: MetricDataPoint[], error: unknown): void {
		const entry: DeadLetterEntry = {
			metrics,
			attemptCount: 1,
			lastAttempt: Date.now(),
			error: error instanceof Error ? error.message : String(error)
		};

		this.deadLetterQueue.push(entry);
		this.metricsInDeadLetter += metrics.length;

		// Limit queue size to prevent memory issues
		const maxQueueSize = this.config?.maxBufferSize ?? 10000;
		if (this.deadLetterQueue.length > maxQueueSize / 100) {
			// Remove oldest entries
			const removed = this.deadLetterQueue.shift();
			if (removed) {
				this.metricsInDeadLetter -= removed.metrics.length;
				Log.warn(
					observabilityLogger,
					`🗑️ Dropped ${removed.metrics.length} metrics from dead letter queue (queue full)`
				);
			}
		}
	}

	/**
	 * Retry operation with exponential backoff
	 */
	private async retryOperation(
		operation: () => Promise<void>
	): Promise<void> {
		let lastError: Error | undefined;

		for (let attempt = 0; attempt <= this.retryConfig.maxRetries; attempt++) {
			try {
				await operation();
				return; // Success!
			} catch (error) {
				lastError = error instanceof Error ? error : new Error(String(error));
				
				// Don't retry on final attempt
				if (attempt === this.retryConfig.maxRetries) {
					break;
				}

				// Calculate backoff delay
				const delay = Math.min(
					this.retryConfig.baseDelayMs * Math.pow(this.retryConfig.backoffMultiplier, attempt),
					this.retryConfig.maxDelayMs
				);

				Log.warn(
					observabilityLogger,
					`⏳ Retry attempt ${ attempt + 1 }/${ this.retryConfig.maxRetries } for ${ this.name } after ${ delay }ms`
				);

				// Wait before retrying
				await this.sleep(delay);
			}
		}

		// All retries exhausted
		throw lastError ?? new Error('Unknown error during retry');
	}

	/**
	 * Helper for async sleep
	 */
	private sleep(ms: number): Promise<void> {
		return new Promise(resolve => setTimeout(resolve, ms));
	}
}