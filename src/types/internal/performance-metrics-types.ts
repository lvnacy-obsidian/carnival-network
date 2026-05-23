/**
 * ============================================================================
 * PERFORMANCE METRICS
 * ============================================================================
 * 
 * Index of exports:
 * - PerformanceMetrics - performance metrics for requests
 * - RequestTiming - timing information for a request
 */

export interface PerformanceMetrics {
	requestCount: number;
	successCount: number;
	failureCount: number;
	averageResponseTime: number;
	minResponseTime: number;
	maxResponseTime: number;
	lastRequestTime?: number;
}

export interface RequestTiming {
	start: number;
	end?: number;
	duration?: number;
	operation: string;
}