# Phase 3.3.2 REFINED: Carnival Authentication System 🎪🔐

**Date**: 2025-01-18  
**Status**: 📋 Planning Phase - REFINED SCOPE  
**Dependencies**: Phase 3.3 Complete ✅ + Secure Store Plugin ✅  
**Estimated Duration**: 3-4 implementation sessions (9-12 hours)

---

## 🎯 Executive Summary

Build a carnival-themed authentication and authorization system with:
- **3 authentication methods**: Backstage passes (API keys), Performance tickets (JWT), Stage door access (Local REST API)
- **5 performer types**: Headliners, Troupers, Spectators, Announcers, Impresarios
- **Enhanced scope**: OAuth2.0-style flows, scoped credentials, webhook signatures
- **Full platform support**: Desktop (Electron/Node) + Mobile (Capacitor) tested and working
- **Zero custom crypto**: Leverages your Secure Store plugin

---

## 🎭 Carnival Nomenclature System

### Core Concepts

**Authentication = Carnival Credentials**
- **Backstage Pass** (API key): Long-lived credential for performers
- **Performance Ticket** (JWT): Time-limited session token
- **Stage Door Access** (Local REST API): Trusted local entry

**Authorization = Access Rights**
- **BackstageAccess** (permission): What acts you can participate in
- **PerformerType** (client type): Your role in the carnival
- **TicketTier** (rate limit tier): How many acts you can see

**Network Entities**
- **Performer** (client): Individual participant in the carnival
- **Troupe** (network collection): Group of performers
- **Impresario** (admin): Carnival manager with full access

---

## 🎪 Type System Integration

### 1. Existing Types - How They Fit

#### Already Defined ✅
```typescript
// From rate-limiter-types.ts
interface RateLimitBucket {
  tokens: number;           // Available tokens
  lastRefill: number;       // Last refill timestamp
  capacity: number;         // Max tokens
  refillRate: number;       // Tokens per interval
}

interface RateLimitStatus {
  allowed: boolean;         // Can proceed?
  remainingTokens: number;  // Tokens left
  resetTime?: number;       // When bucket refills
  retryAfter?: number;      // Seconds until retry
}
```

**Integration**: Use these types directly in `AuthorizationService`!

```typescript
// From carnival-configuration-types.ts
interface RateLimitConfig {
  maxRequestsPerMinute: number;
  maxRequestsPerHour: number;
  burstLimit: number;
}
```

**Integration**: Extend for per-performer-type limits:
```typescript
interface EnhancedRateLimitConfig extends RateLimitConfig {
  performerType: PerformerType;
  blockDurationSeconds: number;
}
```

```typescript
// From secure-store-types.ts
interface APIKeyStorage {
  store(key: string, value: string): Promise<void>;
  retrieve(key: string): Promise<string | null>;
  remove(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
  listKeys(): Promise<string[]>;
  clearAll(): Promise<void>;
}
```

**Integration**: Used directly by `AuthService` - no changes needed!

### 2. New Carnival-Themed Authentication Types

**File**: `src/types/public/authentication-types.ts`

```typescript
import type { APIKeyStorage } from './secure-store-types';
import type { RateLimitConfig } from './carnival-configuration-types';

/**
 * ============================================================================
 * CARNIVAL AUTHENTICATION TYPES
 * ============================================================================
 * 
 * The carnival's credential system - backstage passes, performance tickets,
 * and access rights for all performers in the grand show.
 * 
 * Index of exports:
 * - BackstageAccess - Permission types (what acts you can access)
 * - PerformerType - Role types (what kind of performer you are)
 * - TicketTier - Rate limit tiers (how often you can perform)
 * - BackstagePass - API key configuration (long-lived credentials)
 * - PerformanceTicket - JWT payload (session tokens)
 * - CredentialContext - Authentication context (passed to handlers)
 * - CreateBackstagePassConfig - API key creation options
 * - TokenScope - OAuth2.0-style scopes for fine-grained access
 * - WebhookSignature - HMAC signature for webhook verification
 */

/**
 * BackstageAccess - What acts you can participate in
 * 
 * Carnival metaphor: Different colored wristbands grant access to different
 * areas of the carnival. Some performers can only watch, others can perform,
 * and impresarios can manage the entire show.
 */
export type BackstageAccess = 
  | 'acts:read'           // Watch acts being performed
  | 'acts:create'         // Create new acts
  | 'acts:broadcast'      // Broadcast acts to the network
  | 'acts:delete'         // Remove acts (cleanup crew)
  | 'search:execute'      // Search through the archives
  | 'carnival:status'     // View the carnival's health
  | 'territories:list'    // See all carnival grounds
  | 'territories:create'  // Establish new territories
  | 'analytics:read'      // View performance metrics
  | 'webhooks:receive'    // Receive announcements
  | 'webhooks:register'   // Register new announcement channels
  | 'credentials:manage'  // Issue backstage passes (impresario only)
  | 'impresario:all';     // Full access (carnival manager)

/**
 * PerformerType - Your role in the carnival
 * 
 * Carnival metaphor: Different types of performers have different privileges.
 * Headliners get VIP treatment, spectators watch from the audience.
 */
export type PerformerType = 
  | 'headliner'    // Internal performer - full access, no limits (formerly 'internal')
  | 'trouper'      // Regular performer - standard access (formerly 'integration')
  | 'spectator'    // External observer - read-only (formerly 'external')
  | 'announcer'    // Webhook performer - broadcast only (formerly 'webhook')
  | 'impresario';  // Carnival manager - full admin (formerly 'admin')

/**
 * TicketTier - Rate limit tiers by performer type
 * 
 * Carnival metaphor: Different ticket types allow different numbers of
 * performances. VIP tickets (headliner) have no limits, general admission
 * (spectator) has strict limits.
 */
export interface TicketTier {
  performerType: PerformerType;
  requestsPerMinute: number;
  requestsPerHour: number;
  burstAllowance: number;
  blockDurationSeconds: number;
}

/**
 * Default ticket tiers for each performer type
 */
export const DEFAULT_TICKET_TIERS: Record<PerformerType, TicketTier> = {
  headliner: {
    performerType: 'headliner',
    requestsPerMinute: 1000,
    requestsPerHour: 60000,
    burstAllowance: 100,
    blockDurationSeconds: 0 // No blocking
  },
  trouper: {
    performerType: 'trouper',
    requestsPerMinute: 60,
    requestsPerHour: 3600,
    burstAllowance: 20,
    blockDurationSeconds: 60
  },
  spectator: {
    performerType: 'spectator',
    requestsPerMinute: 30,
    requestsPerHour: 1000,
    burstAllowance: 10,
    blockDurationSeconds: 300
  },
  announcer: {
    performerType: 'announcer',
    requestsPerMinute: 10,
    requestsPerHour: 600,
    burstAllowance: 5,
    blockDurationSeconds: 600
  },
  impresario: {
    performerType: 'impresario',
    requestsPerMinute: 1000,
    requestsPerHour: 60000,
    burstAllowance: 100,
    blockDurationSeconds: 0
  }
};

/**
 * TokenScope - OAuth2.0-style scopes for fine-grained access control
 * 
 * Carnival metaphor: Scoped tickets allow access to specific acts or territories.
 * You might have a ticket for the "main stage" but not the "sideshow tent".
 */
export interface TokenScope {
  /** Restrict to specific territories (e.g., ["backstage", "main-stage"]) */
  territories?: string[];
  
  /** Restrict to specific act types (e.g., ["changelog", "conversation"]) */
  actTypes?: string[];
  
  /** Restrict to specific operations (subset of BackstageAccess) */
  operations?: BackstageAccess[];
  
  /** Expiration time for this scope (can be shorter than token expiration) */
  expiresAt?: string;
}

/**
 * BackstagePass - Long-lived API key credential
 * 
 * Carnival metaphor: A laminated backstage pass that performers wear around
 * their neck. Shows your name, role, and what areas you can access.
 */
export interface BackstagePass {
  /** Unique pass ID */
  id: string;
  
  /** The actual credential (carnival_sk_...) */
  key: string;
  
  /** Human-readable name */
  name: string;
  
  /** Performer role */
  performerType: PerformerType;
  
  /** Access rights */
  backstageAccess: BackstageAccess[];
  
  /** Optional fine-grained scoping */
  scope?: TokenScope;
  
  /** When pass was issued */
  createdAt: string;
  
  /** Last time pass was used */
  lastUsedAt?: string;
  
  /** Optional expiration */
  expiresAt?: string;
  
  /** If pass was revoked */
  revokedAt?: string;
  
  /** Custom metadata */
  metadata?: Record<string, unknown>;
}

/**
 * PerformanceTicket - JWT session token payload
 * 
 * Carnival metaphor: A paper ticket with a time limit. Good for today's
 * performances only, then you need a new ticket tomorrow.
 */
export interface PerformanceTicket {
  /** Subject - backstage pass ID that issued this ticket */
  sub: string;
  
  /** Issued at (Unix timestamp) */
  iat: number;
  
  /** Expiration (Unix timestamp) */
  exp: number;
  
  /** Access rights */
  backstageAccess: BackstageAccess[];
  
  /** Performer role */
  performerType: PerformerType;
  
  /** Optional scoping */
  scope?: TokenScope;
  
  /** JWT ID (for revocation tracking) */
  jti?: string;
}

/**
 * CredentialContext - Authentication context passed to handlers
 * 
 * Carnival metaphor: The performer's credentials checked at the gate.
 * Used throughout the request lifecycle to authorize access.
 */
export interface CredentialContext {
  /** Successfully authenticated? */
  authenticated: boolean;
  
  /** Which backstage pass or ticket was used */
  credentialId?: string;
  
  /** Performer role */
  performerType?: PerformerType;
  
  /** Access rights */
  backstageAccess: BackstageAccess[];
  
  /** Is this an impresario (full admin)? */
  isImpresario: boolean;
  
  /** Optional scoping constraints */
  scope?: TokenScope;
  
  /** Custom metadata from credential */
  metadata?: Record<string, unknown>;
  
  /** Rate limit tier for this credential */
  ticketTier?: TicketTier;
}

/**
 * CreateBackstagePassConfig - Options for creating new API keys
 */
export interface CreateBackstagePassConfig {
  name: string;
  performerType: PerformerType;
  backstageAccess: BackstageAccess[];
  scope?: TokenScope;
  expiresInHours?: number;
  metadata?: Record<string, unknown>;
}

/**
 * WebhookSignature - HMAC signature for webhook verification
 * 
 * Carnival metaphor: The announcer's seal on official proclamations.
 * Proves the message really came from a trusted announcer.
 */
export interface WebhookSignature {
  /** Algorithm used (e.g., 'sha256') */
  algorithm: 'sha256' | 'sha512';
  
  /** HMAC signature (hex encoded) */
  signature: string;
  
  /** Timestamp of signing (ISO 8601) */
  timestamp: string;
  
  /** Optional nonce for replay protection */
  nonce?: string;
}

/**
 * SignedWebhookPayload - Webhook payload with signature
 */
export interface SignedWebhookPayload {
  /** Original payload (JSON) */
  payload: unknown;
  
  /** Signature verification data */
  signature: WebhookSignature;
}
```

### 3. Updated Configuration Types

**File**: `src/types/public/carnival-configuration-types.ts` (MODIFIED)

```typescript
interface CarnivalConfig {
  // ... existing fields ...
  
  /** Authentication configuration (the credential booth) */
  authentication?: AuthenticationConfig;
}

/**
 * AuthenticationConfig - How credentials are managed in the carnival
 */
interface AuthenticationConfig {
  /** Master toggle - enable authentication system */
  enabled: boolean;
  
  /** Require credentials for all API endpoints */
  requireCredentials: boolean;
  
  /** Which authentication methods to allow */
  allowedMethods: ('backstagePass' | 'performanceTicket' | 'stageDoor')[];
  
  /** JWT signing secret (auto-generated if not provided) */
  jwtSecret?: string;
  
  /** Default JWT expiration in hours (default: 24) */
  jwtExpirationHours?: number;
  
  /** Enable rate limiting per performer type */
  rateLimitEnabled?: boolean;
  
  /** Custom ticket tiers (overrides defaults) */
  customTicketTiers?: Partial<Record<PerformerType, TicketTier>>;
  
  /** Enable webhook signature verification */
  webhookSignaturesEnabled?: boolean;
  
  /** OAuth2.0-style features */
  oauth?: {
    /** Enable token scoping */
    enableScoping?: boolean;
    
    /** Enable refresh tokens */
    enableRefreshTokens?: boolean;
    
    /** Refresh token TTL in days (default: 30) */
    refreshTokenTTLDays?: number;
  };
  
  /** Audit logging configuration */
  auditLog?: {
    /** Enable audit logging */
    enabled: boolean;
    
    /** Log successful authentications */
    logSuccess?: boolean;
    
    /** Log failed attempts */
    logFailures?: boolean;
    
    /** Log credential changes */
    logCredentialChanges?: boolean;
    
    /** Storage location (default: .carnival/audit.log) */
    logPath?: string;
  };
}
```

---

## 🏗️ Enhanced Architecture

### Authentication Flow with Scoping

```
┌─────────────────────────────────────────────────────────┐
│                  Carnival Entrance                      │
│         (API Request with Credentials)                  │
└──────────────────┬──────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────┐
│             Credential Check                            │
│  - Extract from Authorization header                    │
│  - Identify method (backstagePass / performanceTicket)  │
└──────────────────┬──────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────┐
│          Credential Verification                        │
│  - Validate signature/format                            │
│  - Check expiration                                     │
│  - Check revocation status                              │
│  - Load access rights + scopes                          │
└──────────────────┬──────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────┐
│          Scope Validation (if applicable)               │
│  - Check territory restrictions                         │
│  - Check act type restrictions                          │
│  - Check operation restrictions                         │
└──────────────────┬──────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────┐
│       Authorization & Rate Limiting                     │
│  - Check BackstageAccess for endpoint                   │
│  - Apply ticket tier rate limits                        │
│  - Log access attempt                                   │
└──────────────────┬──────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────┐
│              Execute Handler                            │
│  - Process request with CredentialContext               │
│  - Return response                                      │
└─────────────────────────────────────────────────────────┘
```

---

## 🔨 Implementation Plan (Enhanced Scope)

### Session 1: Core Authentication (3-4 hours)

**1.1 Authentication Types** (30 min)
- [x] Review existing types (rate-limiter, config, secure-store)
- [ ] Create `authentication-types.ts` with carnival nomenclature
- [ ] Export `BackstageAccess`, `PerformerType`, `TicketTier`
- [ ] Export `BackstagePass`, `PerformanceTicket`, `CredentialContext`
- [ ] Export `TokenScope`, `WebhookSignature` for enhanced features

**1.2 Secure Store Integration** (30 min)
- [ ] Add dependency check in `main.ts`
- [ ] Create `SecureStoreManager` wrapper class
- [ ] Handle missing plugin gracefully
- [ ] Initialize storage namespace: `carnival-network`

**1.3 AuthService Core** (2 hours)
- [ ] Implement `BackstagePassManager` (API key operations)
  - `issueBackstagePass()` - Generate carnival_sk_* key
  - `verifyBackstagePass()` - Validate and return CredentialContext
  - `revokeBackstagePass()` - Mark as revoked with timestamp
  - `listBackstagePasses()` - Get all active passes
  - `updateLastUsed()` - Track usage
- [ ] Implement `PerformanceTicketManager` (JWT operations)
  - `issuePerformanceTicket()` - Generate JWT from backstage pass
  - `verifyPerformanceTicket()` - Validate JWT and return context
  - `refreshPerformanceTicket()` - Refresh token before expiration
  - `getJWTSecret()` - Retrieve or generate signing secret
- [ ] Add scope validation logic
- [ ] Test on desktop (Electron/Node)
- [ ] Test on mobile (Capacitor) - ensure Secure Store compatibility

**1.4 Configuration Updates** (30 min)
- [ ] Update `CarnivalConfig` with `AuthenticationConfig`
- [ ] Add default ticket tier constants
- [ ] Validate config on plugin load

**Commit**: "Phase 3.3.2 Session 1: Carnival authentication core with Secure Store"

---

### Session 2: Authorization & Rate Limiting (3-4 hours)

**2.1 Authorization Service** (1.5 hours)
- [ ] Implement `AccessControlService`
  - `hasBackstageAccess()` - Check single permission
  - `hasAnyBackstageAccess()` - Check multiple permissions (OR)
  - `hasAllBackstageAccess()` - Check multiple permissions (AND)
  - `validateScope()` - Check TokenScope constraints
  - `getEffectiveAccess()` - Combine base access + scope restrictions
- [ ] Implement endpoint permission mapping
  - Map each API route to required BackstageAccess
  - Support multiple permissions per endpoint
- [ ] Add territory/act type scope checking

**2.2 Rate Limiter** (1.5 hours)
- [ ] Implement `TicketBooth` (rate limiter using existing types)
  - Use `RateLimitBucket` and `RateLimitStatus` from rate-limiter-types.ts
  - Per-performer tracking (Map<string, RateLimitBucket>)
  - Token bucket algorithm with burst allowance
  - `checkTicket()` - Validate rate limit for performer
  - `refillBucket()` - Auto-refill based on ticket tier
- [ ] Integrate with existing `TicketTier` types
- [ ] Add metrics: `carnival.tickets.checked_total`, `carnival.tickets.denied_total`
- [ ] Test burst scenarios
- [ ] Test cross-platform consistency (desktop vs mobile)

**2.3 Middleware** (1 hour)
- [ ] Create `credentialCheckMiddleware` (auth)
  - Extract Authorization header
  - Route to BackstagePassManager or PerformanceTicketManager
  - Inject CredentialContext into request
  - Handle 401 errors with carnival-themed messages
- [ ] Create `accessControlMiddleware` (authz)
  - Check BackstageAccess for endpoint
  - Validate scopes if present
  - Check rate limits via TicketBooth
  - Handle 403/429 errors with carnival-themed messages
- [ ] Test middleware chain on sample endpoints

**Commit**: "Phase 3.3.2 Session 2: Access control and ticket booth (rate limiting)"

---

### Session 3: Webhook Signatures & OAuth Features (2-3 hours)

**3.1 Webhook Signature Verification** (1 hour)
- [ ] Implement `AnnouncerVerifier` (webhook signature service)
  - `signPayload()` - Generate HMAC-SHA256 signature
  - `verifySignature()` - Validate webhook signature
  - `generateNonce()` - For replay protection
  - `checkReplayWindow()` - Timestamp validation
- [ ] Add signature headers: `X-Carnival-Signature`, `X-Carnival-Timestamp`
- [ ] Integration with webhook endpoints
- [ ] Test with sample payloads

**3.2 OAuth-Style Token Scoping** (1 hour)
- [ ] Implement `ScopeValidator`
  - Territory-based scoping (restrict to specific territories)
  - Act type scoping (restrict to specific act types)
  - Operation scoping (subset of BackstageAccess)
  - Time-based scope expiration
- [ ] Add scope parameter to credential creation
- [ ] Add scope validation to AccessControlService
- [ ] Test scoped credentials

**3.3 Refresh Token Flow** (1 hour)
- [ ] Implement refresh token storage (in Secure Store)
- [ ] Add `/api/auth/refresh` endpoint
- [ ] Implement refresh token generation
- [ ] Implement refresh token validation
- [ ] Add refresh token revocation
- [ ] Test refresh flow

**Commit**: "Phase 3.3.2 Session 3: Webhook signatures and OAuth-style features"

---

### Session 4: Management API & UI (2-3 hours)

**4.1 Management Endpoints** (1 hour)
- [ ] Implement auth handler routes
  - `POST /api/credentials/backstage-passes` - Issue new pass
  - `GET /api/credentials/backstage-passes` - List passes
  - `DELETE /api/credentials/backstage-passes/:id` - Revoke pass
  - `POST /api/credentials/performance-tickets` - Issue JWT
  - `POST /api/credentials/refresh` - Refresh JWT
  - `GET /api/credentials/verify` - Verify current credentials
  - `POST /api/credentials/scopes` - Create scoped credential
- [ ] Add impresario-only access control
- [ ] Test all endpoints with curl

**4.2 Settings UI** (1.5 hours)
- [ ] Create "Carnival Credentials" section in settings
- [ ] Show Secure Store status
- [ ] Implement backstage pass manager UI component
  - Table view with performer type, access rights, last used
  - Create button with modal (name, type, access, scope)
  - Revoke button with confirmation
  - Copy key button (shows full key once)
- [ ] Add ticket tier configuration UI
- [ ] Add OAuth features toggle
- [ ] Test UI flows

**4.3 Audit Logging** (30 min)
- [ ] Implement `CarnivalAuditLog` service
- [ ] Log format: JSONL with carnival terminology
- [ ] Log rotation at 10MB
- [ ] Integration with credential operations
- [ ] Test log writing and rotation

**Commit**: "Phase 3.3.2 Session 4: Management API and credentials UI"

---

## 🗂️ Updated File Structure

```
src/
├── api/
│   ├── services/
│   │   ├── backstage-pass-manager.ts       # NEW - API key operations
│   │   ├── performance-ticket-manager.ts   # NEW - JWT operations
│   │   ├── access-control-service.ts       # NEW - Authorization
│   │   ├── ticket-booth.ts                 # NEW - Rate limiting
│   │   ├── announcer-verifier.ts           # NEW - Webhook signatures
│   │   ├── scope-validator.ts              # NEW - Token scoping
│   │   └── carnival-audit-log.ts           # NEW - Audit logging
│   ├── middleware/
│   │   ├── credential-check-middleware.ts  # NEW - Authentication
│   │   └── access-control-middleware.ts    # NEW - Authorization
│   ├── handlers/
│   │   └── credentials-handlers.ts         # NEW - Management endpoints
│   ├── api-router.ts                       # MODIFIED - Add middleware
│   └── external-api-service.ts             # MODIFIED - Use CredentialContext
├── types/public/
│   ├── authentication-types.ts             # NEW - Carnival auth types
│   ├── rate-limiter-types.ts               # EXISTS - Use as-is
│   ├── secure-store-types.ts               # EXISTS - Use as-is
│   └── carnival-configuration-types.ts     # MODIFIED - Add AuthenticationConfig
├── ui/
│   ├── components/
│   │   └── backstage-pass-manager.ts       # NEW - Credential management UI
│   └── settings-tab.ts                     # MODIFIED - Add credentials section
└── utils/
    └── secure-store-manager.ts             # NEW - Wrapper for Secure Store integration

TOTAL NEW CODE: ~2,800 lines (up from ~2,100 due to enhanced features)
```

---

## 🎭 Carnival Error Messages

### Authentication Failures (401)
```
"Your backstage pass is not recognized. Please check your credentials at the ticket booth."

"Your performance ticket has expired. Please obtain a new ticket to continue."

"The stage door is locked. Please use a valid backstage pass or performance ticket."
```

### Authorization Failures (403)
```
"Your ticket doesn't grant access to this act. Contact the impresario for permission."

"This territory is restricted. Your backstage pass doesn't include access to {territory}."

"You've tried to perform an act outside your scope. Please request broader access rights."
```

### Rate Limiting (429)
```
"You've exceeded your performance limit for {ticket_tier}. Please slow down and try again in {retry_after} seconds."

"The carnival is at capacity. Your {performer_type} ticket allows {limit} performances per hour."

"Too many encores! Take a break and return in {block_duration} seconds."
```

### Webhook Verification Failures (401)
```
"The announcer's seal is invalid. This proclamation cannot be verified."

"This announcement is too old. Announcements must be delivered within 5 minutes."

"Replay detected! This announcement was already processed."
```

---

## 🔐 Security Enhancements

### 1. Webhook Signature Verification
```typescript
// Announcer signs the payload
const signature = await announcerVerifier.signPayload(payload, secret);

// Headers sent with webhook
X-Carnival-Signature: sha256=<hex_signature>
X-Carnival-Timestamp: 2025-01-18T10:00:00Z
X-Carnival-Nonce: abc123xyz (optional)

// Recipient verifies
const valid = await announcerVerifier.verifySignature(payload, signature, secret);
```

### 2. Token Scoping
```typescript
// Create scoped backstage pass
const pass = await backstagePassManager.issueBackstagePass({
  name: 'GitHub Webhook Handler',
  performerType: 'announcer',
  backstageAccess: ['acts:create', 'webhooks:receive'],
  scope: {
    territories: ['github-events'],      // Only github-events territory
    actTypes: ['changelog'],             // Only changelog acts
    operations: ['acts:create'],         // Only create operations
    expiresAt: '2025-12-31T23:59:59Z'   // Scope expires end of year
  }
});
```

### 3. Refresh Token Flow
```typescript
// 1. Issue performance ticket with refresh capability
const { performanceTicket, refreshToken } = await manager.issuePerformanceTicket(
  backstagePassId,
  { enableRefresh: true }
);

// 2. When performance ticket expires, use refresh token
const newTicket = await manager.refreshPerformanceTicket(refreshToken);

// 3. Refresh tokens expire after 30 days (configurable)
```

---

## 📊 Platform Compatibility Testing

### Desktop (Electron/Node) ✅
- [ ] Test backstage pass generation
- [ ] Test performance ticket generation
- [ ] Test Secure Store integration
- [ ] Test rate limiting accuracy
- [ ] Test webhook signature generation
- [ ] Test concurrent request handling

### Mobile (Capacitor) ✅
- [ ] Test Secure Store on iOS
- [ ] Test Secure Store on Android
- [ ] Test credential verification performance
- [ ] Test rate limiting consistency
- [ ] Test JWT generation/validation
- [ ] Test memory usage with many credentials

### Cross-Platform Consistency
- [ ] Ensure same credentials work on desktop and mobile
- [ ] Verify rate limit buckets sync properly
- [ ] Test credential migration between devices
- [ ] Validate signature algorithms produce same results

---

## 📋 Implementation Checklist

### Session 1: Core Authentication ⏳
- [ ] Create authentication-types.ts with carnival nomenclature
- [ ] Integrate existing rate-limiter-types.ts and secure-store-types.ts
- [ ] Implement SecureStoreManager wrapper
- [ ] Implement BackstagePassManager (API keys)
- [ ] Implement PerformanceTicketManager (JWT)
- [ ] Add scope validation logic
- [ ] Test on desktop (Electron)
- [ ] Test on mobile (iOS/Android)
- [ ] Update carnival-configuration-types.ts

### Session 2: Authorization & Rate Limiting ⏳
- [ ] Implement AccessControlService with scope checking
- [ ] Implement TicketBooth using existing RateLimitBucket types
- [ ] Create credential-check-middleware
- [ ] Create access-control-middleware
- [ ] Add endpoint permission mapping
- [ ] Test middleware chain
- [ ] Verify cross-platform rate limiting

### Session 3: Enhanced Features ⏳
- [ ] Implement AnnouncerVerifier for webhook signatures
- [ ] Implement ScopeValidator for fine-grained access
- [ ] Implement refresh token flow
- [ ] Add `/api/credentials/refresh` endpoint
- [ ] Test webhook signature verification
- [ ] Test scoped credentials
-