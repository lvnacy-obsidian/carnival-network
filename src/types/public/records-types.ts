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
 * - RecordMetadata - Metadata associated with a record
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
 * HTTP-based
 */
export interface ActSyncPreferences {
	/** Require acknowledgment from targets */
	requireAck: boolean;
	/** Broadcast to all connected territories */
	broadcastToAll: boolean;
	/** Specific target territories */
	targetTerritories?: string[];
	/** Legacy fields for compatibility */
	replicate?: boolean;
	notify?: boolean;
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
	metadata: RecordMetadata;
	createdAt: string;
	updatedAt?: string;
	status: 'active' | 'archived' | 'cancelled'; // cancelled instead of deleted
	syncPreferences: ActSyncPreferences;
	/** Legacy field mapping */
	type?: 'changelog' | 'conversation' | 'status';
	sourceVault?: string;
	targetVaults?: string[];
}

/**
 * Parameters for creating a new act
 */
export interface CreateActParams {
	id?: string,
	title: string;
	territory: string;
	actType: string;
	content: string;
	createdAt: Date;
	status: string;
	syncPreferences: object;
	metadata?: Record<string, unknown>;
}

export interface RecordMetadata {
	/** Legacy fields */
	created?: string;
	sessionId?: string;
	impactScore?: number;
	aiContributionLevel?: string;
	ecosystemImpact?: string;
	projectContext?: string;
	/** HTTP-specific fields */
	createdBy?: string;
	createdVia?: string;
	/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
	[key: string]: any;
}