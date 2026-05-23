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
	CarnivalAct,
	LogContext
} from '../types/public';

const archiveLogger: LogContext = {
	context: 'InMemoryArchive',
	path: '/.obsidian/plugins/carnival-network/src/archive/in-memory-archive'
};

export class InMemoryArchive implements ArchiveInterface {
	public readonly name = 'InMemoryArchive';
	
	// Main storage
	private acts: Map<string, CarnivalAct> = new Map();
	
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
	
	async create(act: CarnivalAct): Promise<CarnivalAct> {
		if (this.acts.has(act.id)) {
			throw new Error(`Record with ID ${ act.id } already exists`);
		}
		
		this.acts.set(act.id, act);
		this.updateIndexes(act);
		
		return await Promise.resolve(act);
	}
	
	async findById(id: string): Promise<CarnivalAct | null> {
		return await Promise.resolve(this.acts.get(id) ?? null);
	}
	
	async find(query: ArchiveQueryOptions): Promise<CarnivalAct[]> {
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
		
		// If no indexes matched, use all acts
		candidateIds ??= new Set(this.acts.keys());
		
		// Filter candidates
		let results: CarnivalAct[] = [];
		for (const id of candidateIds) {
			const act = this.acts.get(id);
			if (act && this.matchesQuery(act, query)) {
				results.push(act);
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
	
	async findOne(query: ArchiveQueryOptions): Promise<CarnivalAct | null> {
		const results = await this.find({ ...query, limit: 1 });
		return results[0] ?? null;
	}
	
	async update(id: string, updates: Partial<CarnivalAct>): Promise<CarnivalAct | null> {
		const existing = this.acts.get(id);
		if (!existing) {
			return null;
		}
		
		// Remove from old indexes
		this.removeFromIndexes(existing);
		
		// Apply updates
		const updated: CarnivalAct = {
			...existing,
			...updates,
			id: existing.id, // Prevent ID changes
			updatedAt: new Date().toISOString()
		};
		
		this.acts.set(id, updated);
		this.updateIndexes(updated);
		
		return await Promise.resolve(updated);
	}
	
	async delete(id: string): Promise<boolean> {
		const act = this.acts.get(id);
		if (!act) {
			return false;
		}
		
		this.acts.delete(id);
		this.removeFromIndexes(act);
		
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
		return await Promise.resolve(this.acts.has(id));
	}
	
	async all(): Promise<CarnivalAct[]> {
		return await Promise.resolve(Array.from(this.acts.values()));
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
					error: error instanceof Error ? error.message : String(error)
				});
			}
		}
		
		return result;
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
	
	async createIndex(field: keyof CarnivalAct): Promise<void> {
		await Promise.resolve();
		// Indexes are automatically maintained
		Log.log(archiveLogger, `Index on ${String(field)} is automatically maintained`);
	}
	
	async dropIndex(field: keyof CarnivalAct): Promise<void> {
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
		
		// Rebuild from acts
		for (const act of this.acts.values()) {
			this.updateIndexes(act);
		}
		
		Log.log(archiveLogger, `✅ Rebuilt indexes for ${this.acts.size} acts`);
	}
	
	/**
	 * ========================================================================
	 * MAINTENANCE & STATS
	 * ========================================================================
	 */
	
	async stats(): Promise<ArchiveStats> {
		const acts = Array.from(this.acts.values());
		
		const actsByTerritory: Record<string, number> = {};
		const actsByType: Record<string, number> = {};
		let oldest = Infinity;
		let newest = 0;
		
		for (const act of acts) {
			// Territory count
			actsByTerritory[act.territory] = (actsByTerritory[act.territory] ?? 0) + 1;
			
			// Type count
			actsByType[act.actType] = (actsByType[act.actType] ?? 0) + 1;
			
			// Age tracking
			const created = new Date(act.createdAt).getTime();
			oldest = Math.min(oldest, created);
			newest = Math.max(newest, created);
		}
		
		// Estimate storage size (rough)
		const storageSize = acts.reduce((total, act) => 
			total + JSON.stringify(act).length, 0
		);
		
		return await Promise.resolve({
			totalRecords: acts.length,
			actsByTerritory,
			actsByType,
			oldestRecord: oldest !== Infinity ? new Date(oldest).toISOString() : undefined,
			newestRecord: newest !== 0 ? new Date(newest).toISOString() : undefined,
			storageSize
		});
	}
	
	async clear(): Promise<void> {
		await Promise.resolve();
		this.acts.clear();
		this.byTerritory.clear();
		this.byActType.clear();
		this.byPerformer.clear();
		this.byStatus.clear();
		
		Log.warn(archiveLogger, '🗑️ All acts cleared');
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
	
	private updateIndexes(act: CarnivalAct): void {
		// Territory index
		if (!this.byTerritory.has(act.territory)) {
			this.byTerritory.set(act.territory, new Set());
		}
		const territorySet = this.byTerritory.get(act.territory);
		if (territorySet) {
			territorySet.add(act.id);
		}
		
		// ActType index
		if (!this.byActType.has(act.actType)) {
			this.byActType.set(act.actType, new Set());
		}
		const actTypeSet = this.byActType.get(act.actType);
		if (actTypeSet) {
			actTypeSet.add(act.id);
		}
		
		// Status index
		if (!this.byStatus.has(act.status)) {
			this.byStatus.set(act.status, new Set());
		}
		const statusSet = this.byStatus.get(act.status);
		if (statusSet) {
			statusSet.add(act.id);
		}
		
		// Performer index
		if (act.metadata.performerId) {
			const performerId = String(act.metadata.performerId);
			if (!this.byPerformer.has(performerId)) {
				this.byPerformer.set(performerId, new Set());
			}
			const performerSet = this.byPerformer.get(performerId);
			if (performerSet) {
				performerSet.add(act.id);
			}
		}
	}
	
	private removeFromIndexes(act: CarnivalAct): void {
		this.byTerritory.get(act.territory)?.delete(act.id);
		this.byActType.get(act.actType)?.delete(act.id);
		this.byStatus.get(act.status)?.delete(act.id);
		
		if (act.metadata.performerId) {
			const performerId = String(act.metadata.performerId);
			this.byPerformer.get(performerId)?.delete(act.id);
		}
	}
	
	private matchesQuery(act: CarnivalAct, query: ArchiveQueryOptions): boolean {
		// Territory
		if (query.territory && act.territory !== query.territory) {
			return false;
		}
		
		// ActType
		if (query.actType && act.actType !== query.actType) {
			return false;
		}
		
		// Status
		if (query.status && act.status !== query.status) {
			return false;
		}
		
		// PerformerId
		if (query.performerId && act.metadata.performerId !== query.performerId) {
			return false;
		}
		
		// Date range
		if (query.dateRange) {
			const created = new Date(act.createdAt).getTime();
			const start = new Date(query.dateRange.start).getTime();
			const end = new Date(query.dateRange.end).getTime();
			
			if (created < start || created > end) {
				return false;
			}
		}
		
		return true;
	}
	
	private sortRecords(
		acts: CarnivalAct[],
		sortBy: 'createdAt' | 'updatedAt' | 'title' | 'territory',
		order: 'asc' | 'desc'
	): CarnivalAct[] {
		return acts.sort((a, b) => {
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