# Carnival Network Architecture Review
**Date**: 2025-11-17  
**Purpose**: Strategic review of nomenclature, data flow, and service integration philosophy  
**Status**: Recommendations for Phase 3.3+ Implementation

---

## Executive Summary

This document addresses three critical architectural questions raised during Phase 3.3 development:

1. **Nomenclature**: The distinction between `CarnivalPerformer` and `troupe`
2. **Data Flow**: Clear documentation of how each architectural pillar functions
3. **Service Integration**: Whether to maintain internal implementations of GitHub, Beehiiv, Discord, etc.

---

## Question 1: Troupe vs CarnivalPerformer Nomenclature

### Current State Analysis

**In the codebase:**
- `CarnivalPerformer` is the implementation class (`src/network/carnival-network-client.ts`)
- `CarnivalPerformerInterface` is the public API contract (`src/types/public/carnival-client-types.ts`)
- `troupe` appears as a variable name in `src/main.ts` line 37: `private activeTroupes: Map<string, CarnivalPerformer>`
- Each `CarnivalPerformer` instance represents ONE performer (plugin) joining the carnival

**The Confusion:**
The term "troupe" implies a collection of performers, but each `CarnivalPerformer` is actually a **single performer** with their own:
- Territory service access
- Act service instance
- Query service instance  
- Performer cache
- Unique performer ID

### Semantic Analysis

**Troupe** (in theatrical terms):
- A company of performers traveling together
- Multiple actors working as a collective
- Implies group coordination and ensemble performance

**Current Implementation Reality:**
- Each `CarnivalPerformer` = ONE plugin performer
- The `Map<string, CarnivalPerformer>` in `main.ts` = collection of independent performers
- Each performer has independent services and state
- No "troupe-level" coordination beyond network protocol

### Recommendation: **RENAME ONLY THE VARIABLE**

**Reasoning:**
1. **The type name is correct**: `CarnivalPerformer` accurately describes what it is - a client interface to the Carnival Network
2. **The interface name is correct**: `CarnivalPerformerInterface` is the public contract
3. **The variable name is misleading**: `activeTroupes` should be `activePerformers` or `registeredPerformers`

**Proposed Changes:**
```typescript
// src/main.ts (BEFORE)
private activeTroupes: Map<string, CarnivalPerformer> = new Map();

// src/main.ts (AFTER)
private activePerformers: Map<string, CarnivalPerformer> = new Map();

// Update all references:
for (const [performerId, performer] of this.activePerformers.entries()) {
    Log.log(mainLogger, `🎭 Cleaning up performer: ${performerId}`);
    await performer.leaveRing();
}
this.activePerformers.clear();
```

**DO NOT RENAME:**
- ❌ `CarnivalPerformer` → `CarnivalTroupe` (incorrect - single performer, not group)
- ❌ `CarnivalPerformerInterface` → `CarnivalTroupeInterface` (breaks public API)
- ❌ Any type system names (maintains consistency)

**Value of the Distinction:**
- **CarnivalPerformer**: The technical implementation (a client connecting to network services)
- **Performer**: The metaphorical role (a plugin acting in the carnival)
- **Troupe**: Reserved for potential future group coordination features (if ever needed)

---

## Question 2: Data Flow & Architectural Pillars

### The Carnival Architecture: A Complete Picture

The Carnival Network operates through **five core pillars** that handle different aspects of distributed coordination:

---

### **Pillar 1: TERRITORIES** (Location & Registration)
**Purpose**: Where performers establish presence and discover others

**Key Components:**
- `HttpRegistryService` - Communicates with external HTTP registry endpoints
- `TerritoryAccessService` - Provides read-only access to cached performer data
- `PersistentPerformerCache` - LRU cache of known performers (persisted to vault)

**Data Flow:**
```
Plugin → establishTerritory() → HttpRegistryService
    ↓
Registry Endpoint (HTTP)
    ↓
Response → PersistentPerformerCache → TerritoryAccessService
    ↓
Other Services (ActService, CarnivalQueryService)
```

**Key Operations:**
1. **Establish**: `establishTerritory(territory)` - Register performer at territory
2. **Scout**: `scoutTerritories(territory)` - Discover other performers
3. **Heartbeat**: `sendHeartbeat()` - Maintain active presence
4. **Cache**: Performers cached locally for offline access

**Nomenclature:**
- **Territory**: A named location/channel (e.g., "backstage", "github-integrations")
- **Performer**: An Obsidian plugin participating in the network
- **Registry**: External HTTP service maintaining territory membership

---

### **Pillar 2: ACTS** (Content Creation & Synchronization)
**Purpose**: The actual data being shared across the network

**Key Components:**
- `ActService` - Creates, broadcasts, queries acts
- `ArchiveInterface` - Abstraction for storage (in-memory, cache, future database)
- `InMemoryArchive` / `CacheArchive` - Current storage implementations

**Data Flow:**
```
Plugin → createAct() → ActService
    ↓
ArchiveInterface.create() → Storage (in-memory or cached)
    ↓
broadcastAct() → HTTP requests to all target performers
    ↓
Remote performers receive via /carnival/network/broadcast endpoint
```

**Act Structure:**
```typescript
CarnivalAct {
    id: string;           // Unique identifier
    title: string;        // Human-readable title
    territory: string;    // Which territory it belongs to
    actType: 'changelog' | 'conversation';  // Type classification
    content: string;      // The actual data
    metadata: Record<string, unknown>;  // Extensible metadata
    createdAt: string;    // ISO timestamp
    status: 'active' | 'archived' | 'deleted';
    syncPreferences: {    // How to synchronize
        requireAck: boolean;
        broadcastToAll: boolean;
        targetTerritories: string[];
    }
}
```

**Key Operations:**
1. **Create**: `createAct(params)` - Generate new act with unique ID
2. **Broadcast**: `broadcastAct(act)` - Send to all target performers
3. **Query**: `queryActs(options)` - Filter acts by territory, type, status, date range
4. **Count**: `countActs(options)` - Get count matching filters
5. **Search**: `performSearch(options)` - Full-text relevance search

---

### **Pillar 3: QUERIES** (Analytics & Network Intelligence)
**Purpose**: Derive insights from network state and activity

**Key Components:**
- `CarnivalQueryService` - Network topology, analytics, status
- `TerritoryAccessService` - Read access to performer cache

**Data Flow:**
```
Plugin → getQueryService() → CarnivalQueryService
    ↓
TerritoryAccessService.getAllPerformers()
    ↓
Process/aggregate data
    ↓
Return analytics (topology, activity, capabilities)
```

**Key Operations:**
1. **Topology**: `getCarnivalTopology()` - Map of territories and performers
2. **Activity**: `getRecentActivity(hours)` - Recent acts within timeframe
3. **Analytics**: `generateAnalytics()` - Comprehensive statistics
4. **Performer Count**: `getConnectedPerformersCount()` - Active performers
5. **Capabilities**: `aggregateCapabilities()` - What the network can do

**Analytics Output:**
```typescript
AnalyticsData {
    overview: {
        totalPerformers: number;
        totalActs: number;
        activeStatus: 'operational' | 'degraded' | 'offline';
    };
    actMetrics: {
        actsByTerritory: Record<territory, count>;
        actsByType: Record<type, count>;
        recentActivity: Act[];
    };
    performerMetrics: {
        byTerritory: Record<territory, PerformerInfo[]>;
    };
    capabilities: string[];
}
```

---

### **Pillar 4: EXTERNAL API** (REST Endpoints for External Clients)
**Purpose**: Expose network functionality via HTTP REST API

**Key Components:**
- `ExternalAPIService` - Endpoint handlers (Phase 3.3 in progress)
- `APIRouter` - Route registration (Phase 3.3 pending)
- `WebhookHandlers` - Webhook processing (GitHub, Beehiiv)
- `DiscordHandlers` - Discord-specific endpoints
- `AuthHandlers` - Authentication and authorization

**Data Flow:**
```
External Client (Discord bot, webhook, etc.)
    ↓
HTTP Request → Local REST API Plugin → APIRouter
    ↓
ExternalAPIService.handleXXX()
    ↓
ActService / CarnivalQueryService (business logic)
    ↓
APIResponse<T> → HTTP Response
```

**Endpoint Categories:**

**Acts Management:**
- `GET /api/acts` - Query acts with filtering/pagination
- `POST /api/acts` - Create new act
- `GET /api/acts/:id` - Get specific act

**Network Intelligence:**
- `GET /api/carnival/status` - Health and status
- `GET /api/territories` - Available territories
- `GET /api/analytics` - Network analytics

**Search:**
- `POST /api/search` - Cross-vault search

**Webhooks (Phase 3.3.2):**
- `POST /api/webhooks/github` - GitHub events
- `POST /api/webhooks/beehiiv` - Newsletter events

---

### **Pillar 5: OBSERVABILITY** (Monitoring & Metrics)
**Purpose**: Track system health and performance

**Key Components:**
- `MetricsCollector` - In-memory counters and gauges
- `WebhookProvider` - Push metrics to external endpoints
- Prometheus endpoint via Local REST API plugin

**Data Flow:**
```
All Services → globalMetrics.increment() / gauge()
    ↓
MetricsCollector (in-memory registry)
    ↓
    ├── GET /carnival/metrics → Prometheus text format (PULL)
    └── WebhookProvider → POST to webhook (PUSH)
```

**Metrics Tracked:**
- Act operations (creates, broadcasts, queries)
- Network requests (HTTP calls to performers)
- Cache performance (hits, misses, size)
- Territory operations (establishments, scouts)
- Error rates and circuit breaker states

---

## Question 3: Service Integration Philosophy

### Current State: Hardcoded Service Handlers

**What Exists Today:**
```
src/network/handlers/
├── discord-handlers.ts      # Discord-specific endpoints
├── webhook-handlers.ts      # GitHub + Beehiiv webhook processing
├── auth-handlers.ts         # Authentication logic
└── api-handlers.ts          # Generic API endpoints

src/types/public/
├── api-request-types.ts
    └── WebhookRequestBody
        └── source: 'github' | 'beehiiv'

src/network/services/
└── webhook-verifier.ts
    ├── verifyGitHub()       # HMAC-SHA256 with X-Hub-Signature-256
    └── verifyBeehiiv()      # HMAC-SHA256 with custom header
```

**Tight Coupling Examples:**
1. **Discord Handler** (`discord-handlers.ts`):
   - Specific endpoint path: `/api/discord/acts`
   - Custom response format for Discord bots
   - Direct dependency on ActService and CarnivalQueryService

2. **GitHub Webhook** (`webhook-handlers.ts`):
   - Hardcoded payload parsing for GitHub webhook format
   - Signature verification with GitHub-specific header names
   - Creates acts with `metadata.source = 'github'`

3. **Beehiiv Webhook**:
   - Beehiiv-specific event types (`post.published`, `subscriber.created`)
   - Beehiiv payload structure assumptions
   - Signature verification with Beehiiv conventions

4. **Configuration** (`carnival-configuration-types.ts`):
   ```typescript
   integrations?: {
       github?: { webhookSecret?: string; };
       beehiiv?: { webhookSecret?: string; };
   }
   ```

---

### The Strategic Question

**Should the Carnival Network Plugin maintain internal implementations of:**
- GitHub webhook processing
- Beehiiv newsletter integration
- Discord bot endpoints
- Slack handlers
- Custom webhook processors

**Or should it provide:**
- Generic webhook endpoint patterns
- Configurable authentication/verification
- Act creation APIs
- Let consuming plugins implement service-specific logic

---

### Recommendation: **REMOVE SERVICE-SPECIFIC HANDLERS**

### Reasoning: Plugin Philosophy & Architectural Purity

**1. Obsidian Plugin Best Practices**
- **Single Responsibility**: Carnival Network should handle *network coordination*, not *integration logic*
- **Minimal Bundle Size**: Each handler adds dependencies and complexity
- **Maintenance Burden**: GitHub/Beehiiv APIs change, requiring plugin updates
- **User Choice**: Not all users need all integrations

**2. Architectural Separation of Concerns**

The Carnival Network Plugin should be an **infrastructure layer**, not an **application layer**.

**Infrastructure (What Carnival SHOULD Do):**
- ✅ Provide network connectivity (territories, performers, discovery)
- ✅ Handle act synchronization (create, broadcast, query)
- ✅ Expose REST API endpoints (generic patterns)
- ✅ Authenticate external clients (API keys, tokens)
- ✅ Rate limiting and security
- ✅ Observability and metrics

**Application (What Consuming Plugins SHOULD Do):**
- ❌ Parse GitHub webhook payloads
- ❌ Transform Beehiiv events into acts
- ❌ Handle Discord command syntax
- ❌ Implement service-specific business logic

**3. The Wiring Analogy**

Think of Carnival Network as **electrical wiring in a house**:
- The wiring provides power infrastructure (territories, acts, API endpoints)
- Appliances (integrations) plug into the wiring
- You don't hardcode specific appliances into the house's electrical system
- Users choose which appliances (GitHub, Discord, Beehiiv) to plug in

**Currently:**
```
┌─────────────────────────────────────┐
│   Carnival Network Plugin           │
│  (Infrastructure + Integrations)    │
│                                     │
│  ┌────────────┐  ┌────────────┐   │
│  │  GitHub    │  │  Discord   │   │
│  │  Handler   │  │  Handler   │   │
│  └────────────┘  └────────────┘   │
│         TIGHTLY COUPLED             │
└─────────────────────────────────────┘
```

**Proposed:**
```
┌─────────────────────────────────────┐
│   Carnival Network Plugin           │
│       (Infrastructure Only)         │
│                                     │
│  ┌──────────────────────────────┐  │
│  │  Generic REST API Endpoints  │  │
│  │  • POST /api/acts            │  │
│  │  • POST /api/webhooks/:id    │  │
│  │  • Authentication            │  │
│  └──────────────────────────────┘  │
└─────────────────────────────────────┘
          ↑            ↑            ↑
          │            │            │
    ┌─────────┐  ┌─────────┐  ┌─────────┐
    │ GitHub  │  │ Discord │  │ Beehiiv │
    │ Plugin  │  │ Plugin  │  │ Plugin  │
    └─────────┘  └─────────┘  └─────────┘
    (User installs what they need)
```

---

### Implementation Strategy

#### Phase 1: Document Generic Patterns (Immediate)

Create documentation for consuming plugins:

**File**: `.github/docs/integration-guide.md`
```markdown
# Integrating External Services with Carnival Network

## Generic Webhook Pattern

1. Register webhook endpoint with external service (GitHub, etc.)
2. Service sends POST request to your plugin's endpoint
3. Your plugin validates signature (if needed)
4. Transform payload to CarnivalAct format
5. Use Carnival Network API to broadcast

## Example: GitHub Integration Plugin

```typescript
// In your plugin
const carnivalClient = app.plugins.plugins['carnival-network']
    .joinCarnival('github-integration', storage, config);

// Receive GitHub webhook
app.registerObsidianProtocolHandler('github-webhook', async (params) => {
    const payload = validateGitHubWebhook(params);
    
    const act: CarnivalAct = {
        id: generateId(),
        title: `PR: ${payload.pull_request.title}`,
        territory: 'github',
        actType: 'changelog',
        content: formatPullRequest(payload),
        // ... rest of act data
    };
    
    await carnivalClient.broadcastAct(act);
});
```
```

#### Phase 2: Deprecate Service Handlers (Phase 3.4)

**Files to Deprecate:**
```
src/network/handlers/
├── discord-handlers.ts      # → REMOVE
├── webhook-handlers.ts      # → REMOVE (GitHub/Beehiiv logic)
└── auth-handlers.ts         # → KEEP (generic auth)

src/network/services/
└── webhook-verifier.ts      # → REMOVE (service-specific verification)

src/types/public/
├── api-request-types.ts
    └── Remove: WebhookRequestBody with hardcoded sources
```

**Files to Keep/Enhance:**
```
src/network/handlers/
└── api-handlers.ts          # → ENHANCE (generic endpoints)

src/network/
├── external-api-service.ts  # → KEEP (generic API service)
└── api-router.ts            # → CREATE (generic routing)
```

#### Phase 3: Generic Webhook Endpoint (Phase 3.4)

**New Pattern:**
```typescript
// Generic webhook endpoint - no service knowledge
POST /api/webhooks/:webhookId

// Configuration in vault
webhooks:
  - id: "github-pr-notifications"
    target_territory: "github"
    authentication:
      type: "hmac-sha256"
      secret: "{{stored-in-secure-plugin}}"
      header: "X-Hub-Signature-256"
```

**Processing:**
1. Carnival Network validates webhook ID exists
2. Carnival Network verifies authentication (if configured)
3. Carnival Network emits event to registered plugins
4. **Integration plugin** handles payload transformation
5. Integration plugin uses Carnival API to create/broadcast act

---

### Migration Path for Existing Integrations

**For Users Currently Using Discord/GitHub/Beehiiv Handlers:**

**Option A: Keep as Examples** (Compromise)
- Move handlers to `examples/` directory
- Document as reference implementations
- Not part of core plugin bundle
- Users can copy/adapt as needed

**Option B: Separate Plugins** (Recommended)
- Create companion plugins:
  - `carnival-network-github` - GitHub integration
  - `carnival-network-discord` - Discord bot integration
  - `carnival-network-newsletter` - Beehiiv/newsletter integration
- Each depends on `carnival-network` as infrastructure
- Users install only what they need
- Cleaner maintenance and updates

**Option C: Plugin Marketplace Pattern** (Future)
- Carnival Network provides plugin SDK
- Community/users create integration plugins
- Published to Obsidian community plugins
- Natural ecosystem growth

---

### Benefits of Removing Service-Specific Logic

**Technical:**
- ✅ Smaller bundle size (fewer dependencies)
- ✅ Faster plugin load time
- ✅ Less attack surface (fewer external API calls)
- ✅ Cleaner separation of concerns
- ✅ Easier to test (fewer mocks needed)

**Architectural:**
- ✅ Truly agnostic infrastructure
- ✅ No coupling to external service APIs
- ✅ No breaking changes when services update
- ✅ Extensible without modifying core plugin

**User Experience:**
- ✅ Users install only what they need
- ✅ Clearer plugin purpose (network infrastructure)
- ✅ Better performance (no unused code)
- ✅ More control over integrations

**Maintenance:**
- ✅ Core plugin doesn't break when GitHub API changes
- ✅ Integration updates don't require core plugin release
- ✅ Community can contribute integrations independently
- ✅ Focused issue tracking (network vs integration bugs)

---

## Summary of Recommendations

### 1. Nomenclature (Small Change)
**Action**: Rename variable only
- ✅ Change `activeTroupes` → `activePerformers` in `main.ts`
- ❌ Don't rename `CarnivalPerformer` (correct as-is)
- ❌ Don't rename `CarnivalPerformerInterface` (correct as-is)

**Impact**: Minor code change, improves clarity

---

### 2. Data Flow Documentation (New Document)
**Action**: Create comprehensive architecture guide
- ✅ Document all five pillars (Territories, Acts, Queries, External API, Observability)
- ✅ Show data flow diagrams for each pillar
- ✅ Explain how pillars interact
- ✅ Provide examples of common operations

**Impact**: Better onboarding, clearer mental model

**Proposed File**: `.github/docs/architecture-data-flow.md`

---

### 3. Service Integration (Strategic Change)
**Action**: Remove service-specific handlers

**Immediate (Phase 3.3 Completion):**
- ✅ Complete generic API endpoints
- ✅ Document generic webhook patterns
- ✅ Mark service handlers as deprecated

**Short-term (Phase 3.4):**
- ✅ Move Discord/GitHub/Beehiiv handlers to `examples/` or separate plugins
- ✅ Remove from core plugin bundle
- ✅ Update documentation with migration guide

**Long-term (Phase 4+):**
- ✅ Plugin SDK for integration authors
- ✅ Community integration ecosystem
- ✅ Marketplace/registry of Carnival integrations

**Impact**: Major architectural improvement, long-term maintainability

---

## Proposed Next Steps

1. **Immediate** (This Session):
   - Rename `activeTroupes` → `activePerformers`
   - Document this decision in CHANGELOG

2. **Phase 3.3 Completion** (Current Sprint):
   - Complete generic API endpoints (in progress)
   - Add deprecation warnings to service handlers
   - Create integration guide documentation

3. **Phase 3.4** (Next Sprint):
   - Move service handlers to examples/separate plugins
   - Implement generic webhook endpoint pattern
   - Create migration guide for existing users

4. **Phase 4+** (Future):
   - Plugin SDK documentation
   - Example integration plugins
   - Community contribution guidelines

---

## Conclusion

The Carnival Network Plugin is at a critical architectural decision point. The current path includes service-specific integrations that:
- Increase bundle size and complexity
- Create maintenance burden
- Couple infrastructure to application logic
- Limit extensibility

**Recommendation**: Embrace the **infrastructure-only** philosophy.

The carnival provides the *stage*, the *lights*, and the *sound system*. Let the performers bring their own acts. This creates a sustainable, maintainable, and truly agnostic network coordination layer.

**Strategic Vision:**
```
Carnival Network = The Venue (infrastructure)
Integration Plugins = The Performers (applications)
User's Vault = The Show (coordinated experience)
```

This separation enables:
- ✅ Focused development (network vs integrations)
- ✅ Community contributions (anyone can build integrations)
- ✅ User choice (install only needed integrations)
- ✅ Long-term sustainability (no coupling to external APIs)

---

*"The carnival provides the grounds. The performers bring the magic."* 🎪✨

---

**End of Architecture Review**
