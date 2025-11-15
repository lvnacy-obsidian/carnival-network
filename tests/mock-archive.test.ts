/**
 * ============================================================================
 * MOCK ARCHIVE - Testing Utility
 * ============================================================================
 * 
 * Mock implementation of ArchiveInterface for unit testing.
 * Tracks method calls and allows configuring behavior/errors.
 * 
 * Use Cases:
 * - Unit testing ActService without real storage
 * - Testing error handling
 * - Verifying correct archive usage
 * - Performance testing without I/O overhead
 */

import type {
	ArchiveInterface,
	ArchiveQueryOptions,
	ArchiveBatchResult,
	ArchiveStats,
	CarnivalRecord
} from '../src/types/public';

/**
 * Method call record for testing verification
 */
export interface MethodCall {
	method: string;
	args: any[];
	timestamp: number;
}

/**
 * Mock configuration
 */
export interface MockArchiveConfig {
	/** Throw errors for specific methods */
	throwOn?: {
		create?: Error;
		findById?: Error;
		find?: Error;
		update?: Error;
		delete?: Error;
		[key: string]: Error | undefined;
	};
	
	/** Simulate latency (ms) */
	latency?: number;
	
	/** Return null for specific IDs */
	missingIds?: Set<string>;
}

export class MockArchive implements ArchiveInterface {
	public readonly name = 'MockArchive';
	
	// Test data
	private data: Map<string, CarnivalRecord> = new Map();
	
	// Call tracking
	private calls: MethodCall[] = [];
	
	// Configuration
	private config: MockArchiveConfig;
	
	constructor(config: MockArchiveConfig = {}) {
		this.config = config;
	}
	
	/**
	 * ========================================================================
	 * TEST UTILITIES
	 * ========================================================================
	 */
	
	/**
	 * Get all method calls
	 */
	getCalls(): MethodCall[] {
		return [...this.calls];
	}
	
	/**
	 * Get calls for specific method
	 */
	getCallsFor(method: string): MethodCall[] {
		return this.calls.filter(call => call.method === method);
	}
	
	/**
	 * Clear call history
	 */
	clearCalls(): void {
		this.calls = [];
	}
	
	/**
	 * Reset mock state
	 */
	reset(): void {
		this.data.clear();
		this.calls = [];
	}
	
	/**
	 * Seed test data
	 */
	seed(records: CarnivalRecord[]): void {
		for (const record of records) {
			this.data.set(record.id, record);
		}
	}
	
	/**
	 * Get internal data for verification
	 */
	getData(): CarnivalRecord[] {
		return Array.from(this.data.values());
	}
	
	/**
	 * ========================================================================
	 * ARCHIVE INTERFACE IMPLEMENTATION
	 * ========================================================================
	 */
	
	async create(record: CarnivalRecord): Promise<CarnivalRecord> {
		this.recordCall('create', [record]);
		
		if (this.config.throwOn?.create) {
			throw this.config.throwOn.create;
		}
		
		await this.simulateLatency();
		
		if (this.data.has(record.id)) {
			throw new Error(`Record ${record.id} already exists`);
		}
		
		this.data.set(record.id, record);
		return record;
	}
	
	async findById(id: string): Promise<CarnivalRecord | null> {
		this.recordCall('findById', [id]);
		
		if (this.config.throwOn?.findById) {
			throw this.config.throwOn.findById;
		}
		
		await this.simulateLatency();
		
		if (this.config.missingIds?.has(id)) {
			return null;
		}
		
		return this.data.get(id) ?? null;
	}
	
	async find(query: ArchiveQueryOptions): Promise<CarnivalRecord[]> {
		this.recordCall('find', [query]);
		
		if (this.config.throwOn?.find) {
			throw this.config.throwOn.find;
		}
		
		await this.simulateLatency();
		
		// Simple mock implementation - just return all for testing
		return Array.from(this.data.values());
	}
	
	async findOne(query: ArchiveQueryOptions): Promise<CarnivalRecord | null> {
		this.recordCall('findOne', [query]);
		await this.simulateLatency();
		
		const results = await this.find(query);
		return results[0] ?? null;
	}
	
	async update(id: string, updates: Partial<CarnivalRecord>): Promise<CarnivalRecord | null> {
		this.recordCall('update', [id, updates]);
		
		if (this.config.throwOn?.update) {
			throw this.config.throwOn.update;
		}
		
		await this.simulateLatency();
		
		const existing = this.data.get(id);
		if (!existing) {
			return null;
		}
		
		const updated = { ...existing, ...updates, id };
		this.data.set(id, updated);
		return updated;
	}
	
	async delete(id: string): Promise<boolean> {
		this.recordCall('delete', [id]);
		
		if (this.config.throwOn?.delete) {
			throw this.config.throwOn.delete;
		}
		
		await this.simulateLatency();
		
		return this.data.delete(id);
	}
	
	async count(query: ArchiveQueryOptions): Promise<number> {
		this.recordCall('count', [query]);
		await this.simulateLatency();
		
		const results = await this.find(query);
		return results.length;
	}
	
	async exists(id: string): Promise<boolean> {
		this.recordCall('exists', [id]);
		await this.simulateLatency();
		
		return this.data.has(id);
	}
	
	async all(): Promise<CarnivalRecord[]> {
		this.recordCall('all', []);
		await this.simulateLatency();
		
		return Array.from(this.data.values());
	}
	
	async bulkCreate(records: CarnivalRecord[]): Promise<ArchiveBatchResult> {
		this.recordCall('bulkCreate', [records]);
		await this.simulateLatency();
		
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
		this.recordCall('bulkUpdate', [updates]);
		await this.simulateLatency();
		
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
					result.failed.push({ id, error: 'Not found' });
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
		this.recordCall('bulkDelete', [ids]);
		await this.simulateLatency();
		
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
					result.failed.push({ id, error: 'Not found' });
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
	
	async stats(): Promise<ArchiveStats> {
		this.recordCall('stats', []);
		await this.simulateLatency();
		
		return {
			totalRecords: this.data.size,
			recordsByTerritory: {},
			recordsByType: {}
		};
	}
	
	async clear(): Promise<void> {
		this.recordCall('clear', []);
		await this.simulateLatency();
		
		this.data.clear();
	}
	
	async cleanup(): Promise<void> {
		this.recordCall('cleanup', []);
		await this.simulateLatency();
		
		this.data.clear();
	}
	
	/**
	 * ========================================================================
	 * PRIVATE HELPERS
	 * ========================================================================
	 */
	
	private recordCall(method: string, args: any[]): void {
		this.calls.push({
			method,
			args,
			timestamp: Date.now()
		});
	}
	
	private async simulateLatency(): Promise<void> {
		if (this.config.latency) {
			await new Promise(resolve => setTimeout(resolve, this.config.latency));
		}
	}
}

/**
 * ============================================================================
 * TEST HELPERS
 * ============================================================================
 */

/**
 * Create a mock record for testing
 */
export function createMockRecord(overrides?: Partial<CarnivalRecord>): CarnivalRecord {
	return {
		id: `test-${Date.now()}`,
		title: 'Test Record',
		territory: 'test-territory',
		actType: 'changelog',
		content: 'Test content',
		metadata: {},
		createdAt: new Date().toISOString(),
		status: 'active',
		syncPreferences: {
			requireAck: false,
			broadcastToAll: false
		},
		...overrides
	};
}

/**
 * Create multiple mock records
 */
export function createMockRecords(count: number, overrides?: Partial<CarnivalRecord>): CarnivalRecord[] {
	return Array.from({ length: count }, (_, i) =>
		createMockRecord({
			id: `test-${i}`,
			title: `Test Record ${i}`,
			...overrides
		})
	);
}