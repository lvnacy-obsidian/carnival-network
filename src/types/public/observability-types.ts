/**
 * ============================================================================
 * OBSERVABILITY (Monitoring the Show)
 * ============================================================================
 * 
 * Index of exports:
 * - BufferConfig - Configuration for buffer and metrics
 * - BufferStats - Stats collection for buffer
 * - DeadLetterEntry - Entry for failed metrics
 * - MetricDataPoint - Individual metric for export
 * - ObservabilityAlert - Entry for metrics alerts
 * - ObservabilityConfig - Configuration for observability
 * - ObservabilityDashboard - Interface for dashboard ui
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
 * Buffer configuration options
 */
export interface BufferConfig {
	/** Maximum number of metrics to buffer */
	maxSize: number;
	/** Maximum age of metrics before expiration (milliseconds) */
	maxAgeMs: number;
	/** Strategy for handling buffer overflow */
	overflowStrategy: 'drop-oldest' | 'drop-newest' | 'drop-random';
	/** Enable internal metrics about buffer performance */
	enableMetrics: boolean;
	/** Warning threshold (percentage of maxSize) */
	warningThreshold: number;
}

/**
 * Buffer statistics for monitoring
 */
export interface BufferStats {
	/** Current number of metrics in buffer */
	currentSize: number;
	/** Maximum buffer capacity */
	maxSize: number;
	/** Total metrics added to buffer */
	totalAdded: number;
	/** Total metrics dropped (all reasons) */
	totalDropped: number;
	/** Total metrics successfully flushed */
	totalFlushed: number;
	/** Metrics dropped due to age expiration */
	droppedByAge: number;
	/** Metrics dropped due to buffer overflow */
	droppedByOverflow: number;
	/** Age of oldest metric in buffer (milliseconds) */
	oldestMetricAge?: number;
	/** Age of newest metric in buffer (milliseconds) */
	newestMetricAge?: number;
	/** Buffer utilization as percentage (0-100) */
	utilizationPercent: number;
}

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

/**
 * Alert for observability issues
 */
export interface ObservabilityAlert {
	severity: 'info' | 'warning' | 'error' | 'critical';
	message: string;
	timestamp: string;
	component: 'buffer' | 'provider' | 'network';
	actionable?: string;
}

export interface ObservabilityConfig {
	enabled: boolean;
	// Only webhook is supported directly by the plugin; other backends
	// should consume the metrics endpoint instead of requiring built-in
	// providers. Keep provider optional so metrics-only mode is possible.
	provider?: 'webhook';
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

	// Enable exposing a metrics endpoint via Local REST API
	metricsEnabled?: boolean;

	// Optional secret used to HMAC-sign webhook payloads
	webhookSecret?: string;
}

/**
 * Dashboard data aggregation for UI display
 */
export interface ObservabilityDashboard {
	// Overall health
	health: {
		status: 'healthy' | 'degraded' | 'down';
		message: string;
		timestamp: string;
	};
	
	// Buffer status
	buffer: {
		stats: BufferStats;
		healthStatus: 'healthy' | 'warning' | 'critical';
		recommendation?: string;
	};
	
	// Provider status
	provider: {
		name: string;
		healthy: boolean;
		metrics?: ProviderMetrics;
		deadLetterQueue?: {
			queueSize: number;
			metricsInQueue: number;
			oldestEntry?: number;
		};
		circuitState?: string;
	} | null;
	
	// Recent metrics (last N for display)
	recentMetrics: MetricDataPoint[];
	
	// Alerts
	alerts: ObservabilityAlert[];
	
	// Performance
	performance: {
		flushLatency: number[];
		flushSuccessRate: number;
		metricsPerSecond: number;
	};
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