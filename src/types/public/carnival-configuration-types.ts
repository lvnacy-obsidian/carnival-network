/**
 * ============================================================================
 * CONFIGURATION
 * ============================================================================
 * 
 * This module defines the configuration interfaces for the Carnival Network client.
 * 
 * Index of exports:
 * - APIKeyConfig - API key configuration options
 * - CarnivalConfig - Carnival network configuration options
 * - RateLimitConfig - Rate limiting settings
 * - TLSConfig - TLS/Security settings
 * - WebhookConfig - Webhook settings
 * - WebhookHandlerConfig - Individual webhook handler configuration
 */

import type { ObservabilityConfig } from './observability-types';

export interface APIKeyConfig {
	enabled: boolean;
	permissions: string[];
	sessionDuration?: number;  // hours
	rateLimits?: { [operation: string]: number };
	allowedTypes?: string[];
	description?: string;
}

export interface CarnivalConfig {
	// Connection settings
	maxRetries: number;
	retryBaseDelayMs: number;
	communicationTimeout: number;
	heartbeatInterval: number;

	// Circuit breaker settings (the safety net!)
	circuitBreakerThreshold: number;
	circuitBreakerTimeout: number;
	circuitBreakerResetTimeout: number;

	// Cache settings (the program)
	performerCacheTTL: number;
	maxCachedPerformers: number;

	// TLS/Security settings (backstage passes)
	tlsConfig?: TLSConfig;
	
	// Rate limiting (crowd control)
	rateLimitConfig?: RateLimitConfig;

	// Webhook settings (announcement system)
	webhookConfig?: WebhookConfig;

	// Optional: initial list of registry endpoints (seeded at startup).
	// Managed at runtime by `HttpRegistryService.updateRegistryEndpoints`.
	// Treat as read-only from consumers; the registry service is the authoritative
	// source for endpoint updates at runtime.
	readonly registryEndpoints?: readonly string[];

	// Optional observability configuration (metrics + webhook export)
	observability?: ObservabilityConfig;
}

export interface RateLimitConfig {
	maxRequestsPerMinute: number;
	maxRequestsPerHour: number;
	burstLimit: number;
}

export interface TLSConfig {
	/** Enable TLS (default true for HTTPS endpoints) */
	enabled?: boolean;
	/** Path to CA certificate for validation (optional) */
	caCertPath?: string;
	/** CA certificate content (alternative to path) */
	caCertContent?: string;
	/** Path to client certificate for mTLS (optional) */
	clientCertPath?: string;
	/** Client certificate content (alternative to path) */
	clientCertContent?: string;
	/** Path to client private key for mTLS (optional) */
	clientKeyPath?: string;
	/** Client private key content (alternative to path) */
	clientKeyContent?: string;
	/** Allow self-signed certificates (default false) */
	allowSelfSigned?: boolean;
	/** Enforce certificate validation (default true) */
	validateCert?: boolean;
	/** Custom server name for SNI (optional) */
	serverName?: string;
}

export interface WebhookConfig {
	enabled: boolean;
	handlers: WebhookHandlerConfig[];
}

export interface WebhookHandlerConfig {
	id: string;
	type: 'discord' | 'slack' | 'custom';
	url: string;
	secret?: string;
	enabled: boolean;
}