/**
 * ============================================================================
 * SEARCH
 * ============================================================================
 * 
 * Index of exports:
 * - SearchFilters
 * - SearchOptions - options for performing a search
 * - SearchResponse - Search response data
 * - SearchResult - structure of a search result
 */

export interface SearchFilters {
	actTypes?: string[];
	dateRange?: {
		start: string;
		end: string;
	};
	metadata?: Record<string, unknown>;
}

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

/**
 * Search response data (API endpoint format)
 */
export interface SearchResponse {
  query: string;
  results: SearchResult[];
  resultCount: number;
  hasMore: boolean;
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