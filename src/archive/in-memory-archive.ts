/**
 * ============================================================================
 * IN-MEMORY ARCHIVE - Fast Ephemeral Storage
 * ============================================================================
 * 
 * Wraps the existing Map-based storage used by ActService with the
 * ArchiveInterface contract. Maintains in-memory indexes for fast queries.
 * 
 * Characteristics:
 * - Extremely fast (no I/O)
 * - No persistence (data lost on restart)
 * - Low memory footprint with indexes
 * - Synchronous operations (wrapped in Promise for interface compatibility)
 * 
 * Use Cases:
 * - Development and testing
 * - Temporary storage
 * - Cache layer
 * - Session-scoped data
 */

import { Log } from '../utils/logger';
import type {
	ArchiveInterface,
	ArchiveQueryOptions,
	ArchiveBatchResult,
	ArchiveStats,
	CarnivalRecord,
	LogContext
} from '../types/public';

const archiveLogger: LogContext = {
	context: 'InMemoryArchive',
	path: '/.obsidian/plugins/carnival-network/src/archive/in-memory-archive'
};

export class InMemoryArchive implements ArchiveInterface {
	public readonly name = 'InMemoryArchive';
	
	// Main storage
	private records: Map<string, CarnivalRecord> = new Map();
	
	// Indexes for fast queries
	private byTerritory: Map<string, Set<string>> = new Map();
	private byActType: Map<string, Set<string>> = new Map();
	private byPerformer: Map<string, Set<string>> = new Map();
	private byStatus: Map<string, Set<string>> = new Map();
	
	constructor() {
		Log.log(archiveLogger, '📚 InMemoryArchive initialized');
	}
	
	/**
	 * ========================================================================
	 * CRUD OPERATIONS
	 * ========================================================================
	 */
	
	async create(record: CarnivalRecord): Promise<CarnivalRecord> {
		if (this.records.has(record.id)) {
			throw new Error(`Record with ID ${record.id} already exists`);
		}
		
		this.records.set(record.id, record);
		this.updateIndexes(record);
		
		return await Promise.resolve(record);
	}
	
	async findById(id: string): Promise<CarnivalRecord | null> {
		return await Promise.resolve(this.records.get(id) ?? null);
	}
	
	async find(query: ArchiveQueryOptions): Promise<CarnivalRecord[]> {
		let candidateIds: Set<string> | null = null;
		
		// Use indexes to narrow down candidates
		if (query.territory) {
			candidateIds = this.intersect(candidateIds, this.byTerritory.get(query.territory));
		}
		
		if (query.actType) {
			candidateIds = this.intersect(candidateIds, this.byActType.get(query.actType));
		}
		
		if (query.status) {
			candidateIds = this.intersect(candidateIds, this.byStatus.get(query.status));
		}
		
		if (query.performerId) {
			candidateIds = this.intersect(candidateIds, this.byPerformer.get(query.performerId));
		}
		
		// If no indexes matched, use all records
		candidateIds ??= new Set(this.records.keys());
		
		// Filter candidates
		let results: CarnivalRecord[] = [];
		for (const id of candidateIds) {
			const record = this.records.get(id);
			if (record && this.matchesQuery(record, query)) {
				results.push(record);
			}
		}
		
		// Sort
		if (query.sortBy) {
			results = this.sortRecords(results, query.sortBy, query.sortOrder ?? 'desc');
		} else {
			// Default: sort by createdAt desc
			results.sort((a, b) => 
				new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
			);
		}
		
		// Paginate
		const offset = query.offset ?? 0;
		const limit = query.limit ?? results.length;
		
		return await Promise.resolve(results.slice(offset, offset + limit));
	}
	
	async findOne(query: ArchiveQueryOptions): Promise<CarnivalRecord | null> {
		const results = await this.find({ ...query, limit: 1 });
		return results[0] ?? null;
	}
	
	async update(id: string, updates: Partial<CarnivalRecord>): Promise<CarnivalRecord | null> {
		const existing = this.records.get(id);
		if (!existing) {
			return null;
		}
		
		// Remove from old indexes
		this.removeFromIndexes(existing);
		
		// Apply updates
		const updated: CarnivalRecord = {
			...existing,
			...updates,
			id: existing.id, // Prevent ID changes
			updatedAt: new Date().toISOString()
		};
		
		this.records.set(id, updated);
		this.updateIndexes(updated);
		
		return await Promise.resolve(updated);
	}
	
	async delete(id: string): Promise<boolean> {
		const record = this.records.get(id);
		if (!record) {
			return false;
		}
		
		this.records.delete(id);
		this.removeFromIndexes(record);
		
		return await Promise.resolve(true);
	}
	
	/**
	 * ========================================================================
	 * QUERY OPERATIONS
	 * ========================================================================
	 */
	
	async count(query: ArchiveQueryOptions): Promise<number> {
		const results = await this.find({ ...query, offset: 0, limit: undefined });
		return results.length;
	}
	
	async exists(id: string): Promise<boolean> {
		return await Promise.resolve(this.records.has(id));
	}
	
	async all(): Promise<CarnivalRecord[]> {
		return await Promise.resolve(Array.from(this.records.values()));
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
					error: error instanceof Error ? error.message : String(error)
				});
			}
		}
		
		return result;
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
					result.failed.push({ id, error: 'Record not found' });
				}
			} catch (error) {
				result.failed.push({
					id,
					error: error instanceof Error ? error.message : String(error)
				});
			}
		}
		
		return result;
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
					result.failed.push({ id, error: 'Record not found' });
				}
			} catch (error) {
				result.failed.push({
					id,
					error: error instanceof Error ? error.message : String(error)
				});
			}
		}
		
		return result;
	}
	
	/**
	 * ========================================================================
	 * INDEX MANAGEMENT
	 * ========================================================================
	 */
	
	async createIndex(field: keyof CarnivalRecord): Promise<void> {
		await Promise.resolve();
		// Indexes are automatically maintained
		Log.log(archiveLogger, `Index on ${String(field)} is automatically maintained`);
	}
	
	async dropIndex(field: keyof CarnivalRecord): Promise<void> {
		await Promise.resolve();
		// Cannot drop core indexes
		Log.warn(archiveLogger, `Cannot drop index on ${String(field)} - automatically maintained`);
	}
	
	async rebuildIndexes(): Promise<void> {
		await Promise.resolve();
		Log.log(archiveLogger, '🔨 Rebuilding indexes...');
		
		// Clear indexes
		this.byTerritory.clear();
		this.byActType.clear();
		this.byPerformer.clear();
		this.byStatus.clear();
		
		// Rebuild from records
		for (const record of this.records.values()) {
			this.updateIndexes(record);
		}
		
		Log.log(archiveLogger, `✅ Rebuilt indexes for ${this.records.size} records`);
	}
	
	/**
	 * ========================================================================
	 * MAINTENANCE & STATS
	 * ========================================================================
	 */
	
	async stats(): Promise<ArchiveStats> {
		const records = Array.from(this.records.values());
		
		const recordsByTerritory: Record<string, number> = {};
		const recordsByType: Record<string, number> = {};
		let oldest = Infinity;
		let newest = 0;
		
		for (const record of records) {
			// Territory count
			recordsByTerritory[record.territory] = (recordsByTerritory[record.territory] ?? 0) + 1;
			
			// Type count
			recordsByType[record.actType] = (recordsByType[record.actType] ?? 0) + 1;
			
			// Age tracking
			const created = new Date(record.createdAt).getTime();
			oldest = Math.min(oldest, created);
			newest = Math.max(newest, created);
		}
		
		// Estimate storage size (rough)
		const storageSize = records.reduce((total, record) => 
			total + JSON.stringify(record).length, 0
		);
		
		return await Promise.resolve({
			totalRecords: records.length,
			recordsByTerritory,
			recordsByType,
			oldestRecord: oldest !== Infinity ? new Date(oldest).toISOString() : undefined,
			newestRecord: newest !== 0 ? new Date(newest).toISOString() : undefined,
			storageSize
		});
	}
	
	async clear(): Promise<void> {
		await Promise.resolve();
		this.records.clear();
		this.byTerritory.clear();
		this.byActType.clear();
		this.byPerformer.clear();
		this.byStatus.clear();
		
		Log.warn(archiveLogger, '🗑️ All records cleared');
	}
	
	async cleanup(): Promise<void> {
		await this.clear();
		Log.log(archiveLogger, '🧹 Cleanup complete');
	}
	
	/**
	 * ========================================================================
	 * PRIVATE HELPERS
	 * ========================================================================
	 */
	
	private updateIndexes(record: CarnivalRecord): void {
		// Territory index
		if (!this.byTerritory.has(record.territory)) {
			this.byTerritory.set(record.territory, new Set());
		}
		const territorySet = this.byTerritory.get(record.territory);
		if (territorySet) {
			territorySet.add(record.id);
		}
		
		// ActType index
		if (!this.byActType.has(record.actType)) {
			this.byActType.set(record.actType, new Set());
		}
		const actTypeSet = this.byActType.get(record.actType);
		if (actTypeSet) {
			actTypeSet.add(record.id);
		}
		
		// Status index
		if (!this.byStatus.has(record.status)) {
			this.byStatus.set(record.status, new Set());
		}
		const statusSet = this.byStatus.get(record.status);
		if (statusSet) {
			statusSet.add(record.id);
		}
		
		// Performer index
		if (record.metadata.performerId) {
			const performerId = String(record.metadata.performerId);
			if (!this.byPerformer.has(performerId)) {
				this.byPerformer.set(performerId, new Set());
			}
			const performerSet = this.byPerformer.get(performerId);
			if (performerSet) {
				performerSet.add(record.id);
			}
		}
	}
	
	private removeFromIndexes(record: CarnivalRecord): void {
		this.byTerritory.get(record.territory)?.delete(record.id);
		this.byActType.get(record.actType)?.delete(record.id);
		this.byStatus.get(record.status)?.delete(record.id);
		
		if (record.metadata.performerId) {
			const performerId = String(record.metadata.performerId);
			this.byPerformer.get(performerId)?.delete(record.id);
		}
	}
	
	private matchesQuery(record: CarnivalRecord, query: ArchiveQueryOptions): boolean {
		// Territory
		if (query.territory && record.territory !== query.territory) {
			return false;
		}
		
		// ActType
		if (query.actType && record.actType !== query.actType) {
			return false;
		}
		
		// Status
		if (query.status && record.status !== query.status) {
			return false;
		}
		
		// PerformerId
		if (query.performerId && record.metadata.performerId !== query.performerId) {
			return false;
		}
		
		// Date range
		if (query.dateRange) {
			const created = new Date(record.createdAt).getTime();
			const start = new Date(query.dateRange.start).getTime();
			const end = new Date(query.dateRange.end).getTime();
			
			if (created < start || created > end) {
				return false;
			}
		}
		
		return true;
	}
	
	private sortRecords(
		records: CarnivalRecord[],
		sortBy: 'createdAt' | 'updatedAt' | 'title' | 'territory',
		order: 'asc' | 'desc'
	): CarnivalRecord[] {
		return records.sort((a, b) => {
			let comparison = 0;
			
			switch (sortBy) {
				case 'createdAt':
					comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
					break;
				case 'updatedAt': {
					const aTime = a.updatedAt ? new Date(a.updatedAt).getTime() : new Date(a.createdAt).getTime();
					const bTime = b.updatedAt ? new Date(b.updatedAt).getTime() : new Date(b.createdAt).getTime();
					comparison = aTime - bTime;
					break;
				}
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
	
	private intersect(a: Set<string> | null, b: Set<string> | undefined): Set<string> | null {
		if (a === null) {
			return b ? new Set(b) : null;
		}
		if (!b) {
			return a;
		}
		
		return new Set([...a].filter(x => b.has(x)));
	}
}