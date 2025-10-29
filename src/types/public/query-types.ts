/**
 * ============================================================================
 * QUERIES (Asking Around the Carnival)
 * ============================================================================
 * 
 * Index of exports:
 * - CarnivalQuery - Carnival query structure
 * - QueryResult - Query result
 */

/**
 * Carnival query structure
 */
export interface CarnivalQuery {
	type: 'acts' | 'nodes' | 'status'; // records -> acts
	parameters: Record<string, unknown>;
	timeout?: number;
}

/**
 * Query result
 */
export interface QueryResult {
	success: boolean;
	territory: string;
	nodeId: string;
	data: unknown;
	timestamp: string;
	error?: string;
}