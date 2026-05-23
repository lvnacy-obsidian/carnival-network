# Existing Types Integration Guide 🧩

**Phase**: 3.3.2 Authentication System  
**Status**: Type System Analysis Complete  
**Date**: 2025-01-18

---

## 🎯 Overview

Your existing type modules fit **perfectly** into the authentication system! Here's how each one integrates:

---

## 1️⃣ rate-limiter-types.ts ✅ USE AS-IS

### What You Have
```typescript
export interface RateLimitBucket {
  tokens: number;        // Current available tokens
  lastRefill: number;    // Last refill timestamp
  capacity: number;      // Maximum tokens
  refillRate: number;    // Tokens added per interval
}

export interface RateLimitStatus {
  allowed: boolean;         // Can proceed?
  remainingTokens: number;  // Tokens left
  resetTime?: number;       // When bucket refills
  retryAfter?: number;      // Seconds until retry
}
```

### How It's Used in Authentication
```typescript
// In src/api/services/ticket-booth.ts (NEW)
import { RateLimitBucket, RateLimitStatus } from '@/types/public/rate-limiter-types';
import { PerformerType, TicketTier } from '@/types/public/authentication-types';

export class TicketBooth {
  // Map performer ID to their rate limit bucket
  private buckets = new Map<string, RateLimitBucket>();
  
  /**
   * Check if performer can proceed (carnival ticket checking)
   */
  async checkTicket(
    performerId: string, 
    performerType: PerformerType
  ): Promise<RateLimitStatus> {
    const tier = DEFAULT_TICKET_TIERS[performerType];
    let bucket = this.buckets.get(performerId);
    
    // Create new bucket if needed
    if (!bucket) {
      bucket = {
        tokens: tier.requestsPerMinute,
        lastRefill: Date.now(),
        capacity: tier.requestsPerMinute,
        refillRate: tier.requestsPerMinute / 60 // tokens per second
      };
      this.buckets.set(performerId, bucket);
    }
    
    // Refill tokens based on elapsed time
    this.refillBucket(bucket);
    
    // Check if tokens available
    if (bucket.tokens >= 1) {
      bucket.tokens--;
      return {
        allowed: true,
        remainingTokens: Math.floor(bucket.tokens),
        resetTime: this.calculateResetTime(bucket)
      };
    }
    
    // Rate limited!
    return {
      allowed: false,
      remainingTokens: 0,
      resetTime: this.calculateResetTime(bucket),
      retryAfter: Math.ceil(1 / bucket.refillRate)
    };
  }
  
  private refillBucket(bucket: RateLimitBucket): void {
    const now = Date.now();
    const elapsed = (now - bucket.lastRefill) / 1000; // seconds
    const tokensToAdd = elapsed * bucket.refillRate;
    
    bucket.tokens = Math.min(bucket.capacity, bucket.tokens + tokensToAdd);
    bucket.lastRefill = now;
  }
}
```

**Result**: Your rate limiter types are **perfectly designed** for the ticket booth! No changes needed. ✅

---

## 2️⃣ secure-store-types.ts ✅ USE AS-IS

### What You Have
```typescript
export interface APIKeyStorage {
  store(key: string, value: string): Promise<void>;
  retrieve(key: string): Promise<string | null>;
  remove(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
  listKeys(): Promise<string[]>;
  clearAll(): Promise<void>;
}
```

### How It's Used in Authentication
```typescript
// In src/api/services/backstage-pass-manager.ts (NEW)
import { APIKeyStorage } from '@/types/public/secure-store-types';
import { BackstagePass } from '@/types/public/authentication-types';

export class BackstagePassManager {
  private secureStorage: APIKeyStorage;
  
  constructor(secureStorage: APIKeyStorage) {
    this.secureStorage = secureStorage;
  }
  
  /**
   * Issue a new backstage pass (API key)
   */
  async issueBackstagePass(
    config: CreateBackstagePassConfig
  ): Promise<BackstagePass> {
    // Generate carnival_sk_* key
    const key = 'carnival_sk_' + this.generateRandomString(43);
    
    const pass: BackstagePass = {
      id: `pass_${Date.now()}`,
      key,
      name: config.name,
      performerType: config.performerType,
      backstageAccess: config.backstageAccess,
      scope: config.scope,
      createdAt: new Date().toISOString()
    };
    
    // Store in Secure Store (auto-encrypted!)
    const passes = await this.getAllPasses();
    passes.push(pass);
    await this.secureStorage.store(
      'backstage_passes', 
      JSON.stringify(passes)
    );
    
    return pass;
  }
  
  /**
   * Verify a backstage pass
   */
  async verifyBackstagePass(key: string): Promise<CredentialContext | null> {
    const passes = await this.getAllPasses();
    const pass = passes.find(p => p.key === key && !p.revokedAt);
    
    if (!pass) return null;
    
    // Check expiration
    if (pass.expiresAt && new Date(pass.expiresAt) < new Date()) {
      return null;
    }
    
    // Update last used
    pass.lastUsedAt = new Date().toISOString();
    await this.savePasses(passes);
    
    return {
      authenticated: true,
      credentialId: pass.id,
      performerType: pass.performerType,
      backstageAccess: pass.backstageAccess,
      isImpresario: pass.backstageAccess.includes('impresario:all'),
      scope: pass.scope,
      metadata: pass.metadata,
      ticketTier: DEFAULT_TICKET_TIERS[pass.performerType]
    };
  }
  
  private async getAllPasses(): Promise<BackstagePass[]> {
    const json = await this.secureStorage.retrieve('backstage_passes');
    return json ? JSON.parse(json) : [];
  }
  
  private async savePasses(passes: BackstagePass[]): Promise<void> {
    await this.secureStorage.store(
      'backstage_passes',
      JSON.stringify(passes)
    );
  }
}
```

**Storage Keys Used**:
```typescript
// In Secure Store namespace 'carnival-network'
'backstage_passes'    // JSON array of BackstagePass[]
'performance_tickets' // JSON array of issued JWT tokens (for revocation tracking)
'jwt_secret'         // JWT signing secret (base64url, 256-bit)
'refresh_tokens'     // JSON object: { [backstagePassId]: refreshToken }
'webhook_secrets'    // JSON object: { [webhookId]: secret }
'nonce_cache'        // JSON object: { [nonce]: expiresAt } for replay protection
```

**Result**: Your Secure Store interface is **exactly what we need**! No changes needed. ✅

---

## 3️⃣ carnival-configuration-types.ts ⚙️ EXTEND

### What You Have
```typescript
export interface RateLimitConfig {
  maxRequestsPerMinute: number;
  maxRequestsPerHour: number;
  burstLimit: number;
}

export interface CarnivalConfig {
  // ... existing fields ...
  rateLimitConfig?: RateLimitConfig;
  observability?: ObservabilityConfig;
}
```

### What We Add
```typescript
// EXTEND CarnivalConfig
export interface CarnivalConfig {
  // ... all existing fields unchanged ...
  
  /** Authentication configuration (NEW) */
  authentication?: AuthenticationConfig;
}

// NEW interface
export interface AuthenticationConfig {
  enabled: boolean;
  requireCredentials: boolean;
  allowedMethods: ('backstagePass' | 'performanceTicket' | 'stageDoor')[];
  jwtSecret?: string;
  jwtExpirationHours?: number;
  rateLimitEnabled?: boolean;
  customTicketTiers?: Partial<Record<PerformerType, TicketTier>>;
  webhookSignaturesEnabled?: boolean;
  oauth?: {
    enableScoping?: boolean;
    enableRefreshTokens?: boolean;
    refreshTokenTTLDays?: number;
  };
  auditLog?: {
    enabled: boolean;
    logSuccess?: boolean;
    logFailures?: boolean;
    logCredentialChanges?: boolean;
    logPath?: string;
  };
}

// EXTEND TicketTier from your RateLimitConfig
export interface TicketTier {
  performerType: PerformerType;  // NEW - ties to performer role
  requestsPerMinute: number;      // SAME as maxRequestsPerMinute
  requestsPerHour: number;        // SAME as maxRequestsPerHour
  burstAllowance: number;         // SAME as burstLimit
  blockDurationSeconds: number;   // NEW - how long to block after limit hit
}
```

### Integration Example
```typescript
// Default config with authentication
const config: CarnivalConfig = {
  // Existing fields
  maxRetries: 3,
  retryBaseDelayMs: 1000,
  // ...
  
  // Your existing rate limit config (global defaults)
  rateLimitConfig: {
    maxRequestsPerMinute: 60,
    maxRequestsPerHour: 3600,
    burstLimit: 20
  },
  
  // NEW authentication config
  authentication: {
    enabled: true,
    requireCredentials: true,
    allowedMethods: ['backstagePass', 'performanceTicket'],
    jwtExpirationHours: 24,
    rateLimitEnabled: true,
    
    // Override ticket tier for specific performer types
    customTicketTiers: {
      headliner: {
        performerType: 'headliner',
        requestsPerMinute: 1000, // Higher than global default
        requestsPerHour: 60000,
        burstAllowance: 100,
        blockDurationSeconds: 0
      }
    },
    
    webhookSignaturesEnabled: true,
    
    oauth: {
      enableScoping: true,
      enableRefreshTokens: true,
      refreshTokenTTLDays: 30
    },
    
    auditLog: {
      enabled: true,
      logSuccess: false,     // Don't log successful auth (too noisy)
      logFailures: true,     // Log failures for security
      logCredentialChanges: true, // Log pass creation/revocation
      logPath: '.carnival/auth-audit.log'
    }
  }
};
```

**Changes Required**:
- Add `authentication?: AuthenticationConfig` field to `CarnivalConfig`
- Add new `AuthenticationConfig` interface
- No breaking changes to existing config structure ✅

---

## 🎭 Nomenclature Mapping

### Before → After (Carnival-Themed)

| Original Term | Carnival Term | Reasoning |
|--------------|---------------|-----------|
| `CarnivalPermission` | `BackstageAccess` | ✅ Better metaphor - accessing behind-the-scenes areas |
| `ClientType` | `PerformerType` | ✅ Aligns with "performer" being a network client |
| `APIKeyConfig` | `BackstagePass` | ✅ Physical backstage pass metaphor |
| `JWTPayload` | `PerformanceTicket` | ✅ Temporary ticket to watch/perform |
| `AuthContext` | `CredentialContext` | ✅ More descriptive of what it contains |
| `RateLimitConfig` | `TicketTier` | ✅ Different ticket types = different limits |
| `WebhookAuth` | `AnnouncerVerifier` | ✅ Announcers verify official proclamations |

### Performer Type Meanings

```typescript
type PerformerType = 
  | 'headliner'    // Internal - VIP performer, no limits (was 'internal')
  | 'trouper'      // Regular performer - standard limits (was 'integration')
  | 'spectator'    // Observer - read-only, strict limits (was 'external')
  | 'announcer'    // Webhook handler - broadcast only (was 'webhook')
  | 'impresario';  // Carnival manager - full admin (was 'admin')
```

**Carnival Story**:
- **Headliners** are the star performers - they get backstage passes with full access
- **Troupers** are regular cast members - they perform but have reasonable limits
- **Spectators** watch from the audience - they can see but not participate much
- **Announcers** broadcast to the crowd - they send messages but don't perform
- **Impresarios** run the carnival - they manage everything from the observation tower

---

## 📊 Type Relationship Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    CarnivalConfig                           │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ authentication?: AuthenticationConfig                  │ │
│  │   - enabled                                            │ │
│  │   - requireCredentials                                 │ │
│  │   - customTicketTiers?: Record<PerformerType, ...>     │ │
│  └────────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ rateLimitConfig?: RateLimitConfig (global defaults)    │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│              BackstagePass (stored in Secure Store)         │
│  - id: string                                               │
│  - key: string (carnival_sk_...)                            │
│  - performerType: PerformerType                             │
│  - backstageAccess: BackstageAccess[]                       │
│  - scope?: TokenScope                                       │
│  - ticketTier: TicketTier (from performerType)              │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│         CredentialContext (passed to all handlers)          │
│  - authenticated: boolean                                   │
│  - credentialId: string                                     │
│  - performerType: PerformerType                             │
│  - backstageAccess: BackstageAccess[]                       │
│  - isImpresario: boolean                                    │
│  - scope?: TokenScope                                       │
│  - ticketTier: TicketTier                                   │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│         TicketBooth (rate limiter using your types)         │
│  Uses: RateLimitBucket, RateLimitStatus                     │
│  Tracks: Map<performerId, RateLimitBucket>                  │
│  Returns: RateLimitStatus { allowed, remainingTokens, ... } │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔧 Implementation Strategy

### Step 1: No Changes to Existing Types ✅
```typescript
// rate-limiter-types.ts - UNCHANGED
// secure-store-types.ts - UNCHANGED
```

### Step 2: Extend Configuration Types
```typescript
// carnival-configuration-types.ts - ADD ONE FIELD
export interface CarnivalConfig {
  // ... existing fields (all unchanged) ...
  authentication?: AuthenticationConfig; // NEW
}

// ADD NEW INTERFACE
export interface AuthenticationConfig { ... }
```

### Step 3: Create Authentication Types Module
```typescript
// authentication-types.ts - NEW FILE
export type BackstageAccess = ...;
export type PerformerType = ...;
export interface TicketTier { ... }
export interface BackstagePass { ... }
export interface PerformanceTicket { ... }
export interface CredentialContext { ... }
```

### Step 4: Wire Everything Together
```typescript
// In backstage-pass-manager.ts
import { APIKeyStorage } from '@/types/public/secure-store-types';
import { BackstagePass, CredentialContext } from '@/types/public/authentication-types';

// In ticket-booth.ts
import { RateLimitBucket, RateLimitStatus } from '@/types/public/rate-limiter-types';
import { PerformerType, TicketTier } from '@/types/public/authentication-types';

// In main.ts
const secureStorePlugin = this.app.plugins.plugins['secure-store'];
const secureStorage: APIKeyStorage = secureStorePlugin.createStorage('carnival-network');
```

---

## ✅ Summary: Perfect Type Compatibility

### Your Existing Types
1. ✅ **rate-limiter-types.ts** - Use as-is in TicketBooth
2. ✅ **secure-store-types.ts** - Use as-is in BackstagePassManager
3. ⚙️ **carnival-configuration-types.ts** - Add one optional field

### New Types Needed
4. 🆕 **authentication-types.ts** - Carnival-themed auth types
   - Imports and uses your existing types
   - No duplication or conflicts
   - Clear separation of concerns

### Integration Quality
- **Zero breaking changes** to existing types
- **Zero code duplication** between modules
- **Clear semantic relationships** between types
- **Carnival metaphor** used consistently
- **Platform compatibility** maintained (desktop + mobile)

---

## 🎯 Next Steps

1. ✅ **Review** this integration plan
2. ⏳ **Approve** carnival nomenclature (BackstageAccess, PerformerType, etc.)
3. ⏳ **Decide** on enhanced scope (OAuth features, webhook signatures, refresh tokens)
4. ⏳ **Create** `authentication-types.ts` with carnival types
5. ⏳ **Extend** `carnival-configuration-types.ts` with one new field
6. ⏳ **Implement** authentication services using your existing types
7. ⏳ **Test** on desktop and mobile platforms

---

*"The carnival's existing infrastructure is solid! We're just adding the ticket booth, credential desk, and security checkpoints using the foundation you've already built."* 🎪🎭✨