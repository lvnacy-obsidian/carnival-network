/**
 * ============================================================================
 * NETWORK OPERATIONS
 * ============================================================================
 * 
 * Index of exports:
 * - BroadcastResult - Broadcast result
 * - NetworkRequestResponse - Network request response
 */

/**
 * Broadcast result
 */
export interface BroadcastResult {
	performerId: string;
	territory: string;
	success: boolean;
	acknowledged?: boolean;
	timestamp: string;
	error?: string;
}

/**
 * Network request response
 */
export interface NetworkRequestResponse {
	ok: boolean;
	status: number;
	data?: unknown;
	error?: string;
}