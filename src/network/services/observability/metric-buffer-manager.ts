import { Log } from '../../../utils/logger';
import type {
	BufferConfig,
	BufferStats,
	LogContext,
	MetricDataPoint
} from '../../../types/public';
import type { BufferedMetric } from '../../../types/internal';

const bufferLogger: LogContext = {
	context: 'Metric Buffer Manager',
	path: '/.obsidian/plugins/carnival-network/services/observability'
};

/**
 * Manages metric buffering with retention policies
 */
export class MetricBufferManager {
	private buffer: BufferedMetric[] = [];
	private config: BufferConfig;
	
	// Statistics
	private stats = {
		totalAdded: 0,
		totalDropped: 0,
		totalFlushed: 0,
		droppedByAge: 0,
		droppedByOverflow: 0
	};
	
	// Cleanup interval
	private cleanupInterval?: NodeJS.Timeout;
	
	constructor(config: Partial<BufferConfig> = {}) {
		this.config = {
			maxSize: 10000,
			maxAgeMs: 5 * 60 * 1000, // 5 minutes
			overflowStrategy: 'drop-oldest',
			enableMetrics: true,
			warningThreshold: 80,
			...config
		};
		
		// Start periodic cleanup
		this.startCleanup();
		
		Log.log(bufferLogger, `📊 Metric buffer initialized with max size: ${this.config.maxSize}`);
	}
	
	/**
	 * Add metrics to buffer
	 */
	add(metrics: MetricDataPoint[]): {
		added: number;
		dropped: number;
		reason?: string;
	} {
		const result = {
			added: 0,
			dropped: 0,
			reason: undefined as string | undefined
		};
		
		for (const metric of metrics) {
			// Check if buffer is full
			if (this.buffer.length >= this.config.maxSize) {
				// Handle overflow
				const spaceFreed = this.handleOverflow();
				
				if (spaceFreed === 0) {
					// Couldn't free space, drop this metric
					result.dropped++;
					this.stats.totalDropped++;
					this.stats.droppedByOverflow++;
					result.reason = 'Buffer full, overflow strategy failed';
					continue;
				}
			}
			
			// Add to buffer
			const bufferedMetric: BufferedMetric = {
				metric,
				addedAt: Date.now(),
				flushAttempts: 0
			};
			
			this.buffer.push(bufferedMetric);
			result.added++;
			this.stats.totalAdded++;
		}
		
		// Check warning threshold
		this.checkThreshold();
		
		// Log if any were dropped
		if (result.dropped > 0) {
			Log.warn(
				bufferLogger,
				`⚠️ Dropped ${result.dropped} metrics: ${result.reason}`
			);
		}
		
		return result;
	}
	
	/**
	 * Get metrics ready to flush (up to batchSize)
	 */
	getFlushBatch(batchSize: number): MetricDataPoint[] {
		const now = Date.now();
		const batch: MetricDataPoint[] = [];
		const indicesToRemove: number[] = [];
		
		// Clean expired metrics first
		this.cleanExpired();
		
		// Get up to batchSize metrics
		for (let i = 0; i < this.buffer.length && batch.length < batchSize; i++) {
			const buffered = this.buffer[i];
			
			// Don't include metrics that are too old
			if (now - buffered.addedAt > this.config.maxAgeMs) {
				indicesToRemove.push(i);
				this.stats.droppedByAge++;
				continue;
			}
			
			batch.push(buffered.metric);
		}
		
		// Remove expired metrics
		this.removeIndices(indicesToRemove);
		
		return batch;
	}
	
	/**
	 * Mark metrics as flushed and remove from buffer
	 */
	markFlushed(count: number): void {
		// Remove the first 'count' metrics (they were successfully flushed)
		this.buffer.splice(0, count);
		this.stats.totalFlushed += count;
		
		Log.log(bufferLogger, `✅ Flushed ${count} metrics from buffer`);
	}
	
	/**
	 * Mark flush as failed and increment retry count
	 */
	markFlushFailed(count: number, maxRetries: number = 3): number {
		let removed = 0;
		
		for (let i = 0; i < Math.min(count, this.buffer.length); i++) {
			this.buffer[i].flushAttempts++;
			
			// Remove if exceeded max retries
			if (this.buffer[i].flushAttempts >= maxRetries) {
				this.buffer.splice(i, 1);
				removed++;
				this.stats.totalDropped++;
				i--; // Adjust index after removal
			}
		}
		
		if (removed > 0) {
			Log.warn(
				bufferLogger,
				`⚠️ Dropped ${removed} metrics after ${maxRetries} failed flush attempts`
			);
		}
		
		return removed;
	}
	
	/**
	 * Get buffer statistics
	 */
	getStats(): BufferStats {
		const now = Date.now();
		let oldestAge: number | undefined;
		let newestAge: number | undefined;
		
		if (this.buffer.length > 0) {
			oldestAge = now - this.buffer[0].addedAt;
			newestAge = now - this.buffer[this.buffer.length - 1].addedAt;
		}
		
		return {
			currentSize: this.buffer.length,
			maxSize: this.config.maxSize,
			totalAdded: this.stats.totalAdded,
			totalDropped: this.stats.totalDropped,
			totalFlushed: this.stats.totalFlushed,
			droppedByAge: this.stats.droppedByAge,
			droppedByOverflow: this.stats.droppedByOverflow,
			oldestMetricAge: oldestAge,
			newestMetricAge: newestAge,
			utilizationPercent: (this.buffer.length / this.config.maxSize) * 100
		};
	}
	
	/**
	 * Get metrics that match a filter (for debugging/inspection)
	 */
	inspect(filter?: {
		name?: string;
		type?: MetricDataPoint['type'];
		minAge?: number;
		maxAge?: number;
	}): MetricDataPoint[] {
		const now = Date.now();
		
		return this.buffer
			.filter(buffered => {
				const age = now - buffered.addedAt;
				
				if (filter?.name && buffered.metric.name !== filter.name) {
					return false;
				}
				
				if (filter?.type && buffered.metric.type !== filter.type) {
					return false;
				}
				
				if (filter?.minAge && age < filter.minAge) {
					return false;
				}
				
				if (filter?.maxAge && age > filter.maxAge) {
					return false;
				}
				
				return true;
			})
			.map(buffered => buffered.metric);
	}
	
	/**
	 * Clear all metrics from buffer
	 */
	clear(): number {
		const count = this.buffer.length;
		this.buffer = [];
		
		Log.log(bufferLogger, `🗑️ Cleared ${count} metrics from buffer`);
		return count;
	}
	
	/**
	 * Reset statistics (but keep buffer)
	 */
	resetStats(): void {
		this.stats = {
			totalAdded: 0,
			totalDropped: 0,
			totalFlushed: 0,
			droppedByAge: 0,
			droppedByOverflow: 0
		};
		
		Log.log(bufferLogger, '📊 Buffer statistics reset');
	}
	
	/**
	 * Update buffer configuration
	 */
	updateConfig(config: Partial<BufferConfig>): void {
		const oldMaxSize = this.config.maxSize;
		this.config = { ...this.config, ...config };
		
		// If max size decreased, handle overflow
		if (this.config.maxSize < oldMaxSize && this.buffer.length > this.config.maxSize) {
			const removed = this.handleOverflow();
			Log.log(
				bufferLogger,
				`📊 Buffer size reduced from ${oldMaxSize} to ${this.config.maxSize}, removed ${removed} metrics`
			);
		}
		
		Log.log(bufferLogger, '⚙️ Buffer configuration updated');
	}
	
	/**
	 * Cleanup and stop background tasks
	 */
	cleanup(): void {
		if (this.cleanupInterval) {
			clearInterval(this.cleanupInterval);
			this.cleanupInterval = undefined;
		}
		
		const remaining = this.buffer.length;
		if (remaining > 0) {
			Log.warn(bufferLogger, `⚠️ Buffer cleanup with ${remaining} metrics still pending`);
		}
		
		Log.log(bufferLogger, '🧹 Metric buffer manager cleaned up');
	}
	
	/**
	 * Handle buffer overflow based on strategy
	 */
	private handleOverflow(): number {
		const toRemove = Math.ceil(this.config.maxSize * 0.1); // Remove 10%
		let removed = 0;
		
		switch (this.config.overflowStrategy) {
			case 'drop-oldest':
				removed = this.dropOldest(toRemove);
				break;
			
			case 'drop-newest':
				removed = this.dropNewest(toRemove);
				break;
			
			case 'drop-random':
				removed = this.dropRandom(toRemove);
				break;
		}
		
		if (removed > 0) {
			Log.warn(
				bufferLogger,
				`⚠️ Buffer overflow: dropped ${removed} ${this.config.overflowStrategy} metrics`
			);
		}
		
		return removed;
	}
	
	/**
	 * Drop oldest metrics
	 */
	private dropOldest(count: number): number {
		const removed = this.buffer.splice(0, count);
		this.stats.totalDropped += removed.length;
		this.stats.droppedByOverflow += removed.length;
		return removed.length;
	}
	
	/**
	 * Drop newest metrics
	 */
	private dropNewest(count: number): number {
		const removed = this.buffer.splice(-count);
		this.stats.totalDropped += removed.length;
		this.stats.droppedByOverflow += removed.length;
		return removed.length;
	}
	
	/**
	 * Drop random metrics
	 */
	private dropRandom(count: number): number {
		let removed = 0;
		
		for (let i = 0; i < count && this.buffer.length > 0; i++) {
			const randomIndex = Math.floor(Math.random() * this.buffer.length);
			this.buffer.splice(randomIndex, 1);
			removed++;
		}
		
		this.stats.totalDropped += removed;
		this.stats.droppedByOverflow += removed;
		return removed;
	}
	
	/**
	 * Remove metrics at specific indices
	 */
	private removeIndices(indices: number[]): void {
		// Sort in descending order to avoid index shifting
		indices.sort((a, b) => b - a);
		
		for (const index of indices) {
			this.buffer.splice(index, 1);
		}
		
		this.stats.totalDropped += indices.length;
	}
	
	/**
	 * Clean expired metrics
	 */
	private cleanExpired(): number {
		const now = Date.now();
		const maxAge = this.config.maxAgeMs;
		
		const originalLength = this.buffer.length;
		this.buffer = this.buffer.filter(buffered => {
			const age = now - buffered.addedAt;
			if (age > maxAge) {
				this.stats.droppedByAge++;
				return false;
			}
			return true;
		});
		
		const removed = originalLength - this.buffer.length;
		if (removed > 0) {
			Log.log(bufferLogger, `🧹 Cleaned ${removed} expired metrics (age > ${maxAge}ms)`);
		}
		
		return removed;
	}
	
	/**
	 * Check if buffer usage exceeds warning threshold
	 */
	private checkThreshold(): void {
		const utilizationPercent = (this.buffer.length / this.config.maxSize) * 100;
		
		if (utilizationPercent >= this.config.warningThreshold) {
			Log.warn(
				bufferLogger,
				`⚠️ Buffer usage at ${utilizationPercent.toFixed(1)}% (${this.buffer.length}/${this.config.maxSize})`
			);
		}
	}
	
	/**
	 * Start periodic cleanup
	 */
	private startCleanup(): void {
		// Clean expired metrics every 30 seconds
		this.cleanupInterval = setInterval(() => {
			this.cleanExpired();
		}, 30000);
	}
	
	/**
	 * Export buffer state for debugging/persistence
	 */
	exportState(): {
		buffer: MetricDataPoint[];
		stats: typeof this.stats;
		config: BufferConfig;
	} {
		return {
			buffer: this.buffer.map(b => b.metric),
			stats: { ...this.stats },
			config: { ...this.config }
		};
	}
	
	/**
	 * Import buffer state (for restoration after restart)
	 */
	importState(state: {
		buffer: MetricDataPoint[];
		stats?: typeof this.stats;
		config?: Partial<BufferConfig>;
	}): void {
		// Clear current buffer
		this.buffer = [];
		
		// Import metrics
		const result = this.add(state.buffer);
		
		// Import stats if provided
		if (state.stats) {
			this.stats = { ...state.stats };
		}
		
		// Import config if provided
		if (state.config) {
			this.config = { ...this.config, ...state.config };
		}
		
		Log.log(
			bufferLogger,
			`📥 Imported buffer state: ${result.added} metrics added, ${result.dropped} dropped`
		);
	}
}