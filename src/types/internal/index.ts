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
 * Certificate exports
 * - Certificate
 * - CertificateValidationResult
 */
export * from './certificate-store-types';

/**
 * Circuit Breaker exports
 * - CircuitBreakerConfig
 * - CircuitBreakerState
 * - CircuitState
 */
export * from './circuit-breaker';

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
 * Network Protocol exports
 * - MessageMetadata
 * - MessageType
 * - ProtocolMessage
 */
export * from './network-protocol-types';

/**
 * Node Cache exports
 * - CacheStatistics
 * - NodeCacheEntry
 */
export * from './node-cache-types';

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
 * - CachedNode
 * - RegistryCache
 * - RegistryEndpoint
 */
export * from './registry-types';

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