/**
 * ============================================================================
 * ARCHIVE INTERFACE - Carnival Record Storage Contract
 * ============================================================================
 * 
 * The Archive is the carnival's tome of records - a storage abstraction that
 * enables swapping storage backends without changing business logic.
 * 
 * Design Philosophy:
 * - "Archive" evokes tome-y, old-world record preservation
 * - Clean separation between storage and business logic
 * - Adapter pattern for backend flexibility
 * - Async-first for database compatibility
 * 
 * Current Implementations:
 * - InMemoryArchive: Fast, ephemeral storage (current ActService storage)
 * - CacheArchive: PersistentPerformerCache wrapper (fallback layer)
 * - RxDBArchive: [Phase 4] RxDB integration
 * 
 * Exports:
 * - ArchiveBatchResult
 * - ArchiveQueryOptions
 * - ArchiveStats
 * - ArchiveTransaction
 * - ArchiveInterface
 * 
 * @example
 * ```typescript
 * const archive: ArchiveInterface = new InMemoryArchive();
 * 
 * // Create
 * await archive.create(record);
 * 
 * // Read
 * const record = await archive.findById('act-123');
 * const records = await archive.find({ territory: 'backstage' });
 * 
 * // Update
 * await archive.update('act-123', { status: 'archived' });
 * 
 * // Delete
 * await archive.delete('act-123');
 * ```
 */

import type { CarnivalRecord } from './records-types';

/**
 * Batch operation result
 */
export interface ArchiveBatchResult {
	successful: string[]; // IDs of successful operations
	failed: Array<{
		id: string;
		error: string;
	}>;
}

/**
 * Query options for filtering and pagination
 */
export interface ArchiveQueryOptions {
	// Filtering
	territory?: string;
	actType?: string;
	status?: 'active' | 'archived' | 'cancelled';
	performerId?: string;
	
	// Date range
	dateRange?: {
		start: string;
		end: string;
	};
	
	// Pagination
	limit?: number;
	offset?: number;
	
	// Sorting
	sortBy?: 'createdAt' | 'updatedAt' | 'title' | 'territory';
	sortOrder?: 'asc' | 'desc';
}

/**
 * Archive statistics
 */
export interface ArchiveStats {
	totalRecords: number;
	recordsByTerritory: Record<string, number>;
	recordsByType: Record<string, number>;
	oldestRecord?: string; // ISO timestamp
	newestRecord?: string; // ISO timestamp
	storageSize?: number;  // bytes (if available)
}

/**
 * Transaction interface for atomic operations
 */
export interface ArchiveTransaction {
	create(record: CarnivalRecord): Promise<void>;
	update(id: string, updates: Partial<CarnivalRecord>): Promise<void>;
	delete(id: string): Promise<void>;
	commit(): Promise<void>;
	rollback(): Promise<void>;
}

/**
 * ============================================================================
 * MAIN ARCHIVE INTERFACE
 * ============================================================================
 */
export interface ArchiveInterface {
	/**
	 * Archive name/identifier
	 */
	readonly name: string;
	
	/**
	 * Initialize the archive
	 */
	initialize?(): Promise<void>;
	
	/**
	 * ========================================================================
	 * CRUD OPERATIONS
	 * ========================================================================
	 */
	
	/**
	 * Create a new record
	 * @throws {Error} If record with same ID already exists
	 */
	create(record: CarnivalRecord): Promise<CarnivalRecord>;
	
	/**
	 * Find record by ID
	 * @returns Record or null if not found
	 */
	findById(id: string): Promise<CarnivalRecord | null>;
	
	/**
	 * Find multiple records by query
	 * @returns Array of matching records
	 */
	find(query: ArchiveQueryOptions): Promise<CarnivalRecord[]>;
	
	/**
	 * Find one record by query
	 * @returns First matching record or null
	 */
	findOne(query: ArchiveQueryOptions): Promise<CarnivalRecord | null>;
	
	/**
	 * Update a record
	 * @returns Updated record or null if not found
	 */
	update(id: string, updates: Partial<CarnivalRecord>): Promise<CarnivalRecord | null>;
	
	/**
	 * Delete a record
	 * @returns true if deleted, false if not found
	 */
	delete(id: string): Promise<boolean>;
	
	/**
	 * ========================================================================
	 * QUERY OPERATIONS
	 * ========================================================================
	 */
	
	/**
	 * Count records matching query
	 */
	count(query: ArchiveQueryOptions): Promise<number>;
	
	/**
	 * Check if record exists
	 */
	exists(id: string): Promise<boolean>;
	
	/**
	 * Get all records (use with caution on large datasets)
	 */
	all(): Promise<CarnivalRecord[]>;
	
	/**
	 * ========================================================================
	 * BATCH OPERATIONS
	 * ========================================================================
	 */
	
	/**
	 * Create multiple records
	 */
	bulkCreate(records: CarnivalRecord[]): Promise<ArchiveBatchResult>;
	
	/**
	 * Update multiple records
	 */
	bulkUpdate(updates: Array<{ id: string; updates: Partial<CarnivalRecord> }>): Promise<ArchiveBatchResult>;
	
	/**
	 * Delete multiple records
	 */
	bulkDelete(ids: string[]): Promise<ArchiveBatchResult>;
	
	/**
	 * ========================================================================
	 * INDEX MANAGEMENT
	 * ========================================================================
	 */
	
	/**
	 * Create an index on a field
	 * @param field Field name to index
	 * @param options Index options (unique, sparse, etc.)
	 */
	createIndex?(field: keyof CarnivalRecord, options?: {
		unique?: boolean;
		sparse?: boolean;
	}): Promise<void>;
	
	/**
	 * Drop an index
	 */
	dropIndex?(field: keyof CarnivalRecord): Promise<void>;
	
	/**
	 * Rebuild all indexes
	 */
	rebuildIndexes?(): Promise<void>;
	
	/**
	 * ========================================================================
	 * TRANSACTION SUPPORT
	 * ========================================================================
	 */
	
	/**
	 * Begin a transaction
	 * Optional feature - archives may not support transactions
	 */
	beginTransaction?(): Promise<ArchiveTransaction>;
	
	/**
	 * ========================================================================
	 * MAINTENANCE & STATS
	 * ========================================================================
	 */
	
	/**
	 * Get archive statistics
	 */
	stats(): Promise<ArchiveStats>;
	
	/**
	 * Clear all records
	 * USE WITH CAUTION
	 */
	clear(): Promise<void>;
	
	/**
	 * Cleanup and close connections
	 */
	cleanup(): Promise<void>;
}