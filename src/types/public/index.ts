/**
 * Public types and interfaces for consuming plugins
 * These are the contracts that plugins using the Inter-Vault Network must follow
 */

/**
 * Carnival Records exports
 * - ActCountOptions
 * - ActCreateData
 * - ActQueryOptions
 * - ActSyncPreferences
 * - CarnivalAct
 * - CreateActParams
 * - ExtendedActQueryOptions
 * - PaginatedActResult
 * - RecordMetadata
 */
export * from './acts-types';

/**
 * Analytics exports
 * - ActivityAnalytics
 * - AnalyticsData
 * - AnalyticsQueryParams
 * - AnalyticsResponse
 * - CapabilityAnalytics
 * - CarnivalActivity
 * - CarnivalTopology
 * - MetricDataPoint
 * - ObservabilityConfig
 * - PerformanceAnalytics
 * - RecordAnalytics
 * - TerritoryAnalytics
 */
export * from './analytics-types';

/**
 * API Request exports
 * - ActCreateBody
 * - ActCreateRequestBody
 * - APIRequest
 * - AuthenticatedRequest
 * - AuthenticationRequestBody
 * - FetchOptions
 * - SearchRequestOptions
 */
export * from './api-request-types';

/**
 * API Response exports
 * - APIResponse
 * - PaginationMeta
 */
export * from './api-response-types';

/**
 * Obsidian Plugin Filler exports
 * - ObsidianAppWithPlugins
 */
export * from './app-plugin-filler';

/**
 * Archive exports
 * - ArchiveBatchResult
 * - ArchiveQueryOptions
 * - ArchiveStats
 * - ArchiveTransaction
 * - ArchiveInterface
 */
export * from './archive-types';

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
 * - TerritoryInfo
 */
export * from './carnival-grounds-types';

/**
 * Carnival Performer (singular) exports
 * - CarnivalPerformerInterface
 * - GuestPerformer
 */
export * from './carnival-performer-types';

/**
 * Carnival Performers (plural, Troupe) exports
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
 * Local REST API types exports
 * - LocalRestApiPublicApi
 * - LocalRestApiRequest
 * - LocalRestApiResponse
 * - LocalRestApiRouteHandler
 * - ExpressIRoute
 */
export * from './local-rest-api-types';

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
 * Observability exports
 * - BufferConfig
 * - BufferStats
 * - DeadLetterEntry
 * - MetricDataPoint
 * - ObservabilityAlert
 * - ObservabilityConfig
 * - ObservabilityDashboard
 * - ObservabilityProvider
 * - ProviderHealthStatus
 * - ProviderMetrics
 * - RetryConfig
 */
export * from './observability-types';

/**
 * Query exports
 * - ActQueryParams
 * - CarnivalQuery
 * - QueryResult
 */
export * from './query-types';

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
 * Webhook types exports
 * - WebhookHandlerInterface
 * - WebhookPayload
 * - WebhookResponse
 */
export * from './webhook-types';
