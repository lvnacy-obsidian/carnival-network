import type { ExternalClient } from './carnival-client-types';
import type { TLSConfig } from './carnival-configuration-types';

/**
 * ============================================================================
 * REQUEST TYPES
 * ============================================================================
 * 
 * Index of exports:
 * - APIRequest - Base request structure from Local REST API plugin
 * - AuthenticatedRequest - Authenticated request with client context
 * - AuthenticationRequestBody - Authentication request body
 * - ActCreateRequestBody - Record creation request body
 * - FetchOptions
 * - SearchRequestOptions
 */

/**
 * Base request structure from Local REST API plugin
 */
export interface APIRequest {
	headers: Record<string, string>;
	query: Record<string, string | string[]>;
	body: unknown;
	rawBody?: string;
	method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
	path: string;
}

/**
 * Authenticated request with client context
 */
export interface AuthenticatedRequest extends APIRequest {
	client: ExternalClient;
}

/**
 * Authentication request body
 */
export interface AuthenticationRequestBody {
	apiKey: string;
	clientType: 'discord' | 'webhook' | 'external';
}

/**
 * Record creation request body
 */
export interface ActCreateRequestBody {
	territory: string;
	type: 'changelog' | 'conversation';
	title: string;
	content?: string;
	metadata?: Record<string, unknown>;
}

export type FetchOptions = RequestInit & { 
	timeoutMs?: number; 
	tlsConfig?: TLSConfig;
};

/**
 * Search request body
 */
export interface SearchRequestBody {
	query: string;
	territories?: string[];
	types?: Array<'changelog' | 'conversation'>;
	limit?: number;
}