/**
 * ============================================================================
 * OBSERVABILITY (Monitoring the Show)
 * ============================================================================
 * 
 * Index of exports:
 * - DeadLetterEntry - Entry for failed metrics
 * - MetricDataPoint - Individual metric for export
 * - ObservabilityConfig - Configuration for observability
 * - ObservabilityProvider - Interface for creating custom providers
 * - ProviderHealthStatus - Health status of a provider
 * - ProviderMetrics - Performance metrics of a provider
 * - RetryConfig - Configuration for retrying operations
 * 
 * This module defines the types and interfaces used for observability
 * providers within the Carnival Network. Observability providers are
 * responsible for exporting metrics to various monitoring platforms.
 */

/**
 * Dead letter queue for failed metrics
 */
export interface DeadLetterEntry {
	metrics: MetricDataPoint[];
	attemptCount: number;
	lastAttempt: number;
	error: string;
}

export interface MetricDataPoint {
	name: string;
	value: number;
	timestamp: string;
	tags?: Record<string, string>;
	type: 'counter' | 'gauge' | 'histogram';
}

export interface ObservabilityConfig {
	enabled: boolean;
	provider?: 'prometheus' | 'datadog' | 'sentry' | 'elasticsearch' | 'custom';
	endpoint?: string;
	apiKey?: string;
	flushIntervalMs?: number;
	batchSize?: number;
	maxBufferSize?: number;

	// HTTP configuration for custom provider
	customHeaders?: Record<string, string>;
	method?: 'POST' | 'PUT';

	// Retry configuration
	maxRetries?: number;
	retryBaseDelayMs?: number;
	retryMaxDelayMs?: number;
	retryBackoffMultiplier?: number;
	
	// Circuit breaker configuration
	circuitBreakerEnabled?: boolean;
	circuitBreakerThreshold?: number;
	circuitBreakerTimeout?: number;
	circuitBreakerResetTimeout?: number;
	
	// Sentry-specific
	environment?: string;
	sampleRate?: number;
	
	// Elasticsearch-specific
	indexPrefix?: string;
	
	// Connection testing
	testConnectionOnInit?: boolean;
	connectionTimeoutMs?: number;
}

/**
 * Base interface for all observability providers
 * Implement this to create custom observability integrations
 */
export interface ObservabilityProvider {
	/** Provider name for identification */
	readonly name: string;

	/** Initialize the provider with configuration */
	initialize(config: ObservabilityConfig): Promise<void>;

	/** Send metrics to the observability platform */
	sendMetrics(metrics: MetricDataPoint[]): Promise<void>;

	/** Check if provider is healthy and ready to accept metrics */
	isHealthy(): Promise<boolean>;

	/** Cleanup and close connections */
	cleanup(): Promise<void>;

	/** Process dead letter queue (optional, implemented in base class) */
	processDeadLetterQueue?(): Promise<{
		processed: number;
		failed: number;
		remaining: number;
	}>;
	
	/** Get dead letter queue statistics (optional) */
	getDeadLetterStats?(): {
		queueSize: number;
		metricsInQueue: number;
		oldestEntry?: number;
	};
	
	/** Get provider-specific metrics (optional) */
	getProviderMetrics?(): ProviderMetrics;
	
	/** Reset provider metrics (optional) */
	resetMetrics?(): void;
}

/**
 * Provider health status
 */
export interface ProviderHealthStatus {
	healthy: boolean;
	initialized: boolean;
	circuitState?: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
	lastError?: string;
	lastSuccess?: number;
	consecutiveFailures?: number;
}

/**
 * Provider performance metrics
 */
export interface ProviderMetrics {
	succeeded: number;
	failed: number;
	inDeadLetter: number;
	successRate: number;
	circuitState?: string;
	totalRequests?: number;
	averageLatency?: number;
}

/**
 * Retry configuration for provider operations
 */
export interface RetryConfig {
	maxRetries: number;
	baseDelayMs: number;
	maxDelayMs: number;
	backoffMultiplier: number;
}