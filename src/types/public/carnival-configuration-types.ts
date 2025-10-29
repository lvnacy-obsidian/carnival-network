/**
 * ============================================================================
 * CONFIGURATION
 * ============================================================================
 * 
 * This module defines the configuration interfaces for the Carnival Network client.
 * 
 * Index of exports:
 * - CarnivalConfiguration - Carnival network configuration options
 * - RateLimitConfiguration - Rate limiting settings
 * - TLSConfiguration - TLS/Security settings
 * - WebhookConfiguration - Webhook settings
 * - WebhookHandlerConfig - Individual webhook handler configuration
 */

export interface CarnivalConfiguration {
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
	nodeCacheTTL: number;
	maxCachedNodes: number;

	// TLS/Security settings (backstage passes)
	tlsConfig?: TLSConfiguration;
	
	// Rate limiting (crowd control)
	rateLimitConfig?: RateLimitConfiguration;

	// Webhook settings (announcement system)
	webhookConfig?: WebhookConfiguration;
}

export interface RateLimitConfiguration {
	maxRequestsPerMinute: number;
	maxRequestsPerHour: number;
	burstLimit: number;
}

export interface TLSConfiguration {
	enabled: boolean;
	verifyCertificates: boolean;
	allowSelfSigned: boolean;
	certificateAuthorities?: string[];
}

export interface WebhookConfiguration {
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