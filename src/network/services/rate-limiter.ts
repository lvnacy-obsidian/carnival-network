import { RateLimitError } from '../../errors';
import { Log } from '../../utils/logger';
import type {
	GuestPerformer,
	RateLimit
} from '../../types/public';

const rateLimiterLogger = {
	context: 'Rate Limiter',
	path: '/.obsidian/plugins/carnival-records/network/services/rate-limiter'
};

/**
 * Manages rate limiting for external API clients
 */
export class RateLimiterService {
	private rateLimits: Map<string, RateLimit> = new Map();
	private cleanupInterval?: NodeJS.Timeout;

	constructor() {
		this.startCleanupTimer();
	}

	/**
	 * Check if client is within rate limit for operation
	 * 
	 * @param client - Authenticated client
	 * @param operation - Operation being performed
	 * @returns true if within limit, false if exceeded
	 */
	checkLimit(client: GuestPerformer, operation: string): boolean {
		try {
			const key = `${client.id}:${operation}`;
			let limit = this.rateLimits.get(key);
			
			const now = Date.now();
			const hourInMs = 60 * 60 * 1000;
			
			if (!limit) {
				// Create new rate limit entry
				limit = {
					clientId: client.id,
					operation,
					requestCount: 0,
					windowStart: now,
					windowEnd: now + hourInMs,
					maxRequests: client.rateLimits[operation] ?? 10
				};
				this.rateLimits.set(key, limit);
			}
			
			// Check if window has expired
			if (now > limit.windowEnd) {
				// Reset window
				limit.requestCount = 0;
				limit.windowStart = now;
				limit.windowEnd = now + hourInMs;
			}
			
			// Check if client is within rate limit
			if (limit.requestCount >= limit.maxRequests) {
				Log.warn(rateLimiterLogger, 
					`Rate limit exceeded for ${client.id} on ${operation}: ${limit.requestCount}/${limit.maxRequests}`
				);
				return false;
			}
			
			// Increment counter
			limit.requestCount++;
			this.rateLimits.set(key, limit);
			
			return true;
			
		} catch (error) {
			Log.error(rateLimiterLogger, 'Rate limit check failed:', error);
			// Fail open - allow request if rate limiting fails
			return true;
		}
	}

	/**
	 * Require rate limit check - throws if exceeded
	 */
	requireLimit(client: GuestPerformer, operation: string): void {
		if (!this.checkLimit(client, operation)) {
			const limit = this.getRateLimit(client.id, operation);
			throw new RateLimitError(
				`Rate limit exceeded for ${operation}`,
				3600, // retry after 1 hour
				limit?.maxRequests
			);
		}
	}

	/**
	 * Get current rate limit status for client operation
	 */
	getRateLimit(clientId: string, operation: string): RateLimit | undefined {
		const key = `${clientId}:${operation}`;
		return this.rateLimits.get(key);
	}

	/**
	 * Get remaining requests for client operation
	 */
	getRemainingRequests(clientId: string, operation: string): number {
		const limit = this.getRateLimit(clientId, operation);
		if (!limit) {
			return Infinity;
		}
		
		const now = Date.now();
		if (now > limit.windowEnd) {
			return limit.maxRequests; // Window expired, full limit available
		}
		
		return Math.max(0, limit.maxRequests - limit.requestCount);
	}

	/**
	 * Clean up rate limits for a specific client
	 */
	cleanupClient(clientId: string): void {
		const keysToDelete: string[] = [];
		for (const [key, limit] of this.rateLimits.entries()) {
			if (limit.clientId === clientId) {
				keysToDelete.push(key);
			}
		}
		
		for (const key of keysToDelete) {
			this.rateLimits.delete(key);
		}
	}

	/**
	 * Clean up expired rate limit windows
	 */
	cleanup(): void {
		const now = Date.now();
		const entriesToDelete: string[] = [];
		
		for (const [key, limit] of this.rateLimits.entries()) {
			if (now > limit.windowEnd + (60 * 60 * 1000)) { // 1 hour after window end
				entriesToDelete.push(key);
			}
		}
		
		for (const key of entriesToDelete) {
			this.rateLimits.delete(key);
		}
		
		if (entriesToDelete.length > 0) {
			Log.log(rateLimiterLogger, 
				`🧹 Cleaned up ${entriesToDelete.length} expired rate limit entries`
			);
		}
	}

	private startCleanupTimer(): void {
		this.cleanupInterval = setInterval(() => {
			this.cleanup();
		}, 5 * 60 * 1000); // Every 5 minutes
	}

	destroy(): void {
		if (this.cleanupInterval) {
			clearInterval(this.cleanupInterval);
		}
		this.rateLimits.clear();
		Log.log(rateLimiterLogger, '🧹 Rate limiter destroyed');
	}
}