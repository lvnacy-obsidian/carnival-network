/**
 * ============================================================================
 * CARNIVAL PERFORMERS (The Stars of the Show)
 * ============================================================================
 * 
 * Index of exports:
 * - Performer - Full representation of a carnival participant (vault/performer)
 * - PerformerCacheConfig - Configuration for performer caching
 * - PerformerCacheEntry - Individual cache entry for a performer
 * - PerformerCacheMetrics - Metrics for monitoring performer cache performance
 * - PerformerInfo - Lightweight registration information
 * - PerformerMetadata - Metadata about a performer's technical setup
 * - PerformerRatings - Performance metrics for a performer
 * - PerformanceStatus - Current status of a performer
 * - PerformerType - Classification of performer roles
 */

/**
 * Represents a carnival performer (vault/performer) in the network
 * This is the full-featured representation with complete identity and capabilities
 */
export interface Performer {
	/** Unique identifier for this performer */
	id: string;
	/** Human-readable name of the performer */
	name: string;
	/** Territory where this performer is located */
	territory: string;
	/** Absolute path to the vault (optional for HTTP performers) */
	path?: string;
	/** Last known status */
	status?: 'active' | 'inactive' | 'unknown';
	/** Timestamp of last contact */
	lastSeen: string;
	/** Network capabilities this performer supports */
	capabilities: string[];
	/** Version of the carnival plugin */
	pluginVersion?: string;
	/** HTTP/network metadata */
	metadata: PerformerMetadata;
}

/**
 * Cache configuration options
 */
export interface PerformerCacheConfig {
	maxSize: number;
	defaultTtlMs: number;
	persistenceEnabled: boolean;
	persistenceKey: string;
	backgroundSaveIntervalMs: number;
	compressionEnabled: boolean;
}

export interface PerformerCacheEntry {
	performer: Performer;
	addedAt: number;
	lastAccessed: number;
	accessCount: number;
	territory: string;
	ttl: number;
}

/**
 * Cache metrics for monitoring
 */
export interface PerformerCacheMetrics {
	hits: number;
	misses: number;
	evictions: number;
	storageWrites: number;
	storageReads: number;
	totalOperations: number;
	memoryUsage: number;
}

/**
 * Lightweight registration information for a performer
 * Used when registering or discovering performers in the network
 */
export interface PerformerInfo {
	/** Unique identifier */
	id: string;
	/** Performer name */
	name: string;
	/** Home territory */
	territory: string;
	/** API endpoint for communication */
	endpoint: string;
	/** Supported capabilities */
	capabilities: string[];
	/** Optional metadata */
	metadata?: Partial<PerformerMetadata>;
}

/**
 * Metadata about a performer's technical setup and environment
 */
export interface PerformerMetadata {
	/** API host for HTTP communication */
	apiHost?: string;
	/** API port for HTTP communication */
	apiPort?: number;
	/** Use HTTPS instead of HTTP */
	useHttps?: boolean;
	/** Vault path for filesystem access */
	vaultPath?: string;
	/** Platform information (desktop, mobile, web) */
	platform?: string;
	/** Plugin version */
	version?: string;
	/** Whether performer has archive capabilities */
	hasArchive?: boolean;
	/** Whether performer has warp capabilities */
	hasWarp?: boolean;
	/** Number of projects in this performer's vault */
	projectCount?: number;
	/** Timestamp of last activity */
	lastActivity?: string;
	/** Type of vault (obsidian or unknown) */
	vaultType?: 'obsidian' | 'unknown';
	/** Additional flexible metadata */
	/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
	[key: string]: any;
}

/**
 * Performance ratings and metrics for a performer
 * Tracks how well they're performing in the network
 */
export interface PerformerRatings {
	/** Performer identifier */
	performerId: string;
	/** Total number of requests handled */
	requestCount: number;
	/** Successful requests */
	successCount: number;
	/** Failed requests */
	failureCount: number;
	/** Average response time (milliseconds) */
	averageResponseTime: number;
	/** Fastest response time (milliseconds) */
	minResponseTime: number;
	/** Slowest response time (milliseconds) */
	maxResponseTime: number;
	/** Timestamp of last request */
	lastRequestTime?: number;
	/** Success rate (0-1) */
	successRate?: number;
	/** Overall performance score (0-100) */
	performanceScore?: number;
}

/**
 * Current performance status of a performer
 * Tracks whether they're actively performing or taking a break
 */
export interface PerformanceStatus {
	/** Performer identifier */
	performerId: string;
	/** Current status */
	status: 'performing' | 'intermission' | 'finale';
	/** Last heartbeat timestamp */
	lastHeartbeat: string;
	/** Time since performer started (milliseconds) */
	uptime?: number;
	/** Number of active connections */
	activeConnections?: number;
	/** Additional status metadata */
	metadata?: Record<string, unknown>;
}

/**
 * Classification of performer roles in the carnival
 */
export type PerformerType = 
	| 'main'        // Main carnival hub
	| 'territory'   // Territory-specific performer
	| 'submodule'   // Submodule performer
	| 'creative'    // Creative/content performer
	| 'development' // Development/testing performer
	| 'archive';    // Archive/historical performer

/**
 * Discovery result for a performer
 * Contains information about how a performer was found
 */
export interface PerformerDiscovery {
	/** The discovered performer */
	performer: Performer;
	/** How this performer was discovered */
	discoveryMethod: 'filesystem' | 'registry' | 'heartbeat' | 'manual' | 'broadcast';
	/** Confidence in this discovery (0-1) */
	confidence: number;
	/** When this performer was discovered */
	discoveredAt: string;
	/** Additional discovery details */
	details?: Record<string, unknown>;
}

/**
 * Performer connection test result
 */
export interface PerformerConnectionTest {
	/** Performer identifier */
	performerId: string;
	/** Whether connection is healthy */
	healthy: boolean;
	/** Connection latency (milliseconds) */
	latency: number;
	/** Endpoint tested */
	endpoint: string;
	/** Test timestamp */
	testedAt: string;
	/** Error message if unhealthy */
	error?: string;
}