# Carnival Network - Integration Examples

**Purpose**: Reference implementations showing how to integrate external services with Carnival Network.

---

## Overview

Carnival Network is infrastructure-only. It provides:
- Generic REST API endpoints
- Act broadcasting and querying
- Network topology and analytics
- Authentication and authorization primitives

**These examples** show how to build service-specific integrations as separate plugins or modules that use Carnival Network's infrastructure.

---

## Example Files

### `discord-integration-example.ts`
Reference implementation of Discord bot integration.

**Shows how to:**
- Handle Discord-specific API requests
- Transform Discord commands into CarnivalActs
- Use ActService and CarnivalQueryService
- Return Discord-formatted responses

**Use this as a template for:**
- Building a `carnival-network-discord` companion plugin
- Understanding Discord → Carnival data flow
- Implementing Discord command handlers

---

### `webhook-integration-example.ts`
Reference implementation of GitHub and Beehiiv webhook handling.

**Shows how to:**
- Verify webhook signatures (GitHub HMAC, Beehiiv HMAC)
- Parse service-specific webhook payloads
- Transform events into CarnivalActs
- Broadcast acts to appropriate territories

**Use this as a template for:**
- Building GitHub integration plugin
- Building newsletter integration plugin
- Understanding webhook → act transformation
- Implementing custom webhook handlers

---

### `webhook-verification-example.ts`
Utilities for verifying webhook signatures.

**Shows how to:**
- Implement HMAC-SHA256 verification
- Handle GitHub signature format (`sha256=<hex>`)
- Handle Beehiiv signature format
- Extract signatures from headers

**Use this as a template for:**
- Implementing secure webhook verification
- Building custom signature verification
- Understanding HMAC patterns

---

## How to Use These Examples

### Option 1: Copy to Your Plugin

```typescript
// In your separate integration plugin
import { CarnivalPerformerInterface } from 'carnival-network';

// Copy relevant logic from examples
class MyGitHubIntegration {
  constructor(private carnival: CarnivalPerformerInterface) {}
  
  async handleWebhook(payload: any) {
    // Use example logic to transform payload
    const act = this.transformToAct(payload);
    
    // Use Carnival infrastructure to broadcast
    await this.carnival.broadcastAct(act);
  }
}
```

### Option 2: Adapt for Your Service

Use the patterns shown in examples to integrate other services:
- Slack webhooks
- Jira events
- Custom internal services
- Any HTTP-based integration

---

## Integration Pattern

All service integrations follow this pattern:

```typescript
1. Receive service-specific payload
   ↓
2. Verify signature/authentication (if needed)
   ↓
3. Parse service-specific format
   ↓
4. Transform to CarnivalAct format
   ↓
5. Use Carnival Network API to broadcast
   ↓
6. Return service-specific response
```

---

## Building a Companion Plugin

### Structure
```
carnival-network-github/
├── manifest.json           # Declare dependency on carnival-network
├── main.ts                 # Plugin entry point
├── github-webhook.ts       # Webhook handler (adapt from examples)
├── github-types.ts         # GitHub-specific types
└── README.md               # Integration docs
```

### Manifest (Example)
```json
{
  "id": "carnival-network-github",
  "name": "Carnival Network - GitHub Integration",
  "version": "1.0.0",
  "minAppVersion": "0.15.0",
  "description": "GitHub webhooks integration for Carnival Network",
  "dependencies": {
    "carnival-network": "^1.0.0"
  }
}
```

### Main Plugin (Example)
```typescript
import { Plugin } from 'obsidian';
import { CarnivalPerformerInterface } from 'carnival-network';

export default class GitHubIntegrationPlugin extends Plugin {
  private carnival: CarnivalPerformerInterface;
  
  async onload() {
    // Get Carnival Network instance
    const carnivalPlugin = this.app.plugins.plugins['carnival-network'];
    this.carnival = carnivalPlugin.joinCarnival(
      'github-integration',
      storage,
      config
    );
    
    // Setup GitHub webhook endpoint
    this.registerWebhookHandler();
  }
}
```

---

## Generic Webhook Pattern

Carnival Network will provide (Phase 3.4):
```typescript
POST /api/webhooks/:webhookId

// Generic endpoint that:
// 1. Verifies signature (if configured)
// 2. Emits event to registered plugins
// 3. Lets YOUR plugin handle transformation
```

Your plugin registers to handle specific webhook IDs:
```typescript
carnival.registerWebhookHandler('github-prs', async (payload) => {
  // Your plugin-specific logic
  const act = transformGitHubPR(payload);
  await carnival.broadcastAct(act);
});
```

---

## Key Principles

### Infrastructure (Carnival Network Provides)
- ✅ Network coordination
- ✅ Act storage and broadcasting
- ✅ Territory discovery
- ✅ Authentication framework
- ✅ Generic API endpoints

### Application (Your Plugin Provides)
- ❌ Service-specific payload parsing
- ❌ Service-specific authentication
- ❌ Payload → Act transformation logic
- ❌ Service-specific error handling
- ❌ Service-specific business rules

---

## Need Help?

- Check `CHANGELOG.md` for architectural changes
- Read `.github/docs/integration-guide.md` (coming in Phase 3.4)
- Review Carnival Network source for public API
- Study these examples for integration patterns

---

*"The carnival provides the grounds. The performers bring the acts."* 🎪✨

**Note**: These are reference examples only. They are not compiled or tested as part of the main plugin. Copy and adapt as needed for your integration plugins.
