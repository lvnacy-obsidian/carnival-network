/**
 * ============================================================================
 * 🎪 CARNIVAL CONFIGURATION
 * ============================================================================
 * 
 * This module defines the configuration interfaces for the Carnival Network client.
 * 
 * Index of exports:
 * - APIKeyConfig - API key configuration options
 * - CarnivalConfig - Carnival network configuration options
 * - CarnivalNetworkSettings
 * - RateLimitConfig - Rate limiting settings
 * - TLSConfig - TLS/Security settings
 * - WebhookConfig - Webhook settings
 * - WebhookHandlerConfig - Individual webhook handler configuration
 * 
 * @module carnival-configuration-types
 * @category Types/Public
 * @carnival-enhanced 🎪✨
 */

import type { ObservabilityConfig } from './observability-types';
import type {
	BackstageAccess,
	PerformerTitle,
	TicketTier
} from './authentication-types';

/**
 * 🔑 APIKeyConfig (Legacy - Kept for backwards compatibility)
 * 
 * NOTE: This is the OLD api key config structure. The new authentication
 * system uses BackstagePass instead! This is kept for backwards compatibility
 * with existing code, but NEW code should use AuthenticationConfig. 🎭
 */
export interface APIKeyConfig {
	enabled: boolean;
	permissions: string[];
	sessionDuration?: number;  // hours
	rateLimits?: { [operation: string]: number };
	allowedTypes?: string[];
	description?: string;
}

/**
 * 🎪 AuthenticationConfig - Carnival credential system settings! 🔐
 * 
 * Carnival metaphor: The credential booth's operating procedures!
 * Configure how backstage passes are issued, how performance tickets work,
 * and what security measures are in place. 🎭
 * 
 * Key Features:
 * - 🎫 Backstage pass management (API keys)
 * - 🎟️ Performance ticket issuance (JWT)
 * - 🎪 Rate limiting per performer type
 * - 🎯 Token scoping for fine-grained access
 * - 📢 Webhook signature verification
 * - 🔄 Refresh token support
 * - 📊 Audit logging
 * 
 * @example
 * ```typescript
 * const authConfig: AuthenticationConfig = {
 *   enabled: true,
 *   requireCredentials: true,
 *   allowedMethods: ['backstagePass', 'performanceTicket'],
 *   jwtExpirationHours: 24,
 *   rateLimitEnabled: true,
 *   webhookSignaturesEnabled: true,
 *   oauth: {
 *     enableScoping: true,
 *     enableRefreshTokens: true
 *   }
 * };
 * ```
 */
export interface AuthenticationConfig {
	/** 🎪 Master toggle - enable the entire authentication system */
	enabled: boolean;
	
	/** 🚪 Require credentials for all API endpoints (except public ones) */
	requireCredentials: boolean;
	
	/** 🎭 Which authentication methods to allow */
	allowedMethods: Array<'backstagePass' | 'performanceTicket' | 'stageDoor'>;
	
	/** 🔐 JWT signing secret (auto-generated if not provided, stored in Secure Store) */
	jwtSecret?: string;
	
	/** ⏰ Default JWT expiration in hours (default: 24) */
	jwtExpirationHours?: number;
	
	/** 🎫 Enable rate limiting per performer type (uses ticket tiers) */
	rateLimitEnabled?: boolean;
	
	/** 🎟️ Custom ticket tiers (overrides DEFAULT_TICKET_TIERS) */
	customTicketTiers?: Partial<Record<PerformerTitle, TicketTier>>;
	
	/** 📢 Enable webhook signature verification (HMAC-SHA256) */
	webhookSignaturesEnabled?: boolean;
	
	/** 🎯 OAuth-style features (scoping, refresh tokens) */
	oauth?: {
		/** 🗺️ Enable token scoping (territory/act type/operation restrictions) */
		enableScoping?: boolean;
		
		/** 🔄 Enable refresh tokens (session extension) */
		enableRefreshTokens?: boolean;
		
		/** 📅 Refresh token TTL in days (default: 30) */
		refreshTokenTTLDays?: number;
		
		/** 🔢 Max uses per refresh token (undefined = unlimited) */
		maxRefreshTokenUses?: number;
	};
	
	/** 📊 Audit logging configuration */
	auditLog?: {
		/** ✅ Enable audit logging */
		enabled: boolean;
		
		/** 🎉 Log successful authentications (can be noisy, default: false) */
		logSuccess?: boolean;
		
		/** ❌ Log failed authentication attempts (default: true) */
		logFailures?: boolean;
		
		/** 🔑 Log credential changes (creation, revocation) (default: true) */
		logCredentialChanges?: boolean;
		
		/** 📂 Storage location (default: .carnival/auth-audit.log) */
		logPath?: string;
		
		/** 📏 Max log file size before rotation in MB (default: 10) */
		maxLogSizeMB?: number;
		
		/** 🗄️ Number of rotated log files to keep (default: 5) */
		maxRotatedFiles?: number;
	};
	
	/** 🎭 Default permissions for initial impresario (created on first run) */
	initialImpresarioPermissions?: BackstageAccess[];
	
	/** 🚨 Security settings */
	security?: {
		/** 🔒 Require HTTPS for API endpoints (default: true in production) */
		requireHttps?: boolean;
		
		/** 🔑 Minimum backstage pass key entropy (default: 256 bits) */
		minKeyEntropy?: number;
		
		/** ⏱️ Failed auth attempt rate limit (default: 5 per minute) */
		failedAuthRateLimit?: number;
		
		/** ⏸️ Lockout duration after too many failed attempts (default: 15 minutes) */
		lockoutDurationMinutes?: number;
	};
}

/**
 * 🎪 CarnivalConfig - EXTENDED with authentication! ⚙️
 * 
 * The master configuration for the entire Carnival Network plugin,
 * now featuring the credential booth! 🎭
 */
export interface CarnivalConfig {
	// 🔗 Connection settings
	maxRetries: number;
	retryBaseDelayMs: number;
	communicationTimeout: number;
	heartbeatInterval: number;

	// 🎪 Circuit breaker settings (the safety net!)
	circuitBreakerThreshold: number;
	circuitBreakerTimeout: number;
	circuitBreakerResetTimeout: number;

	// 📜 Cache settings (the program)
	performerCacheTTL: number;
	maxCachedPerformers: number;

	// 🔐 TLS/Security settings (backstage passes)
	tlsConfig?: TLSConfig;
	
	// 🎫 Rate limiting (crowd control)
	rateLimitConfig?: RateLimitConfig;

	// 📢 Webhook settings (announcement system)
	webhookConfig?: WebhookConfig;

	// 📊 Optional observability configuration (metrics + webhook export)
	observability?: ObservabilityConfig;

	// 🎪✨ AUTHENTICATION SYSTEM - THE CREDENTIAL BOOTH! ✨🎭
	/** 🎫 Authentication and authorization configuration (backstage passes, performance tickets) */
	authentication?: AuthenticationConfig;

	/**
	 * Territory configuration
	 * Minimal config only - actual territory data stored in caches
	 * 
	 * @default { defaultTerritory: 'general' }
	 */
	territoryConfig?: {
		/** Default territory for new performers */
		defaultTerritory: string;
	};
}

export interface CarnivalNetworkSettings {
	enableDebugLogging: boolean;
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