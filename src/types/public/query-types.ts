/**
 * ============================================================================
 * QUERIES (Asking Around the Carnival)
 * ============================================================================
 * 
 * Index of exports:
 * - ActQueryParams - Record/"Act" query parameters
 * - AnalyticsQueryParams - Analytics query parameters
 * - CarnivalQuery - Carnival query structure
 * - QueryResult - Query result
 */

/**
 * Record/"Act" query parameters
 */
export interface ActQueryParams {
	territory?: string;
	type?: 'changelog' | 'conversation';
	limit?: number;
	offset?: number;
}

/**
 * Analytics query parameters
 */
export interface AnalyticsQueryParams {
	timeframe?: string;  // e.g., '7d', '30d', '24h'
	metrics?: Array<'records' | 'activity' | 'capabilities' | 'performance'>;
}

/**
 * Carnival query structure
 */
export interface CarnivalQuery {
	type: 'acts' | 'performers' | 'status'; // records -> acts
	parameters: Record<string, unknown>;
	timeout?: number;
}

/**
 * Query result
 */
export interface QueryResult {
	success: boolean;
	territory: string;
	performerId: string;
	data: unknown;
	timestamp: string;
	error?: string;
}