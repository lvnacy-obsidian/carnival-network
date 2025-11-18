# Service-Specific Handler Removal Plan
**Date**: 2025-11-17  
**Purpose**: Make Carnival Network truly infrastructure-only  
**Status**: Ready for Execution

---

## Strategic Objective

Transform Carnival Network from a plugin with baked-in service integrations to a pure infrastructure layer that provides:
- Generic REST API endpoints
- Generic webhook handling patterns  
- Authentication and authorization primitives
- Network coordination services

Let consuming plugins handle service-specific logic (GitHub, Discord, Beehiiv, etc.)

---

## Files to Remove

### Handler Implementations
```
src/network/handlers/
├── discord-handlers.ts      # DELETE - Discord-specific endpoints
├── webhook-handlers.ts      # DELETE - GitHub + Beehiiv webhook processing
└── (keep) auth-handlers.ts  # KEEP - Generic authentication
└── (keep) error-handler.ts  # KEEP - Generic error handling
└── (keep) search-handlers.ts # KEEP - Generic search (if exists)
```

### Service-Specific Services
```
src/network/services/
└── webhook-verifier.ts      # DELETE - GitHub/Beehiiv signature verification
```

###Service-Specific Types
```
src/types/public/
└── webhook-types.ts         # MODIFY - Remove GitHub/Beehiiv specific types
                             # Keep generic WebhookPayload, WebhookResponse
```

---

## Types to Remove/Modify

### From `webhook-types.ts`:
**REMOVE**:
- `GitHubWebhookPayload`
- `GitHubPullRequest`
- `GitHubIssue`
- `GitHubRepository`
- `GitHubUser`
- `BeehiivWebhookPayload`
- `BeehiivPost`
- `BeehiivPostData`
- `BeehiivSubscriber`
- `BeehiivSubscriberData`

**KEEP**:
- `WebhookPayload` (generic)
- `WebhookResponse` (generic)
- `WebhookHandlerInterface` (generic contract)

### From `api-request-types.ts`:
**MODIFY**:
- Remove `source: 'github' | 'beehiiv'` from webhook request bodies
- Make webhook types fully generic

### From `carnival-configuration-types.ts`:
**REMOVE**:
```typescript
integrations?: {
    github?: { webhookSecret?: string; };
    beehiiv?: { webhookSecret?: string; };
}
```

### From `carnival-performer-types.ts`:
**MODIFY** `GuestPerformer.type`:
- Change from: `type: 'discord' | 'webhook' | 'external'`
- Change to: `type: string` (fully generic)

---

## Files to Keep (Generic Infrastructure)

### Authentication & Authorization
```
✅ src/network/handlers/auth-handlers.ts
✅ src/network/utils/client-authentication.ts
```

### Generic API
```
✅ src/network/external-api-service.ts (once completed)
✅ src/network/api-router.ts (once created)
```

### Core Services
```
✅ src/network/services/act-service.ts
✅ src/network/services/carnival-query-service.ts
✅ src/network/services/territory-access-service.ts
✅ src/network/http-registry-service.ts
✅ src/network/persistent-performer-cache.ts
```

---

## Migration Path for Users

### Option A: Move to Examples (Compromise)
Create `examples/integrations/` with:
```
examples/integrations/
├── README.md                     # How to use these examples
├── github-integration.ts         # Copy of GitHub handler logic
├── discord-integration.ts        # Copy of Discord handler logic
├── beehiiv-integration.ts        # Copy of Beehiiv handler logic
└── webhook-verification.ts       # HMAC verification utilities
```

Documented as reference implementations that users can adapt.

### Option B: Separate Plugins (Recommended for Future)
Create companion plugins:
- `carnival-network-github` - GitHub webhooks → Acts
- `carnival-network-discord` - Discord bot → Carnival API
- `carnival-network-newsletter` - Beehiiv/newsletter → Acts

Each depends on `carnival-network` as infrastructure.

---

## Generic Webhook Pattern (Replacement)

### New Generic Webhook Endpoint
```typescript
// Generic webhook endpoint - no service knowledge
POST /api/webhooks/:webhookId

Request Headers:
- X-Webhook-Signature: Optional HMAC signature
- X-Webhook-Timestamp: Optional timestamp
- Content-Type: application/json

Request Body: any (service-specific)

Response:
{
  "status": "success" | "error",
  "message": string,
  "webhookId": string,
  "timestamp": string
}
```

### Generic Webhook Configuration
```typescript
// In carnival-configuration-types.ts
webhooks?: {
  [webhookId: string]: {
    enabled: boolean;
    signatureHeader?: string;      // e.g. "X-Hub-Signature-256"
    secret?: string;                // For HMAC verification
    targetTerritory?: string;       // Where to broadcast acts
    metadata?: Record<string, unknown>;
  }
}
```

### How Consuming Plugins Use It

```typescript
// In consuming plugin (e.g. carnival-network-github)
import { CarnivalPerformerInterface } from 'carnival-network';

class GitHubIntegration {
  constructor(private carnival: CarnivalPerformerInterface) {}
  
  async handleWebhook(payload: GitHubWebhookPayload) {
    // 1. Verify signature (plugin-specific logic)
    this.verifyGitHubSignature(payload);
    
    // 2. Transform to CarnivalAct (plugin-specific logic)
    const act = this.transformPRToAct(payload.pull_request);
    
    // 3. Use Carnival infrastructure to broadcast
    await this.carnival.broadcastAct(act);
  }
}
```

---

## Execution Steps

### Step 1: Document Generic Patterns
Create `.github/docs/integration-guide.md` explaining:
- How to use generic webhook endpoint
- How to transform service payloads to CarnivalActs
- Example HMAC signature verification
- Example integration plugin structure

### Step 2: Move Service Logic to Examples
Copy service-specific logic to `examples/integrations/` for reference

### Step 3: Remove Service-Specific Code
Delete handler files and clean up types

### Step 4: Update Configuration
Remove service-specific config fields

### Step 5: Update Tests
Remove tests for deleted handlers

### Step 6: Update Documentation
- Update README to reflect infrastructure-only approach
- Add migration guide for existing users
- Document generic patterns

---

## Benefits of This Approach

### Technical
- ✅ Smaller plugin bundle size
- ✅ Faster load times
- ✅ Less attack surface
- ✅ Cleaner separation of concerns
- ✅ Easier to test

### Architectural
- ✅ Truly agnostic infrastructure
- ✅ No coupling to external service APIs
- ✅ No breaking changes when services update APIs
- ✅ Extensible without modifying core plugin

### User Experience
- ✅ Users install only integrations they need
- ✅ Clearer plugin purpose
- ✅ Better performance (no unused code)
- ✅ More control over integrations

### Maintenance
- ✅ Core plugin doesn't break when GitHub API changes
- ✅ Integration updates don't require core plugin release
- ✅ Community can contribute integrations independently
- ✅ Focused issue tracking (network issues vs integration issues)

---

## Post-Removal State

### What Carnival Network Provides (Infrastructure)
- ✅ Territory registration and discovery
- ✅ Performer cache and topology
- ✅ Act creation and broadcasting
- ✅ Cross-vault search
- ✅ Network analytics
- ✅ Generic REST API endpoints
- ✅ Generic authentication/authorization
- ✅ Generic webhook pattern
- ✅ Observability framework

### What Consuming Plugins Provide (Application)
- ❌ GitHub webhook parsing
- ❌ Discord command handling
- ❌ Beehiiv event transformation
- ❌ Service-specific business logic
- ❌ Service-specific error handling

---

## Implementation Checklist

- [ ] Create integration guide documentation
- [ ] Copy handlers to examples/ directory
- [ ] Remove discord-handlers.ts
- [ ] Remove webhook-handlers.ts
- [ ] Remove webhook-verifier.ts
- [ ] Clean up webhook-types.ts (keep generic types only)
- [ ] Remove service-specific config from carnival-configuration-types.ts
- [ ] Update GuestPerformer.type to be generic (string)
- [ ] Update index.ts exports
- [ ] Remove service-specific tests
- [ ] Update CHANGELOG.md
- [ ] Update README.md
- [ ] Update NETWORK-ROADMAP.md
- [ ] Commit with descriptive message

---

*"The carnival provides the grounds. The performers bring the acts."* 🎪✨

---

**End of Removal Plan**
