/**
 * ============================================================================
 * RECORDS (The Acts)
 * ============================================================================
 * 
 * Index of exports:
 * - ActCountOptions - Act count options
 * - ActCreateData - Act creation response data
 * - ActQueryOptions - Act query options
 * - ActSyncPreferences - Act synchronization preferences
 * - CarnivalAct - Structure of a carnival record (an act in the show)
 * - CreateActParams - Parameters for creating a new act
 * - ExtendedActQueryOptions
 * - PaginatedActResult
 * - RecordMetadata - Metadata associated with a record
 */

import { ActQueryParams } from './query-types';

/**
 * Act count options
 */
export interface ActCountOptions {
	territory?: string;
	type?: string;
	status?: 'active' | 'archived' | 'cancelled';
}

/**
 * Act creation response data (API endpoint format)
 */
export interface ActCreateData {
  id: string;
  title: string;
  territory: string;
  createdAt: string;
}

export interface ActMetadata {
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

export interface ActQueryOptions extends Omit<ActQueryParams, 'type'> {
	type?: string; // Broader than ActQueryParams
	limit: number;  // Make required
	offset: number; // Make required
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
export interface CarnivalAct {
	id: string;
	title: string;
	territory: string;
	actType: string;
	content: string;
	metadata: ActMetadata;
	createdAt: string;
	updatedAt?: string;
	status: 'active' | 'archived' | 'cancelled';
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

/**
 * Extended act query options with advanced filtering and pagination
 */
export interface ExtendedActQueryOptions extends Omit<ActQueryOptions, 'sortBy'> {
	// Additional filtering
	performerId?: string;
	dateRange?: {
		start: string;
		end: string;
	};
	status?: 'active' | 'archived' | 'cancelled';
	capabilities?: string[];
	
	// Page-based pagination (in addition to offset/limit)
	page?: number;
	pageSize?: number;
	
	// Extended sorting options
	sortBy?: 'createdAt' | 'updatedAt' | 'title' | 'territory';
}

/**
 * Paginated act query result
 */
export interface PaginatedActResult {
	acts: CarnivalAct[];
	pagination: {
		currentPage: number;
		pageSize: number;
		totalItems: number;
		totalPages: number;
		hasNext: boolean;
		hasPrevious: boolean;
	};
}