/**
 * ============================================================================
 * RATE LIMITER
 * ============================================================================
 * 
 * Index of exports:
 * - RateLimitBucket - structure for a rate limit bucket
 * - RateLimitStatus - structure for rate limit status
 */

export interface RateLimitBucket {
	tokens: number;
	lastRefill: number;
	capacity: number;
	refillRate: number;
}

export interface RateLimitStatus {
	allowed: boolean;
	remainingTokens: number;
	resetTime?: number;
	retryAfter?: number;
}