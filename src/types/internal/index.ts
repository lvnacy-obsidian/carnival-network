// src/types/internal.ts
/**
 * Internal types used by the network plugin implementation
 * These are NOT exposed to consuming plugins
 */

/**
 * Authentication exports
 * - AuthenticationContext
 * - AuthenticationResult
 */
export * from './authentication-types';

/**
 * Buffer exports
 * - BufferedMetric
 */
export * from './buffer-types';

/**
 * Certificate exports
 * - Certificate
 * - CertificateInfo
 * - CertificateValidationResult
 * - TrustedCertificate
 */
export * from './certificate-store-types';

/**
 * Circuit Breaker exports
 * - CircuitBreakerConfig
 * - CircuitBreakerState
 * - CircuitState
 */
export * from './circuit-breaker-types';

/**
 * Error exports
 * - NetworkErrorType
 * - NetworkError
 * - ValidationError
 */
export * from './error-types';

/**
 * HTTP Client exports
 * - HTTPRequestOptions
 * - HTTPResponse
 * - TLSConfig
 */
export * from './http-client';

/**
 * Logger exports
 * - LogEntry
 * - LogConfig
 */
export * from './logger-types';

/**
 * Network Protocol exports
 * - MessageMetadata
 * - MessageType
 * - ProtocolMessage
 */
export * from './network-protocol-types';

/**
 * Performer Cache exports
 * - CacheStatistics
 */
export * from './performer-cache-types';

/**
 * Performance Metrics exports
 * - PerformanceMetrics
 * - RequestTiming
 */
export * from './performance-metrics-types';

/**
 * Rate Limiter exports
 * - RateLimitBucket
 * - RateLimitStatus
 */
export * from './rate-limiter-types';

/**
 * Registry Internal exports
 * - CachedPerformer
 * - RegistryCache
 * - RegistryEndpoint
 */
export * from './registry-types';

/**
 * Sentry exports:
 * - SentrySDK
 * - SentryTransaction
 */
export * from './sentry-types';

/**
 * Validation exports
 * - ValidationResult
 * - ValidationRule
 */
export * from './validation-types';

/**
 * Webhook Internal exports
 * - WebhookDelivery
 * - WebhookVerification
 */
export * from './webhooks-internal-types';