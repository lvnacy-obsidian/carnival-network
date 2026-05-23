/**
 * ============================================================================
 * REQUEST TYPES
 * ============================================================================
 * 
 * Index of exports:
 * - ActCreateRequestBody - Act creation request body
 * - APIRequest - Base request structure from Local REST API plugin
 * - AuthenticatedRequest - Authenticated request with client context
 * - AuthenticationRequestBody - Authentication request body
 * - FetchOptions
 * - SearchRequestOptions
 */

import type { GuestPerformer } from './carnival-performer-types';
import type { TLSConfig } from './carnival-configuration-types';

/**
 * Act creation request body
 */
export interface ActCreateRequestBody {
	territory: string;
	type: 'changelog' | 'conversation';
	title: string;
	content?: string;
	metadata?: Record<string, unknown>;

	// Optional sync preferences
	requireAck?: boolean;
	broadcastToAll?: boolean;
	targetTerritories?: string[];

	// API-only flag — controls whether to broadcast after creation (default true)
	broadcast?: boolean;
}

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
	client: GuestPerformer;
}

/**
 * Authentication request body
 */
export interface AuthenticationRequestBody {
	apiKey: string;
	clientType: 'discord' | 'webhook' | 'external';
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