/**
 * ============================================================================
 * HTTP CLIENT
 * ============================================================================
 * 
 * Index of exports:
 * - HTTPRequestOptions - Options for making an HTTP request
 * - HTTPResponse - Structure of an HTTP response
 * - TLSConfig - TLS configuration options
 */

export interface HTTPRequestOptions {
	method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
	headers?: Record<string, string>;
	body?: unknown;
	timeoutMs?: number;
	tlsConfig?: TLSConfig;
}

export interface HTTPResponse {
	ok: boolean;
	status: number;
	statusText: string;
	headers: Record<string, string>;
	data?: unknown;
}

export interface TLSConfig {
	verifyCertificates: boolean;
	allowSelfSigned: boolean;
	certificateAuthorities?: string[];
}