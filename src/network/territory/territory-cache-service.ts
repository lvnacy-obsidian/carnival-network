/**
 * ============================================================================
 * 🗺️ TERRITORY CACHE - Persistent Territory & Assignment Storage
 * ============================================================================
 * 
 * Manages territory definitions and performer-territory assignments using
 * persistent cache pattern similar to PersistentPerformerCache. Provides
 * separate storage for territory metadata and assignment mappings.
 * 
 * Architecture:
 * - TerritoryCache: Stores territory definitions (name, description, metadata)
 * - TerritoryAssignmentCache: Stores performer→territories mappings
 * - Both use vault persistence with background saves
 * - LRU not needed (territories are relatively static)
 * - TTL not needed (territories don't expire)
 * 
 * Core Responsibilities:
 * - Store and retrieve territory definitions
 * - Manage performer-territory assignments
 * - Persist to vault storage
 * - Background saves on modification
 * - Query territories by various criteria
 * 
 * Storage Pattern:
 * - Territory data: .obsidian/plugins/carnival-network/territories.json
 * - Assignment data: .obsidian/plugins/carnival-network/territory-assignments.json
 * 
 * Usage:
 * ```typescript
 * // Initialize caches
 * const territoryCache = new TerritoryCache(app);
 * const assignmentCache = new TerritoryAssignmentCache(app);
 * 
 * // Create territory
 * territoryCache.set('backstage', {
 *   name: 'backstage',
 *   description: 'Development and staging area',
 *   performerCount: 0,
 *   status: 'active',
 *   establishedAt: new Date().toISOString()
 * });
 * 
 * // Assign performer
 * assignmentCache.assign('performer-id', ['backstage', 'workshop']);
 * 
 * // Query
 * const territories = assignmentCache.getAssignments('performer-id');
 * ```
 * 
 * @module territory-cache
 * @category Network/Storage
 */

import type { App } from 'obsidian';
import { Log } from '../../utils/logger';
import {
    DEFAULT_TERRITORY_CONFIG,
    type LogContext,
    type Territory,
    type TerritoryCacheConfig
} from '../../types/public';

/**
 * 🗺️ Territory Cache - Stores territory definitions
 * 
 * Manages the master list of territories with their metadata.
 * Each territory has: name, description, status, performer count, etc.
 */
export class TerritoryCache {
	private cache = new Map<string, Territory>();
	private config: TerritoryCacheConfig;
	private persistenceInterval?: number;
	private isDirty = false;
	private cacheLogger: LogContext;

	constructor(
		private app: App,
		config: Partial<TerritoryCacheConfig> = {}
	) {
		this.config = { ...DEFAULT_TERRITORY_CONFIG, ...config };
		this.cacheLogger = {
			context: 'Territory Cache',
			path: `${app.vault.configDir}/plugins/carnival-network/src/network/territory-cache`
		};

		this.initialize().catch(error => {
			Log.error(this.cacheLogger, 'Failed to initialize Territory Cache', error);
		});
	}

	/**
	 * Initialize cache and load existing data
	 */
	private async initialize(): Promise<void> {
		try {
			await this.loadFromStorage();
			this.startBackgroundSave();
			Log.log(this.cacheLogger, `🗺️ Territory cache initialized with ${this.cache.size} territories`);
		} catch (error) {
			Log.error(this.cacheLogger, '🗺️ Failed to initialize territory cache:', error);
		}
	}

	/**
	 * Get territory by name
	 */
	get(name: string): Territory | null {
		return this.cache.get(name) || null;
	}

	/**
	 * Store territory
	 */
	set(name: string, territory: Territory): void {
		this.cache.set(name, territory);
		this.isDirty = true;
	}

	/**
	 * Check if territory exists
	 */
	has(name: string): boolean {
		return this.cache.has(name);
	}

	/**
	 * Delete territory
	 */
	delete(name: string): boolean {
		const deleted = this.cache.delete(name);
		if (deleted) {
			this.isDirty = true;
		}
		return deleted;
	}

	/**
	 * Get all territories
	 */
	getAll(): Territory[] {
		return Array.from(this.cache.values());
	}

	/**
	 * Get all territory names
	 */
	getAllNames(): string[] {
		return Array.from(this.cache.keys()).sort();
	}

	/**
	 * Get active territories only
	 */
	getActive(): Territory[] {
		return this.getAll().filter(t => t.status === 'active');
	}

	/**
	 * Clear all territories
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
	 * Create or update territory
	 */
	upsert(name: string, updates: Partial<Territory>): Territory {
		const existing = this.get(name);
		
		if (existing) {
			// Update existing
			const updated: Territory = {
				...existing,
				...updates,
				name, // Ensure name doesn't change
				lastActivity: new Date().toISOString()
			};
			this.set(name, updated);
			return updated;
		} else {
			// Create new
			const now = new Date().toISOString();
			const newTerritory: Territory = {
				name,
				description: updates.description,
				performerCount: 0,
				status: 'active',
				establishedAt: now,
				lastActivity: now,
				metadata: updates.metadata
			};
			this.set(name, newTerritory);
			return newTerritory;
		}
	}

	/**
	 * Update performer count for territory
	 */
	updatePerformerCount(name: string, count: number): void {
		const territory = this.get(name);
		if (territory) {
			territory.performerCount = count;
			territory.lastActivity = new Date().toISOString();
			this.set(name, territory);
		}
	}

	/**
	 * Load territories from storage
	 */
	private async loadFromStorage(): Promise<void> {
		try {
			const path = `${this.config.persistenceKey}.json`;
			const data = await this.app.vault.adapter.read(path);
			const parsed = JSON.parse(data);

			if (parsed.territories) {
				for (const [name, territory] of Object.entries(parsed.territories as Record<string, Territory>)) {
					this.cache.set(name, territory);
				}
			}

			Log.log(this.cacheLogger, `🗺️ Loaded ${this.cache.size} territories from storage`);
		} catch (error) {
			if (error.message?.includes('ENOENT')) {
				Log.log(this.cacheLogger, '🗺️ No existing territory file - starting fresh');
				// Create default 'general' territory
				this.upsert('general', {
					description: 'Default territory for all performers',
					status: 'active'
				});
			} else {
				Log.error(this.cacheLogger, '🗺️ Failed to load territories:', error);
			}
		}
	}

	/**
	 * Save territories to storage
	 */
	async saveToStorage(): Promise<void> {
		if (!this.isDirty) {
			return;
		}

		try {
			const data = {
				territories: Object.fromEntries(this.cache),
				savedAt: new Date().toISOString()
			};

			const json = JSON.stringify(data, null, this.config.compressionEnabled ? 0 : 2);
			const path = `${this.config.persistenceKey}.json`;
			await this.app.vault.adapter.write(path, json);

			this.isDirty = false;
			Log.log(this.cacheLogger, `🗺️ Saved ${this.cache.size} territories to storage`);
		} catch (error) {
			Log.error(this.cacheLogger, '🗺️ Failed to save territories:', error);
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
		Log.log(this.cacheLogger, '🗺️ Territory cache cleanup complete');
	}
}