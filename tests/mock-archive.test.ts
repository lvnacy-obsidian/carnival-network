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
	CarnivalAct
} from '../src/types/public';

/**
 * Method call act for testing verification
 */
export interface MethodCall {
	method: string;
	args: unknown[];
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
	private data: Map<string, CarnivalAct> = new Map();
	
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
	seed(acts: CarnivalAct[]): void {
		for (const act of acts) {
			this.data.set(act.id, act);
		}
	}
	
	/**
	 * Get internal data for verification
	 */
	getData(): CarnivalAct[] {
		return Array.from(this.data.values());
	}
	
	/**
	 * ========================================================================
	 * ARCHIVE INTERFACE IMPLEMENTATION
	 * ========================================================================
	 */
	
	async create(act: CarnivalAct): Promise<CarnivalAct> {
		this.actCall('create', [act]);
		
		if (this.config.throwOn?.create) {
			throw this.config.throwOn.create;
		}
		
		await this.simulateLatency();
		
		if (this.data.has(act.id)) {
			throw new Error(`Record ${act.id} already exists`);
		}
		
		this.data.set(act.id, act);
		return act;
	}
	
	async findById(id: string): Promise<CarnivalAct | null> {
		this.actCall('findById', [id]);
		
		if (this.config.throwOn?.findById) {
			throw this.config.throwOn.findById;
		}
		
		await this.simulateLatency();
		
		if (this.config.missingIds?.has(id)) {
			return null;
		}
		
		return this.data.get(id) ?? null;
	}
	
	async find(query: ArchiveQueryOptions): Promise<CarnivalAct[]> {
		this.actCall('find', [query]);
		
		if (this.config.throwOn?.find) {
			throw this.config.throwOn.find;
		}
		
		await this.simulateLatency();
		
		// Simple mock implementation - just return all for testing
		return Array.from(this.data.values());
	}
	
	async findOne(query: ArchiveQueryOptions): Promise<CarnivalAct | null> {
		this.actCall('findOne', [query]);
		await this.simulateLatency();
		
		const results = await this.find(query);
		return results[0] ?? null;
	}
	
	async update(id: string, updates: Partial<CarnivalAct>): Promise<CarnivalAct | null> {
		this.actCall('update', [id, updates]);
		
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
		this.actCall('delete', [id]);
		
		if (this.config.throwOn?.delete) {
			throw this.config.throwOn.delete;
		}
		
		await this.simulateLatency();
		
		return this.data.delete(id);
	}
	
	async count(query: ArchiveQueryOptions): Promise<number> {
		this.actCall('count', [query]);
		await this.simulateLatency();
		
		const results = await this.find(query);
		return results.length;
	}
	
	async exists(id: string): Promise<boolean> {
		this.actCall('exists', [id]);
		await this.simulateLatency();
		
		return this.data.has(id);
	}
	
	async all(): Promise<CarnivalAct[]> {
		this.actCall('all', []);
		await this.simulateLatency();
		
		return Array.from(this.data.values());
	}
	
	async bulkCreate(acts: CarnivalAct[]): Promise<ArchiveBatchResult> {
		this.actCall('bulkCreate', [acts]);
		await this.simulateLatency();
		
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
		this.actCall('bulkUpdate', [updates]);
		await this.simulateLatency();
		
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
		this.actCall('bulkDelete', [ids]);
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
		this.actCall('stats', []);
		await this.simulateLatency();
		
		return {
			totalRecords: this.data.size,
			actsByTerritory: {},
			actsByType: {}
		};
	}
	
	async clear(): Promise<void> {
		this.actCall('clear', []);
		await this.simulateLatency();
		
		this.data.clear();
	}
	
	async cleanup(): Promise<void> {
		this.actCall('cleanup', []);
		await this.simulateLatency();
		
		this.data.clear();
	}
	
	/**
	 * ========================================================================
	 * PRIVATE HELPERS
	 * ========================================================================
	 */
	
	private actCall(method: string, args: unknown[]): void {
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
 * Create a mock act for testing
 */
export function createMockRecord(overrides?: Partial<CarnivalAct>): CarnivalAct {
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
 * Create multiple mock acts
 */
export function createMockRecords(count: number, overrides?: Partial<CarnivalAct>): CarnivalAct[] {
	return Array.from({ length: count }, (_, i) =>
		createMockRecord({
			id: `test-${i}`,
			title: `Test Record ${i}`,
			...overrides
		})
	);
}