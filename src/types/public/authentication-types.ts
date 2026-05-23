/**
 * ============================================================================
 * 🎪 CARNIVAL AUTHENTICATION TYPES 🎭
 * ============================================================================
 * 
 * The carnival's credential system - backstage passes, performance tickets,
 * and access rights for all performers in the grand show! 🎟️
 * 
 * This module provides the foundation for secure, flexible, and
 * carnival-themed authentication and authorization throughout the
 * Carnival Network plugin! 🎭
 * 
 * Key Features:
 * - 🔑 Backstage passes (API keys) for long-lived access
 * - 🎟️ Performance tickets (JWT) for session-based access
 * - 🎪 Five performer types with different privileges
 * - 🎯 Token scoping for fine-grained access control
 * - 📢 Webhook signature verification
 * - 🔄 Refresh tokens for session extension
 * - 🎫 Rate limiting with ticket tiers
 * - 🔐 Integrated with Secure Store for encryption
 * - 📱 Desktop + mobile (iOS/Android) support
 * 
 * "Step right up to the carnival! Present your backstage pass at the gate,
 * enjoy the performance within your ticket tier limits, and remember -
 * the impresario sees all from the observation tower!" 🎪✨
 * 
 * 🎯 Core Concepts:
 * - Backstage passes (API keys) grant long-term access 🎫
 * - Performance tickets (JWT) are time-limited session tokens ⏰
 * - Performers have different roles and privileges 🎪
 * - Ticket tiers determine how often you can perform 🎭
 * - Scoped credentials restrict access to specific acts 🎬
 * 
 * 🏗️ Architecture:
 * This module defines the authentication types used throughout the carnival
 * network. It integrates with:
 * - Secure Store (secure-store) for encrypted credential storage 🔐
 * - Rate Limiter types for ticket booth operations 🎟️
 * - Configuration types for authentication settings ⚙️
 * 
 * 📦 Index of exports:
 * - BackstageAccess - Permission types (what acts you can access) 🎭
 * - BackstagePass - API key configuration (long-lived credentials) 🔑
 * - CARNIVAL_AUTH_CONSTANTS
 * - CreateBackstagePassConfig - API key creation options ✨
 * - CredentialContext - Authentication context (passed to handlers) 📋
 * - DEFAULT_TICKET_TIERS
 * - PerformanceTicket - JWT payload (session tokens) ⏱️
 * - PerformerTitle - Role types (what kind of performer you are) 🎪
 * - RefreshToken - Refresh token for session extension 🔄
 * - SignedWebhookPayload - Webhook payload with signature 📜
 * - TicketTier - Rate limit tiers (how often you can perform) 🎫
 * - TokenScope - OAuth2.0-style scopes for fine-grained access 🎯
 * - WebhookSignature - HMAC signature for webhook verification 📢
 * 
 * @module authentication-types
 * @category Types/Public
 * @carnival-themed 🎪
 */

/**
 * 🎭 BackstageAccess - What acts you can participate in
 * 
 * Carnival metaphor: Different colored wristbands grant access to different
 * areas of the carnival. Some performers can only watch, others can perform,
 * and impresarios can manage the entire show! 🎪
 * 
 * Permission Hierarchy:
 * - 🎬 Acts: read → create → broadcast → delete
 * - 🔍 Search: execute (archive searching)
 * - 📊 Carnival: status (network health)
 * - 🗺️ Territories: list → create
 * - 📈 Analytics: read (performance metrics)
 * - 📢 Webhooks: receive → register
 * - 🔑 Credentials: manage (backstage pass administration)
 * - 👑 Impresario: all (full access to everything)
 * 
 * @example
 * ```typescript
 * const trouper: BackstageAccess[] = ['acts:read', 'acts:create'];
 * const spectator: BackstageAccess[] = ['acts:read', 'search:execute'];
 * const impresario: BackstageAccess[] = ['impresario:all'];
 * ```
 */
export type BackstageAccess = 
	| 'acts:read'           // 🎬 Watch acts being performed
	| 'acts:create'         // ✨ Create new acts
	| 'acts:broadcast'      // 📡 Broadcast acts to the network
	| 'acts:delete'         // 🗑️ Remove acts (cleanup crew)
	| 'search:execute'      // 🔍 Search through the archives
	| 'carnival:status'     // 📊 View the carnival's health
	| 'territories:list'    // 🗺️ See all carnival grounds
	| 'territories:create'  // 🏗️ Establish new territories
	| 'analytics:read'      // 📈 View performance metrics
	| 'webhooks:receive'    // 📥 Receive announcements
	| 'webhooks:register'   // 📢 Register new announcement channels
	| 'credentials:manage'  // 🔑 Issue backstage passes (impresario only)
	| 'impresario:all';     // 👑 Full access (carnival manager)

/**
 * 🎫 BackstagePass - Long-lived API key credential
 * 
 * Carnival metaphor: A laminated backstage pass that performers wear around
 * their neck. Shows your name, role, and what areas you can access! 🔑
 * 
 * Lifecycle:
 * 1. ✨ Issued by impresario via settings UI or API
 * 2. 🔐 Stored encrypted in Secure Store (AES-256-GCM)
 * 3. ✅ Validated on every request
 * 4. 📊 Last used timestamp tracked
 * 5. ❌ Revoked when no longer needed
 * 
 * Format:
 * - Key: `carnival_sk_<43_chars_base64url>`
 * - Example: `carnival_sk_k7L9mN3pQ5rT8vW2xY4zA6bC1dE9fG`
 * 
 * @example
 * ```typescript
 * const pass: BackstagePass = {
 *   id: 'pass_abc123',
 *   key: 'carnival_sk_...',
 *   name: 'GitHub Integration',
 *   performerTitle: 'announcer',
 *   backstageAccess: ['acts:create', 'webhooks:receive'],
 *   scope: { territories: ['github-events'] },
 *   createdAt: '2025-01-18T10:00:00Z'
 * };
 * ```
 */
export interface BackstagePass {
	/** 🆔 Unique pass ID (pass_*) */
	id: string;
	/** 🔑 The actual credential (carnival_sk_...) - shown only once! */
	key: string;
	/** 📝 Human-readable name */
	name: string;
	/** 🎪 Performer role */
	performerTitle: PerformerTitle;
	/** 🎭 Access rights */
	backstageAccess: BackstageAccess[];
	/** 🎯 Optional fine-grained scoping */
	scope?: TokenScope;
	/** 📅 When pass was issued */
	createdAt: string;
	/** 🕐 Last time pass was used (updated on each request) */
	lastUsedAt?: string;
	/** ⏰ Optional expiration (if not set, never expires) */
	expiresAt?: string;
	/** ❌ If pass was revoked (timestamp of revocation) */
	revokedAt?: string;
	/** 📎 Custom metadata (for integrations) */
	metadata?: Record<string, unknown>;
}

/**
 * 🎪 Carnival Authentication Constants
 * 
 * Various constants used throughout the authentication system! 🎯
 */
export const CARNIVAL_AUTH_CONSTANTS = {
	/** 🔑 Backstage pass prefix (API keys) */
	BACKSTAGE_PASS_PREFIX: 'carnival_sk_',
	/** 🔄 Refresh token prefix */
	REFRESH_TOKEN_PREFIX: 'carnival_rt_',
	/** 🎟️ Performance ticket prefix (JWT) */
	PERFORMANCE_TICKET_PREFIX: 'Bearer',
	/** 📏 Key length (base64url encoded, 32 bytes = 43 chars) */
	KEY_LENGTH: 43,
	/** ⏰ Default JWT expiration (24 hours) */
	DEFAULT_JWT_EXPIRATION_HOURS: 24,
	/** 🔄 Default refresh token TTL (30 days) */
	DEFAULT_REFRESH_TOKEN_TTL_DAYS: 30,
	/** ⏱️ Webhook timestamp tolerance (5 minutes) */
	WEBHOOK_TIMESTAMP_TOLERANCE_SECONDS: 300,
	/** 🔢 Nonce cache TTL (5 minutes) */
	NONCE_CACHE_TTL_SECONDS: 300,
	/** 📊 Secure Store namespace */
	SECURE_STORE_NAMESPACE: 'carnival-network',
	/** 🗂️ Secure Store keys */
	SECURE_STORE_KEYS: {
		BACKSTAGE_PASSES: 'backstage_passes',
		PERFORMANCE_TICKETS: 'performance_tickets',
		JWT_SECRET: 'jwt_secret',
		REFRESH_TOKENS: 'refresh_tokens',
		WEBHOOK_SECRETS: 'webhook_secrets',
		NONCE_CACHE: 'nonce_cache',
	}
} as const;

/**
 * ✨ CreateBackstagePassConfig - Options for creating new API keys
 * 
 * Carnival metaphor: The application form for a backstage pass! 📝
 * Fill it out and the impresario will issue your credentials.
 * 
 * Validation Rules:
 * - Name: Required, 3-100 characters
 * - PerformerTitle: Required, one of the five types
 * - BackstageAccess: Required, at least one permission
 * - Scope: Optional, for fine-grained restrictions
 * - ExpiresInHours: Optional, if not set, never expires
 * 
 * @example
 * ```typescript
 * const config: CreateBackstagePassConfig = {
 *   name: 'GitHub Webhook Handler',
 *   performerTitle: 'announcer',
 *   backstageAccess: ['acts:create', 'webhooks:receive'],
 *   scope: {
 *     territories: ['github-events'],
 *     actTypes: ['changelog']
 *   },
 *   expiresInHours: 8760, // 1 year
 *   metadata: {
 *     integration: 'github',
 *     repository: 'my-org/my-repo'
 *   }
 * };
 * ```
 */
export interface CreateBackstagePassConfig {
	/** 📝 Human-readable name (e.g., "GitHub Integration") */
	name: string;
	/** 🎪 Performer role */
	performerTitle: PerformerTitle;
	/** 🎭 Access rights to grant */
	backstageAccess: BackstageAccess[];
	/** 🎯 Optional fine-grained scoping */
	scope?: TokenScope;
	/** ⏰ Optional expiration in hours (if not set, never expires) */
	expiresInHours?: number;
	/** 📎 Optional custom metadata */
	metadata?: Record<string, unknown>;
}

/**
 * 📋 CredentialContext - Authentication context passed to handlers
 * 
 * Carnival metaphor: The performer's credentials checked at the gate.
 * Used throughout the request lifecycle to authorize access! 🎪
 * 
 * Usage:
 * - Injected by authentication middleware
 * - Passed to all protected handlers
 * - Used by authorization middleware for permission checks
 * - Used by rate limiter for ticket tier enforcement
 * 
 * @example
 * ```typescript
 * async function handler(req: Request, context: CredentialContext) {
 *   if (!context.authenticated) {
 *     throw new Error('🚫 Backstage pass required!');
 *   }
 *   
 *   if (!context.backstageAccess.includes('acts:create')) {
 *     throw new Error('🎭 Your ticket doesn\'t grant access to this act!');
 *   }
 *   
 *   // Proceed with handler logic
 * }
 * ```
 */
export interface CredentialContext {
	/** ✅ Successfully authenticated? */
	authenticated: boolean;
	/** 🆔 Which backstage pass or ticket was used */
	credentialId?: string;
	/** 🎪 Performer role */
	performerTitle?: PerformerTitle;
	/** 🎭 Access rights */
	backstageAccess: BackstageAccess[];
	/** 👑 Is this an impresario (full admin)? */
	isImpresario: boolean;
	/** 🎯 Optional scoping constraints */
	scope?: TokenScope;
	/** 📎 Custom metadata from credential */
	metadata?: Record<string, unknown>;
	/** 🎫 Rate limit tier for this credential */
	ticketTier?: TicketTier;
}

/**
 * 🎟️ Default ticket tiers for each performer type
 * 
 * These are the carnival's standard admission policies! 🎪
 * Can be overridden in configuration for custom limits.
 * 
 * Tier Breakdown:
 * - 👑 Impresario: Unlimited (runs the show)
 * - ⭐ Headliner: 1000/min, 60k/hr (VIP treatment)
 * - 🎭 Trouper: 60/min, 3600/hr (standard performer)
 * - 👀 Spectator: 30/min, 1000/hr (audience member)
 * - 📢 Announcer: 10/min, 600/hr (broadcaster)
 */
export const DEFAULT_TICKET_TIERS: Record<PerformerTitle, TicketTier> = {
	headliner: {
		performerTitle: 'headliner',
		requestsPerMinute: 1000,
		requestsPerHour: 60000,
		burstAllowance: 100,
		blockDurationSeconds: 0 // ⭐ No blocking for headliners!
	},
	trouper: {
		performerTitle: 'trouper',
		requestsPerMinute: 60,
		requestsPerHour: 3600,
		burstAllowance: 20,
		blockDurationSeconds: 60 // 🎭 1 minute timeout
	},
	spectator: {
		performerTitle: 'spectator',
		requestsPerMinute: 30,
		requestsPerHour: 1000,
		burstAllowance: 10,
		blockDurationSeconds: 300 // 👀 5 minute timeout
	},
	announcer: {
		performerTitle: 'announcer',
		requestsPerMinute: 10,
		requestsPerHour: 600,
		burstAllowance: 5,
		blockDurationSeconds: 600 // 📢 10 minute timeout
	},
	impresario: {
		performerTitle: 'impresario',
		requestsPerMinute: 1000,
		requestsPerHour: 60000,
		burstAllowance: 100,
		blockDurationSeconds: 0 // 👑 No blocking for the boss!
	}
};

/**
 * 🎟️ PerformanceTicket - JWT session token payload
 * 
 * Carnival metaphor: A paper ticket with a time limit. Good for today's
 * performances only, then you need a new ticket tomorrow! ⏱️
 * 
 * JWT Structure:
 * - Header: { alg: 'HS256', typ: 'JWT' }
 * - Payload: PerformanceTicket (this interface)
 * - Signature: HMAC-SHA256 with carnival JWT secret
 * 
 * Lifecycle:
 * 1. ✨ Issued from a backstage pass
 * 2. ⏰ Expires after configured hours (default: 24)
 * 3. 🔄 Can be refreshed with refresh token
 * 4. ❌ Cannot be revoked individually (wait for expiration)
 * 
 * @example
 * ```typescript
 * const ticket: PerformanceTicket = {
 *   sub: 'pass_abc123',
 *   iat: 1705579200,
 *   exp: 1705665600,
 *   backstageAccess: ['acts:read', 'acts:create'],
 *   performerTitle: 'trouper',
 *   jti: 'ticket_xyz789'
 * };
 * ```
 */
export interface PerformanceTicket {
	/** 🎫 Subject - backstage pass ID that issued this ticket */
	sub: string;
	/** 📅 Issued at (Unix timestamp) */
	iat: number;
	/** ⏰ Expiration (Unix timestamp) */
	exp: number;
	/** 🎭 Access rights (copied from backstage pass) */
	backstageAccess: BackstageAccess[];
	/** 🎪 Performer role (copied from backstage pass) */
	performerTitle: PerformerTitle;
	/** 🎯 Optional scoping (copied from backstage pass) */
	scope?: TokenScope;
	/** 🆔 JWT ID (for revocation tracking) */
	jti?: string;
}

/**
 * 🎪 PerformerTitle - Your role in the carnival
 * 
 * Carnival metaphor: Different types of performers have different privileges.
 * Headliners get VIP treatment, spectators watch from the audience! 🎭
 * 
 * Performer Hierarchy (by access level):
 * 1. 👑 Impresario - The carnival manager (full admin)
 * 2. ⭐ Headliner - Star performer (internal, VIP access)
 * 3. 🎭 Trouper - Regular cast member (integrations)
 * 4. 📢 Announcer - Message broadcaster (webhooks)
 * 5. 👀 Spectator - Audience member (read-only)
 * 
 * @example
 * ```typescript
 * const internal: PerformerTitle = 'headliner';  // VIP access
 * const integration: PerformerTitle = 'trouper'; // Regular performer
 * const external: PerformerTitle = 'spectator';  // Observer
 * const webhook: PerformerTitle = 'announcer';   // Broadcaster
 * const admin: PerformerTitle = 'impresario';    // Manager
 * ```
 */
export type PerformerTitle = 
	| 'headliner'    // ⭐ Internal performer - full access, no limits
	| 'trouper'      // 🎭 Regular performer - standard access
	| 'spectator'    // 👀 External observer - read-only
	| 'announcer'    // 📢 Webhook performer - broadcast only
	| 'impresario';  // 👑 Carnival manager - full admin

/**
 * 🔄 RefreshToken - Refresh token for session extension
 * 
 * Carnival metaphor: A special ticket that lets you get a new performance
 * ticket without showing your backstage pass again! 🎟️
 * 
 * Lifecycle:
 * 1. ✨ Issued alongside performance ticket (if enabled)
 * 2. 🔐 Stored in Secure Store with backstage pass ID
 * 3. 🔄 Used to issue new performance tickets
 * 4. ⏰ Expires after 30 days (configurable)
 * 5. ❌ Single-use or limited-use (configurable)
 * 
 * Format:
 * - Token: `carnival_rt_<43_chars_base64url>`
 * - Example: `carnival_rt_x9Y2zA3bC4dE5fG6hI7jK8lM9nO0p`
 * 
 * @example
 * ```typescript
 * const refreshToken: RefreshToken = {
 *   token: 'carnival_rt_...',
 *   backstagePassId: 'pass_abc123',
 *   issuedAt: '2025-01-18T10:00:00Z',
 *   expiresAt: '2025-02-17T10:00:00Z',
 *   usesRemaining: 100
 * };
 * ```
 */
export interface RefreshToken {
	/** 🔄 The refresh token itself (carnival_rt_...) */
	token: string;
	/** 🎫 Backstage pass ID this refresh token belongs to */
	backstagePassId: string;
	/** 📅 When refresh token was issued */
	issuedAt: string;
	/** ⏰ When refresh token expires (default: 30 days) */
	expiresAt: string;
	/** 🔢 Remaining uses (if limited, undefined = unlimited) */
	usesRemaining?: number;
	/** ❌ If refresh token was revoked */
	revokedAt?: string;
}

/**
 * 📜 SignedWebhookPayload - Webhook payload with signature
 * 
 * Carnival metaphor: An official proclamation from the announcer,
 * sealed and timestamped for authenticity! 📢
 * 
 * @example
 * ```typescript
 * const signedPayload: SignedWebhookPayload = {
 *   payload: {
 *     event: 'pull_request',
 *     action: 'opened',
 *     pull_request: { ... }
 *   },
 *   signature: {
 *     algorithm: 'sha256',
 *     signature: 'a1b2c3...',
 *     timestamp: '2025-01-18T10:00:00Z',
 *     nonce: 'xyz789'
 *   }
 * };
 * ```
 */
export interface SignedWebhookPayload {
	/** 📦 Original payload (JSON object) */
	payload: unknown;
	/** 🔐 Signature verification data */
	signature: WebhookSignature;
}

/**
 * 🎫 TicketTier - Rate limit tiers by performer type
 * 
 * Carnival metaphor: Different ticket types allow different numbers of
 * performances. VIP tickets (headliner) have no limits, general admission
 * (spectator) has strict limits! 🎟️
 * 
 * Rate Limit Strategy:
 * - Token bucket algorithm with burst allowance 🪣
 * - Tokens refill continuously over time ⏱️
 * - Burst allowance for sudden spikes 📈
 * - Block duration for exceeded limits ⏸️
 * 
 * @example
 * ```typescript
 * const trouperTier: TicketTier = {
 *   performerTitle: 'trouper',
 *   requestsPerMinute: 60,
 *   requestsPerHour: 3600,
 *   burstAllowance: 20,
 *   blockDurationSeconds: 60
 * };
 * ```
 */
export interface TicketTier {
	/** 🎪 Performer type this tier applies to */
	performerTitle: PerformerTitle;
	/** ⏱️ Maximum requests per minute (sustained rate) */
	requestsPerMinute: number;
	/** 📅 Maximum requests per hour (hourly quota) */
	requestsPerHour: number;
	/** 📈 Burst allowance (extra tokens for spikes) */
	burstAllowance: number;
	/** ⏸️ Block duration in seconds after limit exceeded */
	blockDurationSeconds: number;
}

/**
 * 🎯 TokenScope - OAuth2.0-style scopes for fine-grained access control
 * 
 * Carnival metaphor: Scoped tickets allow access to specific acts or territories.
 * You might have a ticket for the "main stage" but not the "sideshow tent"! 🎪
 * 
 * Scope Types:
 * - 🗺️ Territory scoping: Restrict to specific carnival grounds
 * - 🎬 Act type scoping: Restrict to specific performance types
 * - 🔑 Operation scoping: Restrict to subset of BackstageAccess
 * - ⏰ Time scoping: Expiration for the scope itself
 * 
 * @example
 * ```typescript
 * const githubScope: TokenScope = {
 *   territories: ['github-events'],    // Only GitHub territory
 *   actTypes: ['changelog'],           // Only changelog acts
 *   operations: ['acts:create'],       // Only create operations
 *   expiresAt: '2025-12-31T23:59:59Z' // Expires end of year
 * };
 * ```
 */
export interface TokenScope {
	/** 🗺️ Restrict to specific territories (e.g., ["backstage", "main-stage"]) */
	territories?: string[];
	/** 🎬 Restrict to specific act types (e.g., ["changelog", "conversation"]) */
	actTypes?: string[];
	/** 🔑 Restrict to specific operations (subset of BackstageAccess) */
	operations?: BackstageAccess[];
	/** ⏰ Expiration time for this scope (can be shorter than credential expiration) */
	expiresAt?: string;
}

/**
 * 📢 WebhookSignature - HMAC signature for webhook verification
 * 
 * Carnival metaphor: The announcer's seal on official proclamations.
 * Proves the message really came from a trusted announcer! 📜
 * 
 * Verification Process:
 * 1. 📥 Webhook arrives with signature headers
 * 2. 🔍 Extract algorithm, signature, timestamp, nonce
 * 3. 🔐 Recompute HMAC with webhook secret
 * 4. ✅ Compare signatures (constant-time comparison)
 * 5. ⏰ Check timestamp is within 5-minute window
 * 6. 🔢 Check nonce hasn't been seen before
 * 
 * Headers:
 * - `X-Carnival-Signature: sha256=<hex_signature>`
 * - `X-Carnival-Timestamp: 2025-01-18T10:00:00Z`
 * - `X-Carnival-Nonce: abc123xyz` (optional)
 * 
 * @example
 * ```typescript
 * const signature: WebhookSignature = {
 *   algorithm: 'sha256',
 *   signature: 'a1b2c3d4...',
 *   timestamp: '2025-01-18T10:00:00Z',
 *   nonce: 'xyz789abc'
 * };
 * ```
 */
export interface WebhookSignature {
	/** 🔐 Algorithm used (sha256 or sha512) */
	algorithm: 'sha256' | 'sha512';
	/** 📝 HMAC signature (hex encoded) */
	signature: string;
	/** ⏰ Timestamp of signing (ISO 8601) */
	timestamp: string;
	/** 🔢 Optional nonce for replay protection */
	nonce?: string;
}

/**
 * 🎭 Type Guards for Authentication Types
 * 
 * Runtime type checking for carnival credentials! 🎪
 */

/**
 * Check if a string is a valid backstage pass key
 */
export function isBackstagePassKey(key: string): boolean {
	return key.startsWith(CARNIVAL_AUTH_CONSTANTS.BACKSTAGE_PASS_PREFIX) &&
				key.length === CARNIVAL_AUTH_CONSTANTS.BACKSTAGE_PASS_PREFIX.length + 
												CARNIVAL_AUTH_CONSTANTS.KEY_LENGTH;
}

/**
 * Check if a string is a valid refresh token
 */
export function isRefreshToken(token: string): boolean {
	return token.startsWith(CARNIVAL_AUTH_CONSTANTS.REFRESH_TOKEN_PREFIX) &&
				token.length === CARNIVAL_AUTH_CONSTANTS.REFRESH_TOKEN_PREFIX.length + 
												CARNIVAL_AUTH_CONSTANTS.KEY_LENGTH;
}

/**
 * Check if a CredentialContext represents an impresario
 */
export function isImpresario(context: CredentialContext): boolean {
	return context.authenticated && 
				(context.performerTitle === 'impresario' || 
					context.backstageAccess.includes('impresario:all'));
}

/**
 * Check if a BackstageAccess permission is an admin permission
 */
export function isAdminPermission(access: BackstageAccess): boolean {
	return access === 'impresario:all' || 
				access === 'credentials:manage';
}