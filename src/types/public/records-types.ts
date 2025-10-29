/**
 * ============================================================================
 * RECORDS (The Acts)
 * ============================================================================
 * 
 * Index of exports:
 * - ActCountOptions - Act count options
 * - ActQueryOptions - Act query options
 * - ActSyncPreferences - Act synchronization preferences
 * - CarnivalRecord - Structure of a carnival record (an act in the show)
 * - CreateActParams - Parameters for creating a new act
 */

/**
 * Act count options
 */
export interface ActCountOptions {
	territory?: string;
	type?: string;
	status?: 'active' | 'archived' | 'cancelled';
}

/**
 * Act query options
 */
export interface ActQueryOptions {
	territory?: string;
	type?: string;
	limit: number;
	offset: number;
	sortBy?: 'createdAt' | 'updatedAt' | 'title';
	sortOrder?: 'asc' | 'desc';
}

/**
 * Act synchronization preferences
 */
export interface ActSyncPreferences {
	requireAck: boolean;
	broadcastToAll: boolean;
	targetTerritories?: string[];
}

/**
 * Carnival record structure (an act in the show)
 */
export interface CarnivalRecord {
	id: string;
	title: string;
	territory: string;
	actType: string; // formerly recordType
	content: string;
	metadata: Record<string, unknown>;
	createdAt: string;
	updatedAt?: string;
	status: 'active' | 'archived' | 'cancelled'; // cancelled instead of deleted
	syncPreferences: ActSyncPreferences;
}

/**
 * Parameters for creating a new act
 */
export interface CreateActParams {
	title: string;
	territory: string;
	actType: string;
	content: string;
	metadata?: Record<string, unknown>;
}