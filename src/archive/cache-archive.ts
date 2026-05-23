/**
 * ============================================================================
 * CACHE ARCHIVE - Fallback Storage via PersistentPerformerCache
 * ============================================================================
 * 
 * Wraps the PersistentPerformerCache with the ArchiveInterface contract.
 * Serves as a fallback storage layer that converts Performer acts into
 * CarnivalAct format for seamless integration with the archive abstraction.
 * 
 * Design Philosophy:
 * - Bridges cache layer to archive abstraction
 * - Provides graceful degradation when database is unavailable
 * - Minimal memory footprint (reuses existing performer cache)
 * - Converts between Performer and CarnivalAct formats transparently
 * 
 * Use Cases:
 * - Fallback storage when primary archive is unavailable
 * - Reduced-capability operation during outages
 * - Session-scoped performance data
 * 
 * Limitations:
 * - Storage capacity limited by cache size (default 1000 entries)
 * - No advanced querying (uses performer cache metadata)
 * - TTL-based expiration (data ages out per cache settings)
 * - Primarily for read-heavy operations
 */

import { Log } from '../utils/logger';
import type {
	ArchiveInterface,
	ArchiveQueryOptions,
	ArchiveBatchResult,
	ArchiveStats,
	CarnivalAct,
	LogContext,
	Performer
} from '../types/public';
import type { PersistentPerformerCache } from '../network/persistent-performer-cache';

const archiveLogger: LogContext = {
	context: 'CacheArchive',
	path: '/.obsidian/plugins/carnival-network/src/archive/cache-archive'
};

/**
 * Internal act wrapper combining Performer + metadata
 */
interface CacheRecord {
	performer: Performer;
	asRecord: CarnivalAct;
	createdAt: Date;
}

/**
 * CacheArchive: ArchiveInterface implementation backed by PersistentPerformerCache
 */
export class CacheArchive implements ArchiveInterface {
	public readonly name = 'CacheArchive';

	// In-memory mapping of carnival acts (performer ID -> act)
	// This layer exists because the cache stores Performers, but we need CarnivalActs
	private actMap: Map<string, CacheRecord> = new Map();

	constructor(private cache: PersistentPerformerCache) {
		Log.log(archiveLogger, '🎭 CacheArchive initialized (fallback mode)');
	}

	/**
	 * ========================================================================
	 * CRUD OPERATIONS
	 * ========================================================================
	 */

	async create(act: CarnivalAct): Promise<CarnivalAct> {
		if (this.actMap.has(act.id)) {
			throw new Error(`Record with ID ${ act.id } already exists in cache archive`);
		}

		// Create a synthetic Performer from the CarnivalAct
		// This allows us to store arbitrary carnival data in the performer cache
		const performer: Performer = {
			id: act.id,
			name: act.title,
			territory: act.territory,
			lastSeen: new Date().toISOString(),
			capabilities: ['cache-archive'],
			status: act.status === 'active' ? 'active' : 'inactive',
			metadata: {
				endpoint: '',
				capabilities: ['cache-archive'],
				custom: {
					actType: act.actType,
					content: act.content,
					syncPreferences: act.syncPreferences,
					originalMetadata: act.metadata
				}
			}
		};

		// Store in cache
		this.cache.set(act.id, performer);
		this.actMap.set(act.id, {
			performer,
			asRecord: act,
			createdAt: new Date()
		});

		Log.log(
			archiveLogger,
			`✅ Created act ${ act.id } in cache archive (territory: ${ act.territory })`
		);

		return await Promise.resolve(act);
	}

	async findById(id: string): Promise<CarnivalAct | null> {
		const cached = this.actMap.get(id);
		if (cached) {
			return await Promise.resolve(cached.asRecord);
		}

		// Try to retrieve from performer cache
		const performer = this.cache.get(id);
		if (performer) {
			const act = this.performerToCarnivalAct(performer);
			this.actMap.set(id, {
				performer,
				asRecord: act,
				createdAt: new Date()
			});
			return await Promise.resolve(act);
		}

		return await Promise.resolve(null);
	}

	async find(query: ArchiveQueryOptions): Promise<CarnivalAct[]> {
		const results: CarnivalAct[] = [];

		// Iterate through cached acts and apply filters
		for (const cacheRecord of this.actMap.values()) {
			if (this.matchesQuery(cacheRecord.asRecord, query)) {
				results.push(cacheRecord.asRecord);
			}
		}

		// Apply pagination
		if (query.offset !== undefined && query.limit !== undefined) {
			return await Promise.resolve(
				results.slice(query.offset, query.offset + query.limit)
			);
		}
		if (query.limit !== undefined) {
			return await Promise.resolve(results.slice(0, query.limit));
		}

		// Apply sorting
		if (query.sortBy) {
			this.sortRecords(results, query.sortBy, query.sortOrder ?? 'asc');
		}

		return await Promise.resolve(results);
	}

	async findOne(query: ArchiveQueryOptions): Promise<CarnivalAct | null> {
		const results = await this.find({ ...query, limit: 1 });
		return await Promise.resolve(results[0] ?? null);
	}

	async update(id: string, updates: Partial<CarnivalAct>): Promise<CarnivalAct | null> {
		const cached = this.actMap.get(id);
		if (!cached) {
			return await Promise.resolve(null);
		}

		const updated: CarnivalAct = {
			...cached.asRecord,
			...updates,
			id: cached.asRecord.id, // Prevent ID changes
			updatedAt: new Date().toISOString()
		};

		// Update performer with new data
		const updatedPerformer: Performer = {
			...cached.performer,
			name: updated.title,
			lastSeen: new Date().toISOString(),
			status: updated.status === 'active' ? 'active' : 'inactive'
		};

		this.cache.set(id, updatedPerformer);
		this.actMap.set(id, {
			performer: updatedPerformer,
			asRecord: updated,
			createdAt: cached.createdAt
		});

		Log.log(archiveLogger, `✏️ Updated act ${id} in cache archive`);

		return await Promise.resolve(updated);
	}

	async delete(id: string): Promise<boolean> {
		if (!this.actMap.has(id)) {
			return await Promise.resolve(false);
		}

		this.cache.delete(id);
		this.actMap.delete(id);

		Log.log(archiveLogger, `🗑️ Deleted act ${id} from cache archive`);

		return await Promise.resolve(true);
	}

	/**
	 * ========================================================================
	 * QUERY OPERATIONS
	 * ========================================================================
	 */

	async count(query: ArchiveQueryOptions): Promise<number> {
		const results = await this.find(query);
		return await Promise.resolve(results.length);
	}

	async exists(id: string): Promise<boolean> {
		const exists = this.actMap.has(id) || this.cache.get(id) !== null;
		return await Promise.resolve(exists);
	}

	async all(): Promise<CarnivalAct[]> {
		return await this.find({});
	}

	/**
	 * ========================================================================
	 * BATCH OPERATIONS
	 * ========================================================================
	 */

	async bulkCreate(acts: CarnivalAct[]): Promise<ArchiveBatchResult> {
		const result: ArchiveBatchResult = {
			successful: [],
			failed: []
		};

		for (const act of acts) {
			try {
				await this.create(act);
				result.successful.push(act.id);
			} catch (error) {
				result.failed.push({
					id: act.id,
					error: error instanceof Error ? error.message : 'Unknown error'
				});
			}
		}

		return await Promise.resolve(result);
	}

	async bulkUpdate(
		updates: Array<{ id: string; updates: Partial<CarnivalAct> }>
	): Promise<ArchiveBatchResult> {
		const result: ArchiveBatchResult = {
			successful: [],
			failed: []
		};

		for (const { id, updates: actUpdates } of updates) {
			try {
				const updated = await this.update(id, actUpdates);
				if (updated) {
					result.successful.push(id);
				} else {
					result.failed.push({
						id,
						error: 'Record not found'
					});
				}
			} catch (error) {
				result.failed.push({
					id,
					error: error instanceof Error ? error.message : 'Unknown error'
				});
			}
		}

		return await Promise.resolve(result);
	}

	async bulkDelete(ids: string[]): Promise<ArchiveBatchResult> {
		const result: ArchiveBatchResult = {
			successful: [],
			failed: []
		};

		for (const id of ids) {
			try {
				const deleted = await this.delete(id);
				if (deleted) {
					result.successful.push(id);
				} else {
					result.failed.push({
						id,
						error: 'Record not found'
					});
				}
			} catch (error) {
				result.failed.push({
					id,
					error: error instanceof Error ? error.message : 'Unknown error'
				});
			}
		}

		return await Promise.resolve(result);
	}

	/**
	 * ========================================================================
	 * INDEX MANAGEMENT (No-op for cache implementation)
	 * ========================================================================
	 */

	async createIndex(): Promise<void> {
		// Cache doesn't support explicit indexing
		Log.log(archiveLogger, '⚠️ Index creation not supported on cache archive');
		return await Promise.resolve();
	}

	async dropIndex(): Promise<void> {
		// Cache doesn't support explicit index dropping
		return await Promise.resolve();
	}

	async rebuildIndexes(): Promise<void> {
		// Cache doesn't support explicit index rebuilding
		return await Promise.resolve();
	}

	/**
	 * ========================================================================
	 * MAINTENANCE & STATS
	 * ========================================================================
	 */

	async stats(): Promise<ArchiveStats> {
		const acts = Array.from(this.actMap.values());
		const byTerritory: Record<string, number> = {};
		const byType: Record<string, number> = {};

		for (const cacheRecord of acts) {
			const act = cacheRecord.asRecord;
			byTerritory[act.territory] = (byTerritory[act.territory] ?? 0) + 1;
			byType[act.actType] = (byType[act.actType] ?? 0) + 1;
		}

		const stats: ArchiveStats = {
			totalRecords: acts.length,
			actsByTerritory: byTerritory,
			actsByType: byType,
			oldestRecord: acts.length > 0 ? acts[0].asRecord.createdAt : undefined,
			newestRecord:
				acts.length > 0 ? acts[acts.length - 1].asRecord.createdAt : undefined
		};

		return await Promise.resolve(stats);
	}

	async clear(): Promise<void> {
		for (const id of this.actMap.keys()) {
			await this.delete(id);
		}
		Log.log(archiveLogger, '🧹 Cleared all acts from cache archive');
		return await Promise.resolve();
	}

	async cleanup(): Promise<void> {
		// Expired acts are auto-cleaned by the underlying cache
		Log.log(archiveLogger, '🧹 Cache archive cleanup (delegated to underlying cache)');
		return await Promise.resolve();
	}

	/**
	 * ========================================================================
	 * PRIVATE HELPERS
	 * ========================================================================
	 */

	/**
	 * Convert Performer to CarnivalAct
	 */
	private performerToCarnivalAct(performer: Performer): CarnivalAct {
		const custom = performer.metadata.custom ?? {};
		return {
			id: performer.id,
			title: performer.name,
			territory: performer.territory,
			actType: custom.actType ?? 'unknown',
			content: custom.content ?? '',
			metadata: custom.originalMetadata ?? {
				source: 'cache-archive',
				createdAt: new Date().toISOString()
			},
			createdAt: performer.lastSeen,
			status:
				performer.status === 'active'
					? 'active'
					: 'archived',
			syncPreferences: custom.syncPreferences ?? {
				requireAck: false,
				broadcastToAll: false,
				targetTerritories: [performer.territory]
			}
		};
	}

	/**
	 * Check if act matches query criteria
	 */
	private matchesQuery(act: CarnivalAct, query: ArchiveQueryOptions): boolean {
		if (query.territory && act.territory !== query.territory) {
			return false;
		}
		if (query.actType && act.actType !== query.actType) {
			return false;
		}
		if (query.status && act.status !== query.status) {
			return false;
		}
		if (query.performerId && act.id !== query.performerId) {
			return false;
		}
		return true;
	}

	/**
	 * Sort acts in-place
	 */
	private sortRecords(
		acts: CarnivalAct[],
		sortBy: 'createdAt' | 'updatedAt' | 'title' | 'territory',
		order: 'asc' | 'desc'
	): void {
		acts.sort((a, b) => {
			let comparison = 0;

			switch (sortBy) {
				case 'createdAt':
					comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
					break;
				case 'updatedAt':
					comparison =
						new Date(a.updatedAt ?? 0).getTime() - new Date(b.updatedAt ?? 0).getTime();
					break;
				case 'title':
					comparison = a.title.localeCompare(b.title);
					break;
				case 'territory':
					comparison = a.territory.localeCompare(b.territory);
					break;
			}

			return order === 'asc' ? comparison : -comparison;
		});
	}
}
