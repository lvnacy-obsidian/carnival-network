/**
 * ============================================================================
 * ERROR TYPES
 * ============================================================================
 * 
 * Index of exports:
 * - NetworkErrorType - types of network errors
 * - NetworkError - structure for network error
 * - ValidationError - structure for validation error
 */

export type NetworkErrorType =
	| 'CONNECTION_ERROR'
	| 'TIMEOUT_ERROR'
	| 'AUTHENTICATION_ERROR'
	| 'AUTHORIZATION_ERROR'
	| 'VALIDATION_ERROR'
	| 'RATE_LIMIT_ERROR'
	| 'SERVICE_UNAVAILABLE'
	| 'NOT_FOUND'
	| 'INTERNAL_ERROR';

export interface NetworkError {
	type: NetworkErrorType;
	message: string;
	code: string;
	details?: Record<string, unknown>;
	timestamp: string;
	recoverable: boolean;
}

export interface ValidationError {
	field: string;
	message: string;
	code: string;
}

/**
 * Validation error field map
 */
export type ValidationErrors = Record<string, string>;