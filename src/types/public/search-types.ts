/**
 * ============================================================================
 * SEARCH
 * ============================================================================
 * 
 * Index of exports:
 * - SearchOptions - options for performing a search
 * - SearchResult - structure of a search result
 */

/**
 * Search options
 */
export interface SearchOptions {
	query: string;
	territories: string[];
	limit: number;
	offset?: number;
	filters?: SearchFilters;
}

export interface SearchFilters {
	actTypes?: string[];
	dateRange?: {
		start: string;
		end: string;
	};
	metadata?: Record<string, unknown>;
}

/**
 * Search result
 */
export interface SearchResult {
	id: string;
	title: string;
	type: string;
	territory: string;
	content: string;
	matchedFields: string[];
	relevance?: number;
	lastSeen?: string;
	metadata?: Record<string, unknown>;
}