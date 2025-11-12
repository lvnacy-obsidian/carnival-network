/**
 * Public types and interfaces for consuming plugins
 * These are the contracts that plugins using the Inter-Vault Network must follow
 */

/**
 * API Requst Types
 * - APIRequest
 * - AuthenticatedRequest
 * - AuthenticationRequestBody
 * - ActCreateRequestBody
 * - FetchOptions
 * - SearchRequestOptions
 */
export * from './api-request-types';

/**
 * Obsidian Plugin Filler exports
 * - ObsidianAppWithPlugins
 */
export * from './app-plugin-filler';

/**
 * Carnival Client exports
 * - CarnivalNetworkClientInterface
 * - ExternalClient
 */
export * from './carnival-client-types';

/**
 * Carnival Configuration exports
 * - APIKeyConfig
 * - CarnivalConfig
 * - RateLimitConfig
 * - TLSConfig
 * - WebhookConfig
 * - WebhookHandlerConfig
 */
export * from './carnival-configuration-types';

/**
 * Carnival Grounds exports
 * - PerformerRegistrationInfo
 * - RegistryEntry
 * - Territory
 * - TerritoryDiscoveryOptions
 */
export * from './carnival-grounds-types';

/**
 * Carnival Performers exports
 * - Performer
 * - PerformerCacheConfig
 * - PerformerCacheEntry
 * - PerformerCacheMetrics
 * - PerformerInfo
 * - PerformerMetadata
 * - PerformerRatings
 * - PerformanceStatus
 * - PerformerType
 */
export * from './carnival-performers-types';

/**
 * Carnival Service exports
 * - ActServiceInterface
 * - QueryServiceInterface
 * - TerritoryServiceInterface
 */
export * from './carnival-service-types';

/**
 * Logging exports
 * - LogContext
 */
export * from './logging-types';

/**
 * Network Operations exports
 * - BroadcastResult
 * - NetworkRequestResponse
 */
export * from './network-ops-types';

/**
 * Query exports
 * - ActQueryParams
 * - AnalyticsQueryParams
 * - CarnivalQuery
 * - QueryResult
 */
export * from './query-types';

/**
 * Carnival Records exports
 * - ActCountOptions
 * - ActQueryOptions
 * - ActSyncPreferences
 * - CarnivalRecord
 * - CreateActParams
 * - RecordMetadata
 */
export * from './records-types';

/**
 * Search exports
 * - SearchOptions
 * - SearchResult
 */
export * from './search-types';

/**
 * Secure Store exports
 * - APIKeyStorage
 */
export * from './secure-store-types';

/**
 * Webhook exports
 * - WebhookHandlerInterface
 * - WebhookPayload
 */
export * from './webhooks-types';