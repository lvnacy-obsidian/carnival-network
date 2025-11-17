/**
 * ============================================================================
 * API RESPONSE TYPES
 * ============================================================================
 * 
 * Index of exports:
 * - ActCreateData - Act creation response data
 * - APIResponse - Generic API response wrapper
 * - PaginationMeta - Pagination metadata
 */

/**
 * Generic API response wrapper for all external API endpoints
 */
export interface APIResponse<T = unknown> {
  status: 'success' | 'error';
  data?: T;
  error?: string;
  message?: string;
  details?: Record<string, unknown>;
  timestamp: string;
}

/**
 * Pagination metadata for paginated responses
 */
export interface PaginationMeta {
  limit: number;
  offset: number;
  total: number;
  hasNext: boolean;
  hasPrevious: boolean;
}