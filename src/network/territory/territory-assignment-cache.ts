/**
 * ============================================================================
 * 🎭 TERRITORY ASSIGNMENT CACHE - Performer→Territory Mapping Storage
 * ============================================================================
 * 
 * Manages performer-to-territory assignments using persistent cache pattern.
 * Tracks which territories each performer belongs to, including primary
 * territory designation and multi-territory membership. Works in tandem with
 * TerritoryCache to maintain referential integrity across the territory system.
 * 
 * Core Responsibilities:
 * - Store and retrieve performer→territory mappings
 * - Manage multi-territory assignments per performer
 * - Track primary territory for each performer
 * - Persist assignments to vault storage
 * - Background saves on modification
 * - Query performers by territory
 * - Maintain assignment metadata (creation, update timestamps)
 * 
 * Architecture:
 * - Map-based storage (performerId → TerritoryAssignment)
 * - Vault persistence with background saves
 * - No LRU eviction (assignments are relatively static)
 * - No TTL expiration (assignments don't age out)
 * - Dirty-flag-based efficient persistence
 * - Automatic 'general' territory fallback
 * 
 * Relationship to TerritoryCache:
 * - TerritoryCache: Stores territory definitions (name, description, metadata)
 * - TerritoryAssignmentCache: Stores performer→territory mappings
 * - Coordination: Territory counts should be synchronized via TerritoryCacheManager
 * - Referential Integrity: All assigned territories should exist in TerritoryCache
 * 
 * Assignment Model:
 * - Each performer can be assigned to multiple territories
 * - First territory in list is the "primary" territory
 * - Primary territory used for default routing and affinity
 * - Minimum one territory required (defaults to 'general')
 * - Assignments tracked with creation/update timestamps
 * 
 * Storage Pattern:
 * - File: .obsidian/plugins/carnival-network/carnival-territory-assignments.json
 * - Format: { assignments: Map<string, TerritoryAssignment>, savedAt: ISO timestamp }
 * - Background saves on modification (dirty flag)
 * - Configurable save interval (default: 5 minutes)
 * - Optional compression for persistent data
 * 
 * Usage Example:
 * ```typescript
 * const assignmentCache = new TerritoryAssignmentCache(app);
 * 
 * // Assign performer to territories
 * assignmentCache.assign('performer-123', ['backstage', 'workshop']);
 * 
 * // Query assignments
 * const territories = assignmentCache.getAssignments('performer-123');
 * // => ['backstage', 'workshop']
 * 
 * const primary = assignmentCache.getPrimaryTerritory('performer-123');
 * // => 'backstage'
 * 
 * // Add territory
 * assignmentCache.addTerritory('performer-123', 'mainstage');
 * 
 * // Query performers in territory
 * const performers = assignmentCache.getPerformersInTerritory('backstage');
 * // => ['performer-123', 'performer-456', ...]
 * 
 * // Set primary (must exist in assignments)
 * assignmentCache.setPrimaryTerritory('performer-123', 'workshop');
 * ```
 * 
 * Exports:
 * - TerritoryAssignmentCache (class) - Main assignment cache implementation
 * 
 * Public API Methods:
 * 
 * Core Operations:
 * - get(performerId: string): TerritoryAssignment | null
 *   Retrieve full assignment record for performer
 *   Returns: TerritoryAssignment with territories array and metadata, or null
 * 
 * - getAssignments(performerId: string): string[]
 *   Get territory names assigned to performer
 *   Returns: Array of territory names (empty array if no assignments)
 * 
 * - getPrimaryTerritory(performerId: string): string
 *   Get primary territory for performer
 *   Returns: Territory name (defaults to 'general' if no assignments)
 * 
 * - isAssigned(performerId: string, territory: string): boolean
 *   Check if performer is assigned to specific territory
 *   Returns: true if assignment exists
 * 
 * - assign(performerId: string, territories: string[]): void
 *   Assign performer to territories (replaces existing assignments)
 *   Deduplicates territories
 *   First territory becomes primary
 *   Defaults to ['general'] if empty array provided
 *   Updates timestamps
 *   Sets dirty flag
 * 
 * - addTerritory(performerId: string, territory: string): void
 *   Add territory to performer's assignments
 *   No-op if already assigned
 *   Sets dirty flag
 * 
 * - removeTerritory(performerId: string, territory: string): void
 *   Remove territory from performer's assignments
 *   Ensures at least one territory remains (adds 'general' if needed)
 *   Sets dirty flag
 * 
 * - setPrimaryTerritory(performerId: string, territory: string): void
 *   Set primary territory (must be in assigned list)
 *   Reorders territories array (primary moved to front)
 *   Throws error if territory not in assignments
 *   Sets dirty flag
 * 
 * - delete(performerId: string): boolean
 *   Remove all assignments for performer
 *   Sets dirty flag
 *   Returns: true if assignments existed
 * 
 * Query Operations:
 * - getPerformersInTerritory(territory: string): string[]
 *   Get all performers assigned to territory
 *   Returns: Array of performer IDs
 * 
 * - getAll(): TerritoryAssignment[]
 *   Get all assignment records
 *   Returns: Array of all TerritoryAssignment objects
 * 
 * - clear(): void
 *   Remove all assignments
 *   Sets dirty flag
 * 
 * - size(): number
 *   Current cache size (number of performers with assignments)
 *   Returns: Entry count
 * 
 * Persistence:
 * - loadFromStorage(): Promise<void>
 *   Load assignments from vault storage
 *   Parses JSON from persistence key file
 *   Restores all assignment records
 *   Called automatically on initialization
 *   Logs if file not found (starts fresh)
 * 
 * - saveToStorage(): Promise<void>
 *   Save assignments to vault storage
 *   Only saves if dirty flag set
 *   Serializes to JSON (with optional compression)
 *   Records save timestamp
 *   Resets dirty flag on success
 *   Called automatically on interval + manual flush
 * 
 * - flush(): Promise<void>
 *   Force immediate save to storage
 *   Ignores dirty flag
 *   Used for cleanup and critical saves
 * 
 * Lifecycle:
 * - constructor(): Initialize cache, start persistence
 * - initialize(): Load from storage, start background save
 * - [ongoing]: Background saves every N minutes if dirty
 * - cleanup(): Final save, clear intervals, clear cache
 * 
 * Implementation Details:
 * - Used by: ActService, CarnivalQueryService, PerformerAccessService
 * - Created in: CarnivalPerformer constructor or plugin initialization
 * - No interface: Concrete implementation
 * - Storage key: Configurable (default: 'carnival-territory-assignments')
 * - Background save: Configurable interval (default: 5 minutes)
 * - No LRU: Assignments are persistent metadata
 * - No TTL: Assignments don't expire
 * 
 * Dependencies:
 * - App (Obsidian) - Vault storage access
 * - Log - Error logging and diagnostics
 * 
 * Configuration (TerritoryCacheConfig):
 * - persistenceKey: Storage key in vault (default: 'carnival-territory-assignments')
 * - backgroundSaveEnabled: Enable auto-save (default: true)
 * - backgroundSaveIntervalMs: Auto-save interval (default: 5 minutes)
 * - compressionEnabled: Compress persisted data (default: true)
 * 
 * Assignment Structure (TerritoryAssignment):
 * ```typescript
 * {
 *   performerId: string;         // Unique performer identifier
 *   territories: string[];       // Array of territory names (first is primary)
 *   primaryTerritory: string;    // Primary territory (convenience field)
 *   createdAt: string;           // ISO timestamp of first assignment
 *   updatedAt: string;           // ISO timestamp of last modification
 * }
 * ```
 * 
 * Storage Format:
 * ```json
 * {
 *   "assignments": {
 *     "performer-123": {
 *       "performerId": "performer-123",
 *       "territories": ["backstage", "workshop"],
 *       "primaryTerritory": "backstage",
 *       "createdAt": "2025-01-18T10:00:00.000Z",
 *       "updatedAt": "2025-01-18T10:05:00.000Z"
 *     },
 *     ...
 *   },
 *   "savedAt": "2025-01-18T10:05:00.000Z"
 * }
 * ```
 * Optionally compressed based on config
 * 
 * Primary Territory Logic:
 * - Always the first element in territories array
 * - Used for default routing in act creation
 * - Can be changed via setPrimaryTerritory()
 * - Changing primary reorders the array
 * 
 * 'general' Territory Fallback:
 * - Default territory for all performers
 * - Automatically assigned if no territories provided
 * - Automatically assigned if last territory removed
 * - Should always exist in TerritoryCache
 * 
 * Performance Characteristics:
 * - get(): O(1) lookup
 * - assign(): O(n) array deduplication where n = territories.length
 * - addTerritory(): O(n) check + O(1) push
 * - removeTerritory(): O(n) filter + potential O(1) push for 'general'
 * - setPrimaryTerritory(): O(n) filter + O(n) unshift
 * - getPerformersInTerritory(): O(m) iteration where m = total assignments
 * - Persistence: O(m) serialization
 * 
 * Error Handling:
 * - Persistence failures → logged but don't throw (graceful degradation)
 * - Load failures → start with empty cache (logged)
 * - Save failures → logged, dirty flag remains set
 * - setPrimaryTerritory() with invalid territory → throws Error
 * - All operations catch and log errors
 * 
 * Thread Safety:
 * - Single-threaded (JavaScript)
 * - Background saves use async/await
 * - Dirty flag prevents redundant saves
 * - No race conditions in save logic
 * 
 * Use Cases:
 * 
 * 1. Performer Discovery:
 *    HttpRegistryService finds performer → assigns to territory → cache updated
 * 
 * 2. Act Creation:
 *    User creates act → getPrimaryTerritory() determines routing → act assigned
 * 
 * 3. Territory Queries:
 *    User queries "acts in backstage" → getPerformersInTerritory() → filter acts
 * 
 * 4. Multi-Territory Performers:
 *    Performer works across territories → assigned to multiple → queries work
 * 
 * 5. Performer Migration:
 *    Performer moves territories → assign() with new list → cache updated
 * 
 * Coordination with TerritoryCache:
 * 
 * **Recommended Pattern**: Use TerritoryCacheManager to coordinate:
 * ```typescript
 * class TerritoryCacheManager {
 *   constructor(
 *     private territories: TerritoryCache,
 *     private assignments: TerritoryAssignmentCache
 *   ) {}
 *   
 *   async assignPerformer(performerId: string, territories: string[]): Promise<void> {
 *     // Validate territories exist
 *     for (const territory of territories) {
 *       if (!this.territories.has(territory)) {
 *         throw new Error(`Territory ${territory} does not exist`);
 *       }
 *     }
 *     
 *     const oldTerritories = this.assignments.getAssignments(performerId);
 *     
 *     // Update assignments
 *     this.assignments.assign(performerId, territories);
 *     
 *     // Synchronize counts
 *     await this.updateTerritoryCounts(oldTerritories, territories);
 *   }
 *   
 *   private async updateTerritoryCounts(
 *     oldTerritories: string[],
 *     newTerritories: string[]
 *   ): Promise<void> {
 *     const affected = new Set([...oldTerritories, ...newTerritories]);
 *     
 *     for (const territory of affected) {
 *       const count = this.assignments.getPerformersInTerritory(territory).length;
 *       this.territories.updatePerformerCount(territory, count);
 *     }
 *   }
 * }
 * ```
 * 
 * Migration Path to RxDB (Phase 4):
 * 
 * When migrating to RxDB in Phase 4, the TerritoryAssignmentCache interface
 * remains unchanged. Only the storage backend changes:
 * 
 * ```typescript
 * export class RxDBTerritoryAssignmentCache extends TerritoryAssignmentCache {
 *   constructor(private rxCollection: RxCollection<TerritoryAssignment>) {
 *     super(/* no app needed * /);
 *   }
 *   
 *   protected async loadFromStorage(): Promise<void> {
 *     const docs = await this.rxCollection.find().exec();
 *     for (const doc of docs) {
 *       this.cache.set(doc.performerId, doc.toJSON());
 *     }
 *   }
 *   
 *   protected async saveToStorage(): Promise<void> {
 *     // RxDB handles automatic persistence via reactive updates
 *     // Bulk operations can use rxCollection.bulkUpsert()
 *   }
 * }
 * ```
 * 
 * The cache-based interface provides fast in-memory access, while RxDB
 * handles persistent storage, indexing, and reactive queries.
 * 
 * @see territory-cache.ts - Territory definition storage
 * @see carnival-grounds-types.ts - Territory and TerritoryAssignment types
 * @see persistent-performer-cache.ts - Similar cache pattern for performers
 * @see NETWORK-ROADMAP.md - Phase 4 RxDB migration plan
 */

import { App } from 'obsidian';
import { Log } from '../../utils/logger';
import {
    DEFAULT_TERRITORY_CONFIG,
    type LogContext,
    type TerritoryAssignment,
    type TerritoryCacheConfig
} from '../../types/public';

/**
 * 🎭 Territory Assignment Cache - Stores performer→territory mappings
 * 
 * Manages which territories each performer is assigned to.
 * Each performer can be assigned to multiple territories.
 */
export class TerritoryAssignmentCache {
	private cache = new Map<string, TerritoryAssignment>();
	private config: TerritoryCacheConfig;
	private persistenceInterval?: number;
	private isDirty = false;
	private cacheLogger: LogContext;

	constructor(
		private app: App,
		config: Partial<TerritoryCacheConfig> = {}
	) {
		this.config = {
			...DEFAULT_TERRITORY_CONFIG,
			persistenceKey: 'carnival-territory-assignments',
			...config
		};
		this.cacheLogger = {
			context: 'Territory Assignment Cache',
			path: `${app.vault.configDir}/plugins/carnival-network/src/network/territory-cache`
		};

		this.initialize().catch(error => {
			Log.error(this.cacheLogger, 'Failed to initialize Territory Assignment Cache', error);
		});
	}

	/**
	 * Initialize cache and load existing data
	 */
	private async initialize(): Promise<void> {
		try {
			await this.loadFromStorage();
			this.startBackgroundSave();
			Log.log(this.cacheLogger, `🎭 Assignment cache initialized with ${this.cache.size} assignments`);
		} catch (error) {
			Log.error(this.cacheLogger, '🎭 Failed to initialize assignment cache:', error);
		}
	}

	/**
	 * Get assignments for performer
	 */
	get(performerId: string): TerritoryAssignment | null {
		return this.cache.get(performerId) || null;
	}

	/**
	 * Get territories assigned to performer
	 */
	getAssignments(performerId: string): string[] {
		const assignment = this.get(performerId);
		return assignment ? assignment.territories : [];
	}

	/**
	 * Get primary territory for performer
	 */
	getPrimaryTerritory(performerId: string): string {
		const assignment = this.get(performerId);
		return assignment ? assignment.primaryTerritory : 'general';
	}

	/**
	 * Check if performer is assigned to territory
	 */
	isAssigned(performerId: string, territory: string): boolean {
		const assignments = this.getAssignments(performerId);
		return assignments.includes(territory);
	}

	/**
	 * Assign performer to territories
	 */
	assign(performerId: string, territories: string[]): void {
		if (territories.length === 0) {
			territories = ['general'];
		}

		// Remove duplicates
		const uniqueTerritories = [...new Set(territories)];
		const now = new Date().toISOString();
		const existing = this.get(performerId);

		const assignment: TerritoryAssignment = {
			performerId,
			territories: uniqueTerritories,
			primaryTerritory: uniqueTerritories[0],
			createdAt: existing?.createdAt || now,
			updatedAt: now
		};

		this.cache.set(performerId, assignment);
		this.isDirty = true;
	}

	/**
	 * Add territory to performer's assignments
	 */
	addTerritory(performerId: string, territory: string): void {
		const current = this.getAssignments(performerId);
		if (!current.includes(territory)) {
			this.assign(performerId, [...current, territory]);
		}
	}

	/**
	 * Remove territory from performer's assignments
	 */
	removeTerritory(performerId: string, territory: string): void {
		const current = this.getAssignments(performerId);
		const filtered = current.filter(t => t !== territory);

		// Ensure at least one territory
		if (filtered.length === 0) {
			filtered.push('general');
		}

		this.assign(performerId, filtered);
	}

	/**
	 * Set primary territory (must be in assigned list)
	 */
	setPrimaryTerritory(performerId: string, territory: string): void {
		const current = this.getAssignments(performerId);
		
		if (!current.includes(territory)) {
			throw new Error(`Territory ${territory} not in assignments`);
		}

		// Move to front
		const reordered = [territory, ...current.filter(t => t !== territory)];
		this.assign(performerId, reordered);
	}

	/**
	 * Delete all assignments for performer
	 */
	delete(performerId: string): boolean {
		const deleted = this.cache.delete(performerId);
		if (deleted) {
			this.isDirty = true;
		}
		return deleted;
	}

	/**
	 * Get all performers assigned to a territory
	 */
	getPerformersInTerritory(territory: string): string[] {
		const performers: string[] = [];
		
		for (const [performerId, assignment] of this.cache.entries()) {
			if (assignment.territories.includes(territory)) {
				performers.push(performerId);
			}
		}

		return performers;
	}

	/**
	 * Get all assignments
	 */
	getAll(): TerritoryAssignment[] {
		return Array.from(this.cache.values());
	}

	/**
	 * Clear all assignments
	 */
	clear(): void {
		this.cache.clear();
		this.isDirty = true;
	}

	/**
	 * Get cache size
	 */
	size(): number {
		return this.cache.size;
	}

	/**
	 * Load assignments from storage
	 */
	private async loadFromStorage(): Promise<void> {
		try {
			const path = `${this.config.persistenceKey}.json`;
			const data = await this.app.vault.adapter.read(path);
			const parsed = JSON.parse(data);

			if (parsed.assignments) {
				for (const [performerId, assignment] of Object.entries(parsed.assignments as Record<string, TerritoryAssignment>)) {
					this.cache.set(performerId, assignment);
				}
			}

			Log.log(this.cacheLogger, `🎭 Loaded ${this.cache.size} assignments from storage`);
		} catch (error) {
			if (error.message?.includes('ENOENT')) {
				Log.log(this.cacheLogger, '🎭 No existing assignment file - starting fresh');
			} else {
				Log.error(this.cacheLogger, '🎭 Failed to load assignments:', error);
			}
		}
	}

	/**
	 * Save assignments to storage
	 */
	async saveToStorage(): Promise<void> {
		if (!this.isDirty) {
			return;
		}

		try {
			const data = {
				assignments: Object.fromEntries(this.cache),
				savedAt: new Date().toISOString()
			};

			const json = JSON.stringify(data, null, this.config.compressionEnabled ? 0 : 2);
			const path = `${this.config.persistenceKey}.json`;
			await this.app.vault.adapter.write(path, json);

			this.isDirty = false;
			Log.log(this.cacheLogger, `🎭 Saved ${this.cache.size} assignments to storage`);
		} catch (error) {
			Log.error(this.cacheLogger, '🎭 Failed to save assignments:', error);
		}
	}

	/**
	 * Start background save process
	 */
	private startBackgroundSave(): void {
		if (!this.config.backgroundSaveEnabled) {
			return;
		}

		if (this.persistenceInterval) {
			clearInterval(this.persistenceInterval);
		}

		this.persistenceInterval = window.setInterval(() => {
			if (this.isDirty) {
				this.saveToStorage().catch(error => {
					Log.error(this.cacheLogger, 'Background save failed:', error);
				});
			}
		}, this.config.backgroundSaveIntervalMs);
	}

	/**
	 * Force save to storage
	 */
	async flush(): Promise<void> {
		await this.saveToStorage();
	}

	/**
	 * Clean up cache resources
	 */
	async cleanup(): Promise<void> {
		if (this.persistenceInterval) {
			clearInterval(this.persistenceInterval);
		}

		if (this.isDirty) {
			await this.saveToStorage();
		}

		this.clear();
		Log.log(this.cacheLogger, '🎭 Assignment cache cleanup complete');
	}
}