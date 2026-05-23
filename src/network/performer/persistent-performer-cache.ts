/**
 * ============================================================================
 * PERSISTENT PERFORMER CACHE - LRU Cache with TTL and Vault Persistence
 * ============================================================================
 * 
 * Intelligent caching layer for performer discovery data with LRU (Least Recently
 * Used) eviction, TTL (Time To Live) expiration, optional vault persistence, and
 * performance metrics tracking. Replaces simple in-memory Map with production-grade
 * caching that survives plugin reloads and provides detailed cache analytics.
 * 
 * Core Responsibilities:
 * - LRU-based caching with configurable size limits
 * - Per-entry TTL expiration
 * - Optional persistence to Obsidian vault storage
 * - Automatic background saves (configurable interval)
 * - Cache performance metrics (hits, misses, evictions)
 * - Compression for persistent storage (optional)
 * - Graceful degradation to memory-only mode
 * 
 * Architecture:
 * - Map-based cache (fast O(1) lookups)
 * - Access order tracking (array of IDs for LRU eviction)
 * - Periodic background persistence (setInterval)
 * - Dirty flag for efficient persistence (only save when modified)
 * - Territory-based indexing (stored in each entry)
 * - Metrics tracking for monitoring and optimization
 * 
 * Exports:
 * - PersistentPerformerCache (class) - Main cache implementation
 * 
 * Public API Methods:
 * 
 * Core Operations:
 * - get(id: string): Performer | null
 *   Retrieve performer from cache
 *   Checks TTL expiration (returns null if expired)
 *   Updates access time and order (for LRU)
 *   Increments accessCount
 *   Records hit/miss metrics
 *   Returns: Performer or null
 * 
 * - set(id: string, performer: Performer, ttlMs?: number): void
 *   Store performer in cache
 *   Uses configurable or default TTL
 *   Evicts LRU entry if at capacity
 *   Updates access order
 *   Sets dirty flag
 *   Updates memory metrics
 * 
 * - delete(id: string): boolean
 *   Remove performer from cache
 *   Updates access order
 *   Sets dirty flag
 *   Returns: true if entry existed
 * 
 * - has(id: string): boolean
 *   Check if performer exists (non-expired)
 *   Checks TTL expiration
 *   Auto-deletes if expired
 *   Returns: true if valid entry exists
 * 
 * - clear(): void
 *   Remove all entries
 *   Resets access order
 *   Sets dirty flag
 *   Updates metrics
 * 
 * Query Operations:
 * - values(): Performer[]
 *   Get all non-expired performers
 *   Filters expired entries
 *   Auto-deletes expired entries
 *   Returns: Array of valid performers
 * 
 * - size(): number
 *   Current cache size
 *   Returns: Entry count
 * 
 * Persistence:
 * - loadFromStorage(app: App): Promise<void>
 *   Load cache from vault storage
 *   Decompresses if compression enabled
 *   Validates loaded data
 *   Filters expired entries during load
 *   Called automatically on initialization
 * 
 * - saveToStorage(app: App): Promise<void>
 *   Save cache to vault storage
 *   Compresses if compression enabled
 *   Only saves if dirty flag set
 *   Records storage write metrics
 *   Called automatically on interval + manual cleanup
 * 
 * Metrics & Monitoring:
 * - getMetrics(): PerformerCacheMetrics
 *   Get cache performance statistics
 *   Returns: { hits, misses, evictions, storageWrites, storageReads, totalOperations, memoryUsage }
 * 
 * - getStatistics(): CacheStatistics
 *   Get detailed cache statistics
 *   Returns: { size, capacity, hitRate, evictionRate, oldestEntry, newestEntry }
 * 
 * - resetMetrics(): void
 *   Reset all metrics counters
 * 
 * Implementation Details:
 * - Used by: CarnivalRegistryService, PerformerAccessService
 * - Created in: CarnivalPerformer constructor
 * - No interface: Concrete implementation
 * - Storage key: Configurable (default: 'carnival-performer-cache')
 * - Background save: Configurable interval (default: 5 minutes)
 * 
 * Dependencies:
 * - App (Obsidian) - Vault storage access (plugin.loadData/saveData)
 * - Log - Error logging
 * 
 * Configuration (PerformerCacheConfig):
 * - maxSize: Maximum cache entries (default: 1000)
 * - defaultTtlMs: Default TTL in milliseconds (default: 30 minutes)
 * - persistenceEnabled: Enable vault persistence (default: true)
 * - persistenceKey: Storage key in vault (default: 'carnival-performer-cache')
 * - backgroundSaveIntervalMs: Auto-save interval (default: 5 minutes)
 * - compressionEnabled: Compress persisted data (default: true)
 * 
 * Cache Entry Structure (PerformerCacheEntry):
 * ```typescript
 * {
 *   performer: Performer;        // Full performer object
 *   territory: string;           // Territory name (for indexing)
 *   addedAt: number;             // Timestamp when added
 *   lastAccessed: number;        // Timestamp of last access
 *   accessCount: number;         // Number of accesses
 *   ttl: number;                 // Time to live in ms
 * }
 * ```
 * 
 * LRU Eviction Algorithm:
 * 1. Check if cache at capacity and entry is new
 * 2. Get least recently used entry ID (first in accessOrder array)
 * 3. Delete LRU entry
 * 4. Increment eviction metric
 * 5. Add new entry
 * 6. Update access order
 * 
 * TTL Expiration:
 * - Checked on every get() and has()
 * - Expired entries auto-deleted
 * - Expiration: now > (entry.addedAt + entry.ttl)
 * - No background expiration sweep (checked lazily)
 * 
 * Access Order Management:
 * - Array of performer IDs in access order
 * - Most recent at end, least recent at start
 * - Updated on every get() and set()
 * - Used for LRU eviction (evict accessOrder[0])
 * - Efficient updates via array manipulation
 * 
 * Persistence Format:
 * ```json
 * {
 *   "version": 1,
 *   "timestamp": "ISO timestamp",
 *   "entries": [
 *     { "id": "performer-id", "entry": PerformerCacheEntry },
 *     ...
 *   ]
 * }
 * ```
 * Optionally compressed with LZ-string or similar
 * 
 * Memory Metrics:
 * - Approximate calculation based on entry count
 * - Assumes ~2KB per performer entry (rough estimate)
 * - Updated on set() and delete()
 * - Used for monitoring and alerting
 * 
 * Performance Characteristics:
 * - get(): O(1) lookup + O(n) access order update
 * - set(): O(1) insert + O(n) access order update + potential O(1) eviction
 * - delete(): O(1) removal + O(n) access order update
 * - has(): O(1) lookup
 * - values(): O(n) iteration + filtering
 * - LRU eviction: O(1)
 * - Persistence: O(n) serialization
 * 
 * Error Handling:
 * - Persistence failures → fallback to memory-only mode
 * - Load failures → start with empty cache
 * - Save failures → logged but don't throw
 * - Invalid data → filtered during load
 * - All operations catch and log errors
 * 
 * Lifecycle:
 * - constructor(): Initialize cache, start persistence
 * - initializePersistence(): Load from storage, start background save
 * - [ongoing]: Background saves every N minutes
 * - cleanup(): Final save, clear intervals
 * 
 * Use Cases:
 * 
 * 1. Performer Discovery:
 *    HttpRegistryService queries registries → caches performers → PerformerAccessService reads
 * 
 * 2. Offline Operation:
 *    Plugin reloads → loadFromStorage() → cache repopulated → network available immediately
 * 
 * 3. Performance Optimization:
 *    Frequent performer lookups → cache hits → no network requests
 * 
 * 4. Memory Management:
 *    Cache grows → reaches maxSize → LRU eviction → bounded memory usage
 * 
 * 5. Monitoring:
 *    getMetrics() → track hit rate → optimize TTL and size
 * 
 * @see carnival-performers-types.ts - Performer, PerformerCacheEntry, PerformerCacheConfig types
 * @see carnival-registry-service.ts - Primary writer (discovery)
 * @see performer-access-service.ts - Primary reader (queries)
 * @see carnival-performer.ts - Cache initialization
 */

import { App } from 'obsidian';
import { Log } from '../../utils/logger';
import type { CacheStatistics } from '../../types/internal';
import type {
	LogContext,
	Performer,
	PerformerCacheConfig,
	PerformerCacheEntry,
	PerformerCacheMetrics
} from '../../types/public';

/**
 * 🎭 Persistent Performer Cache - LRU cache with TTL and optional persistent backing
 * 
 * Replaces simple in-memory Map with intelligent caching that includes:
 * - LRU (Least Recently Used) eviction policy
 * - TTL (Time To Live) expiration per entry
 * - Optional persistent storage via Obsidian plugin data APIs
 * - Performance metrics tracking
 * - Graceful degradation to memory-only mode
 */
export class PersistentPerformerCache {
	private cache = new Map<string, PerformerCacheEntry>();
	private accessOrder: string[] = [];
	private config: PerformerCacheConfig;
	private metrics: PerformerCacheMetrics;
	private persistenceInterval?: number;
	private isDirty = false;
	private cacheLogger: LogContext;

	constructor(
		private app: App,
		config: Partial<PerformerCacheConfig> = {}
	) {
		this.config = {
			maxSize: 1000,
			defaultTtlMs: 30 * 60 * 1000, // 30 minutes
			persistenceEnabled: true,
			persistenceKey: 'carnival-performer-cache',
			backgroundSaveIntervalMs: 5 * 60 * 1000, // 5 minutes
			compressionEnabled: true,
			...config
		};

		this.metrics = {
			hits: 0,
			misses: 0,
			evictions: 0,
			storageWrites: 0,
			storageReads: 0,
			totalOperations: 0,
			memoryUsage: 0
		};

		this.cacheLogger = {
			context: 'Persistent Performer Cache',
			path: `${ app.vault.configDir }/plugins/carnival-network/src/network/persistent-performer-cache`
		};

		this.initializePersistence().catch(error => {
			Log.error(
				this.cacheLogger,
				'Failed to initialize Persistent Performer Cache.',
				error
			);
		});
	}

	/**
	 * Initialize persistent storage and load existing data
	 */
	private async initializePersistence(): Promise<void> {
		if (!this.config.persistenceEnabled) {
			Log.log(this.cacheLogger, '🎭 Persistent storage disabled - operating in memory-only mode');
			return;
		}

		try {
			await this.loadFromStorage(this.app);
			this.startBackgroundSave();
			Log.log(this.cacheLogger, `🎭 Persistent cache initialized with ${this.cache.size} performers`);
		} catch (error) {
			Log.error(this.cacheLogger, '🎭 Failed to initialize persistence, falling back to memory-only:', error);
			this.config.persistenceEnabled = false;
		}
	}

	/**
	 * Get performer from cache
	 */
	get(id: string): Performer | null {
		this.metrics.totalOperations++;
		const entry = this.cache.get(id);

		if (!entry) {
			this.metrics.misses++;
			return null;
		}

		// Check TTL expiration
		const now = Date.now();
		if (now > entry.addedAt + entry.ttl) {
			this.delete(id);
			this.metrics.misses++;
			return null;
		}

		// Update access time and order
		entry.lastAccessed = now;
		entry.accessCount++;
		this.updateAccessOrder(id);
		this.metrics.hits++;
		
		return entry.performer;
	}

	/**
	 * Set performer in cache
	 */
	set(
		id: string,
		performer: Performer,
		ttlMs?: number
	): void {
		this.metrics.totalOperations++;
		const now = Date.now();
		const ttl = ttlMs ?? this.config.defaultTtlMs;

		const entry: PerformerCacheEntry = {
			performer,
			territory: performer.territory,
			lastAccessed: now,
			addedAt: now,
			accessCount: 0,
			ttl
		};

		// If cache is at capacity, evict LRU entry
		if (this.cache.size >= this.config.maxSize && !this.cache.has(id)) {
			this.evictLRU();
		}

		this.cache.set(id, entry);
		this.updateAccessOrder(id);
		this.isDirty = true;
		this.updateMemoryMetrics();
	}

	/**
	 * Delete performer from cache
	 */
	delete(id: string): boolean {
		this.metrics.totalOperations++;
		const deleted = this.cache.delete(id);
		if (deleted) {
			this.removeFromAccessOrder(id);
			this.isDirty = true;
			this.updateMemoryMetrics();
		}
		return deleted;
	}

	/**
	 * Check if performer exists in cache
	 */
	has(id: string): boolean {
		const entry = this.cache.get(id);

		if (!entry) {
			return false;
		}

		// Check TTL expiration
		if (Date.now() > entry.addedAt + entry.ttl) {
			this.delete(id);
			return false;
		}

		return true;
	}

	/**
	 * Get all performers from cache (excluding expired)
	 */
	values(): Performer[] {
		this.metrics.totalOperations++;
		const now = Date.now();
		const validPerformers: Performer[] = [];
		const expiredKeys: string[] = [];

		for (const [id, entry] of this.cache.entries()) {
			if (now > entry.addedAt + entry.ttl) {
				expiredKeys.push(id);
			} else {
				validPerformers.push(entry.performer);
			}
		}

		// Clean up expired entries
		for (const key of expiredKeys) {
			this.delete(key);
		}

		return validPerformers;
	}

	/**
	 * Clear all entries from cache
	 */
	clear(): void {
		this.metrics.totalOperations++;
		this.cache.clear();
		this.accessOrder = [];
		this.isDirty = true;
		this.updateMemoryMetrics();
	}

	/**
	 * Get cache size (excluding expired entries)
	 */
	size(): number {
		this.cleanupExpired();
		return this.cache.size;
	}

	/**
	 * Update access order for LRU tracking
	 */
	private updateAccessOrder(id: string): void {
		// Remove from current position
		this.removeFromAccessOrder(id);
		// Add to end (most recently used)
		this.accessOrder.push(id);
	}

	/**
	 * Remove from access order tracking
	 */
	private removeFromAccessOrder(id: string): void {
		const index = this.accessOrder.indexOf(id);
		if (index > -1) {
			this.accessOrder.splice(index, 1);
		}
	}

	/**
	 * Evict least recently used entry
	 */
	private evictLRU(): void {
		if (this.accessOrder.length === 0) {
			return;
		}

		const lruId = this.accessOrder[0];
		const entry = this.cache.get(lruId);
		this.cache.delete(lruId);
		this.accessOrder.shift();
		this.metrics.evictions++;
		
		Log.log(this.cacheLogger, `🎭 Evicted LRU performer: ${entry?.performer.name ?? lruId}`);
	}

	/**
	 * Clean up expired entries
	 */
	private cleanupExpired(): void {
		const now = Date.now();
		const expiredKeys: string[] = [];

		for (const [id, entry] of this.cache.entries()) {
			if (now > entry.addedAt + entry.ttl) {
				expiredKeys.push(id);
			}
		}

		for (const key of expiredKeys) {
			this.delete(key);
		}
	}

	/**
	 * Update memory usage metrics
	 */
	private updateMemoryMetrics(): void {
		// Rough estimation of memory usage
		let memoryUsage = 0;
		for (const entry of this.cache.values()) {
			memoryUsage += JSON.stringify(entry.performer).length * 2; // Approximate character size
		}
		this.metrics.memoryUsage = memoryUsage;
	}

	/**
	 * Start background save process
	 */
	private startBackgroundSave(): void {
		if (this.persistenceInterval) {
			clearInterval(this.persistenceInterval);
		}

		this.persistenceInterval = window.setInterval(() => {
			if (this.isDirty) {
				this.saveToStorage(this.app)
					.catch(error => {
						Log.error(
							this.cacheLogger,
							'Failed to save to store.',
							error
						);
					});
			}
		}, this.config.backgroundSaveIntervalMs);
	}

	/**
	 * Load cache data from persistent storage
	 */
	async loadFromStorage(app: App): Promise<void> {
		if (!this.config.persistenceEnabled) {
			return;
		}

		try {
			const data = await app.vault.adapter.read(`${ this.config.persistenceKey }.json`);
			const parsed = JSON.parse(data);

			if (!parsed || parsed === null) {
				Log.warn(this.cacheLogger, 'Vault data incorrectly parsed, or no data is available to parse');
				return;
			}
			
			this.metrics.storageReads++;

			if (parsed.cache && parsed.accessOrder) {
				// Restore cache entries
				for (const [id, entryData] of Object.entries(parsed.cache as Record<string, PerformerCacheEntry>)) {
					this.cache.set(id, entryData);
				}

				// Restore access order
				this.accessOrder = parsed.accessOrder;

				// Clean up expired entries
				this.cleanupExpired();
			}

			Log.log(this.cacheLogger, `🎭 Loaded ${this.cache.size} performers from persistent storage`);
		} catch (error) {
			if (error.message.includes('ENOENT')) {
				Log.log(this.cacheLogger, '🎭 No existing cache file found - starting fresh');
			} else {
				Log.error(this.cacheLogger, '🎭 Failed to load from storage:', error);
			}
		}
	}

	/**
	 * Save cache data to persistent storage
	 */
	async saveToStorage(app: App): Promise<void> {
		if (!this.config.persistenceEnabled || !this.isDirty) {
			return;
		}

		try {
			const data = {
				cache: Object.fromEntries(this.cache),
				accessOrder: this.accessOrder,
				savedAt: Date.now()
			};

			const json = JSON.stringify(data, null, this.config.compressionEnabled ? 0 : 2);
			await app.vault.adapter.write(`${this.config.persistenceKey}.json`, json);
			
			this.isDirty = false;
			this.metrics.storageWrites++;
			
			Log.log(this.cacheLogger, `🎭 Saved ${this.cache.size} performers to persistent storage`);
		} catch (error) {
			Log.error(this.cacheLogger, '🎭 Failed to save to storage:', error);
			// Don't disable persistence on single failure - might be temporary
		}
	}

	/**
	 * Force save to storage
	 */
	async flush(): Promise<void> {
		await this.saveToStorage(this.app);
	}

	/**
	 * Get cache performance metrics
	 */
	getMetrics(): PerformerCacheMetrics & { hitRate: number } {
		const hitRate = this.metrics.totalOperations > 0 
			? (this.metrics.hits / this.metrics.totalOperations) * 100 
			: 0;

		return {
			...this.metrics,
			hitRate: Math.round(hitRate * 100) / 100
		};
	}

	/**
	 * Get cache statistics
	 */
	getStatistics(): CacheStatistics {
		this.metrics.totalOperations++;
		const performers = this.values();
		const now = Date.now();
		
		let oldestEntry = now;
		let newestEntry = 0;

		for (const [, entry] of this.cache.entries()) {
			oldestEntry = Math.min(oldestEntry, entry.addedAt);
			newestEntry = Math.max(newestEntry, entry.lastAccessed);
		}

		return {
			totalPerformers: performers.length,
			hitRate: this.getMetrics().hitRate,
			missRate: 100 - this.getMetrics().hitRate,
			evictionCount: this.metrics.evictions,
			oldestEntry: this.cache.size > 0 ? oldestEntry : undefined,
			newestEntry: this.cache.size > 0 ? newestEntry : undefined
		};
	}

	/**
	 * Reset metrics
	 */
	resetMetrics(): void {
		this.metrics = {
			hits: 0,
			misses: 0,
			evictions: 0,
			storageWrites: 0,
			storageReads: 0,
			totalOperations: 0,
			memoryUsage: 0
		};
	}

	/**
	 * Update cache configuration
	 */
	async updateConfig(config: Partial<PerformerCacheConfig>): Promise<void> {
		this.config = { ...this.config, ...config };
		
		// If persistence was enabled/disabled, handle appropriately
		if (config.persistenceEnabled !== undefined) {
			if (config.persistenceEnabled && !this.persistenceInterval) {
				await this.initializePersistence();
			} else if (!config.persistenceEnabled && this.persistenceInterval) {
				clearInterval(this.persistenceInterval);
				this.persistenceInterval = undefined;
			}
		}

		// If background save interval changed, restart
		if (config.backgroundSaveIntervalMs && this.persistenceInterval) {
			this.startBackgroundSave();
		}

		Log.log(this.cacheLogger, '🎭 Cache configuration updated:', config);
	}

	/**
	 * Filter cache entries by predicate function
	 */
	filter(predicate: (performer: Performer) => boolean): Performer[] {
		this.metrics.totalOperations++;
		const now = Date.now();
		const results: Performer[] = [];
		const expiredKeys: string[] = [];

		for (const [id, entry] of this.cache.entries()) {
			if (now > entry.addedAt + entry.ttl) {
				expiredKeys.push(id);
			} else if (predicate(entry.performer)) {
				results.push(entry.performer);
			}
		}

		// Clean up expired entries
		for (const key of expiredKeys) {
			this.delete(key);
		}

		return results;
	}

	/**
	 * Sort cache entries by comparison function
	 */
	sort(compareFn: (a: Performer, b: Performer) => number): Performer[] {
		const performers = this.values();
		return performers.sort(compareFn);
	}

	/**
	 * Paginate through filtered cache entries
	 */
	paginate(
		page: number,
		pageSize: number,
		predicate?: (performer: Performer) => boolean
	): {
		items: Performer[];
		total: number;
		page: number;
		pageSize: number;
		pages: number
	} {
		this.metrics.totalOperations++;
		
		const performers = predicate ? this.filter(predicate) : this.values();
		const total = performers.length;
		const pages = Math.ceil(total / pageSize);
		const start = (page - 1) * pageSize;
		const end = start + pageSize;

		return {
			items: performers.slice(start, end),
			total,
			page: Math.max(1, Math.min(page, pages)),
			pageSize,
			pages: Math.max(1, pages)
		};
	}

	/**
	 * Aggregate cache entries by grouping function and reducing values
	 */
	aggregate<K, V>(
		groupByFn: (performer: Performer) => K,
		reduceFn: (acc: V, performer: Performer) => V,
		initial: V
	): Map<K, V> {
		this.metrics.totalOperations++;
		const groups = new Map<K, V>();
		const performers = this.values();

		for (const performer of performers) {
			const key = groupByFn(performer);
			const current = groups.has(key) ? groups.get(key) : JSON.parse(JSON.stringify(initial));
			groups.set(key, reduceFn(current, performer));
		}

		return groups;
	}

	/**
	 * Clean up cache resources
	 */
	async cleanup(): Promise<void> {
		if (this.persistenceInterval) {
			clearInterval(this.persistenceInterval);
		}
		
		if (this.isDirty) {
			await this.saveToStorage(this.app);
		}
		
		this.clear();
		Log.log(this.cacheLogger, '🎭 Performer cache cleanup complete');
	}
}