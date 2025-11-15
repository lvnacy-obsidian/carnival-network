/**
 * ============================================================================
 * CACHE ARCHIVE - Fallback Storage via PersistentPerformerCache
 * ============================================================================
 * 
 * Wraps the PersistentPerformerCache with the ArchiveInterface contract.
 * Serves as a fallback storage layer that converts Performer records into
 * CarnivalRecord format for seamless integration with the archive abstraction.
 * 
 * Design Philosophy:
 * - Bridges cache layer to archive abstraction
 * - Provides graceful degradation when database is unavailable
 * - Minimal memory footprint (reuses existing performer cache)
 * - Converts between Performer and CarnivalRecord formats transparently
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
	CarnivalRecord,
	LogContext,
	Performer
} from '../types/public';
import type { PersistentPerformerCache } from '../network/persistent-performer-cache';

const archiveLogger: LogContext = {
	context: 'CacheArchive',
	path: '/.obsidian/plugins/carnival-network/src/archive/cache-archive'
};

/**
 * Internal record wrapper combining Performer + metadata
 */
interface CacheRecord {
	performer: Performer;
	asRecord: CarnivalRecord;
	createdAt: Date;
}

/**
 * CacheArchive: ArchiveInterface implementation backed by PersistentPerformerCache
 */
export class CacheArchive implements ArchiveInterface {
	public readonly name = 'CacheArchive';

	// In-memory mapping of carnival records (performer ID -> record)
	// This layer exists because the cache stores Performers, but we need CarnivalRecords
	private recordMap: Map<string, CacheRecord> = new Map();

	constructor(private cache: PersistentPerformerCache) {
		Log.log(archiveLogger, '🎭 CacheArchive initialized (fallback mode)');
	}

	/**
	 * ========================================================================
	 * CRUD OPERATIONS
	 * ========================================================================
	 */

	async create(record: CarnivalRecord): Promise<CarnivalRecord> {
		if (this.recordMap.has(record.id)) {
			throw new Error(`Record with ID ${record.id} already exists in cache archive`);
		}

		// Create a synthetic Performer from the CarnivalRecord
		// This allows us to store arbitrary carnival data in the performer cache
		const performer: Performer = {
			id: record.id,
			name: record.title,
			territory: record.territory,
			lastSeen: new Date().toISOString(),
			capabilities: ['cache-archive'],
			status: record.status === 'active' ? 'active' : 'inactive',
			metadata: {
				endpoint: '',
				capabilities: ['cache-archive'],
				custom: {
					actType: record.actType,
					content: record.content,
					syncPreferences: record.syncPreferences,
					originalMetadata: record.metadata
				}
			}
		};

		// Store in cache
		this.cache.set(record.id, performer);
		this.recordMap.set(record.id, {
			performer,
			asRecord: record,
			createdAt: new Date()
		});

		Log.log(
			archiveLogger,
			`✅ Created record ${record.id} in cache archive (territory: ${record.territory})`
		);

		return await Promise.resolve(record);
	}

	async findById(id: string): Promise<CarnivalRecord | null> {
		const cached = this.recordMap.get(id);
		if (cached) {
			return await Promise.resolve(cached.asRecord);
		}

		// Try to retrieve from performer cache
		const performer = this.cache.get(id);
		if (performer) {
			const record = this.performerToCarnivalRecord(performer);
			this.recordMap.set(id, {
				performer,
				asRecord: record,
				createdAt: new Date()
			});
			return await Promise.resolve(record);
		}

		return await Promise.resolve(null);
	}

	async find(query: ArchiveQueryOptions): Promise<CarnivalRecord[]> {
		const results: CarnivalRecord[] = [];

		// Iterate through cached records and apply filters
		for (const cacheRecord of this.recordMap.values()) {
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

	async findOne(query: ArchiveQueryOptions): Promise<CarnivalRecord | null> {
		const results = await this.find({ ...query, limit: 1 });
		return await Promise.resolve(results[0] ?? null);
	}

	async update(id: string, updates: Partial<CarnivalRecord>): Promise<CarnivalRecord | null> {
		const cached = this.recordMap.get(id);
		if (!cached) {
			return await Promise.resolve(null);
		}

		const updated: CarnivalRecord = {
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
		this.recordMap.set(id, {
			performer: updatedPerformer,
			asRecord: updated,
			createdAt: cached.createdAt
		});

		Log.log(archiveLogger, `✏️ Updated record ${id} in cache archive`);

		return await Promise.resolve(updated);
	}

	async delete(id: string): Promise<boolean> {
		if (!this.recordMap.has(id)) {
			return await Promise.resolve(false);
		}

		this.cache.delete(id);
		this.recordMap.delete(id);

		Log.log(archiveLogger, `🗑️ Deleted record ${id} from cache archive`);

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
		const exists = this.recordMap.has(id) || this.cache.get(id) !== null;
		return await Promise.resolve(exists);
	}

	async all(): Promise<CarnivalRecord[]> {
		return await this.find({});
	}

	/**
	 * ========================================================================
	 * BATCH OPERATIONS
	 * ========================================================================
	 */

	async bulkCreate(records: CarnivalRecord[]): Promise<ArchiveBatchResult> {
		const result: ArchiveBatchResult = {
			successful: [],
			failed: []
		};

		for (const record of records) {
			try {
				await this.create(record);
				result.successful.push(record.id);
			} catch (error) {
				result.failed.push({
					id: record.id,
					error: error instanceof Error ? error.message : 'Unknown error'
				});
			}
		}

		return await Promise.resolve(result);
	}

	async bulkUpdate(
		updates: Array<{ id: string; updates: Partial<CarnivalRecord> }>
	): Promise<ArchiveBatchResult> {
		const result: ArchiveBatchResult = {
			successful: [],
			failed: []
		};

		for (const { id, updates: recordUpdates } of updates) {
			try {
				const updated = await this.update(id, recordUpdates);
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
		const records = Array.from(this.recordMap.values());
		const byTerritory: Record<string, number> = {};
		const byType: Record<string, number> = {};

		for (const cacheRecord of records) {
			const record = cacheRecord.asRecord;
			byTerritory[record.territory] = (byTerritory[record.territory] ?? 0) + 1;
			byType[record.actType] = (byType[record.actType] ?? 0) + 1;
		}

		const stats: ArchiveStats = {
			totalRecords: records.length,
			recordsByTerritory: byTerritory,
			recordsByType: byType,
			oldestRecord: records.length > 0 ? records[0].asRecord.createdAt : undefined,
			newestRecord:
				records.length > 0 ? records[records.length - 1].asRecord.createdAt : undefined
		};

		return await Promise.resolve(stats);
	}

	async clear(): Promise<void> {
		for (const id of this.recordMap.keys()) {
			await this.delete(id);
		}
		Log.log(archiveLogger, '🧹 Cleared all records from cache archive');
		return await Promise.resolve();
	}

	async cleanup(): Promise<void> {
		// Expired records are auto-cleaned by the underlying cache
		Log.log(archiveLogger, '🧹 Cache archive cleanup (delegated to underlying cache)');
		return await Promise.resolve();
	}

	/**
	 * ========================================================================
	 * PRIVATE HELPERS
	 * ========================================================================
	 */

	/**
	 * Convert Performer to CarnivalRecord
	 */
	private performerToCarnivalRecord(performer: Performer): CarnivalRecord {
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
	 * Check if record matches query criteria
	 */
	private matchesQuery(record: CarnivalRecord, query: ArchiveQueryOptions): boolean {
		if (query.territory && record.territory !== query.territory) {
			return false;
		}
		if (query.actType && record.actType !== query.actType) {
			return false;
		}
		if (query.status && record.status !== query.status) {
			return false;
		}
		if (query.performerId && record.id !== query.performerId) {
			return false;
		}
		return true;
	}

	/**
	 * Sort records in-place
	 */
	private sortRecords(
		records: CarnivalRecord[],
		sortBy: 'createdAt' | 'updatedAt' | 'title' | 'territory',
		order: 'asc' | 'desc'
	): void {
		records.sort((a, b) => {
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
