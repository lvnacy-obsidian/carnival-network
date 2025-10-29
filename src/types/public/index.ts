// src/types/index.ts
/**
 * Public types and interfaces for consuming plugins
 * These are the contracts that plugins using the Inter-Vault Network must follow
 */

/**
 * Obsidian Plugin Filler exports
 * - ObsidianAppWithPlugins
 */
export * from './app-plugin-filler';

/**
 * Carnival Client exports
 * - CarnivalNetworkClientInterface
 */
export * from './carnival-client-types';

/**
 * Carnival Configuration exports
 * - CarnivalConfiguration
 * - RateLimitConfiguration
 * - TLSConfiguration
 * - WebhookConfiguration
 * - WebhookHandlerConfig
 */
export * from './carnival-configuration-types';

/**
 * Carnival Grounds exports
 * - PerformanceStatus
 * - TerritoryNode
 * - TerritoryNodeInfo
 */
export * from './carnival-grounds-types';

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