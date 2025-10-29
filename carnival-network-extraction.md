# 🎪 Carnival Network Plugin - Extraction Plan

## Overview
Extract the network functionality from Carnival Records into a standalone, reusable **Carnival Network** plugin following the same pattern used for Secure Storage.

## 🎭 Why Keep the Carnival Theme?
**Because why the fuck not!** The carnival theme:
- Makes the code fun and memorable
- Creates a cohesive brand across plugins
- Differentiates from boring "enterprise" naming
- Reflects the playful, creative spirit of the project

## 🏗️ Architecture

### Plugin Dependencies
```
Carnival Records (consumer)
    ↓ requires
Carnival Network Plugin
    ↓ requires  
Secure Storage Plugin
    ↓ uses
Local REST API Plugin
```

### Key Terminology Changes
| Old (Generic) | New (Carnival-Themed) |
|--------------|---------------------|
| Network Client | Carnival Network Client |
| initialize() | enterRing() |
| cleanup() | leaveRing() |
| isInitialized() | isPerforming() |
| Records | Acts |
| Nodes | Territory Nodes |
| Status: online/offline/degraded | performing/intermission/finale |
| Registered Clients | Performers |
| Node Registration | Establishing Territory |
| Discovery | Scouting Territories |

## 📦 What Moves to Carnival Network

### Core Files (Already in Place)
```
src/
├── main.ts                           # Plugin entry point
├── types/
│   ├── index.ts                      # Public API types
│   └── internal.ts                   # Internal implementation types
├── network/
│   ├── carnival-network-client.ts    # Main client (renamed from network-client.ts)
│   ├── http-registry-service.ts
│   ├── http-client.ts
│   ├── http-network-protocol.ts
│   ├── circuit-breaker.ts
│   ├── persistent-node-cache.ts
│   ├── registry-endpoint-manager.ts
│   ├── certificate-store.ts
│   ├── validation.ts
│   ├── settings-validation.ts
│   ├── utils/
│   │   ├── certificates.ts
│   │   └── client-authentication.ts
│   ├── services/
│   │   ├── act-service.ts            # Renamed from record-service.ts
│   │   ├── territory-access-service.ts # Renamed from registry-access-service.ts
│   │   ├── carnival-query-service.ts  # Renamed from network-query-service.ts
│   │   ├── rate-limiter.ts
│   │   └── webhook-verifier.ts
│   └── handlers/
│       ├── webhook-handlers.ts       # Generic base
│       ├── discord-webhook-handler.ts # Specific implementation
│       ├── auth-handlers.ts
│       ├── search-handlers.ts
│       └── error-handler.ts
└── ui/
    └── settings-tab.ts               # Plugin settings UI
```

## 🎪 Public API

### Main Plugin Interface
```typescript
export default class CarnivalNetworkPlugin extends Plugin {
  // Join the carnival - create a network client
  public joinCarnival(
    performerId: string,
    storage: APIKeyStorage,
    config: CarnivalConfiguration
  ): ICarnivalNetworkClient;
  
  // Get list of performers
  public getPerformers(): string[];
  
  // Check if performer has troupe
  public hasTroupe(performerId: string): boolean;
  
  // Leave the carnival
  public async leaveCarnival(performerId: string): Promise<void>;
}
```

### Carnival Network Client Interface
```typescript
export interface ICarnivalNetworkClient {
  // Lifecycle
  enterRing(): Promise<void>;
  leaveRing(): Promise<void>;
  isPerforming(): boolean;

  // Territory Management
  establishTerritory(territory: string): Promise<void>;
  scoutTerritories(territory: string): Promise<TerritoryNode[]>;
  updatePerformanceStatus(status: Partial<PerformanceStatus>): Promise<void>;

  // Act Operations
  broadcastAct(record: CarnivalRecord): Promise<void>;
  queryActs(options: ActQueryOptions): CarnivalRecord[];
  countActs(options: ActCountOptions): number;
  searchCarnival(options: SearchOptions): SearchResult[];

  // Backstage Access (advanced)
  getTerritoryService(): ITerritoryService;
  getQueryService(): IQueryService;
  getActService(): IActService;

  // Configuration
  getShowConfiguration(): CarnivalConfiguration;
  updateShowConfiguration(config: Partial<CarnivalConfiguration>): void;
}
```

## 🔄 How Carnival Records Uses It

```typescript
// In carnival-records/src/main.ts
async onload() {
  // 1. Get secure storage
  const secureStorage = getPlugin(this.app, 'obsidian-secure-storage');
  this.storage = secureStorage.createStorage('carnival-records');

  // 2. Get carnival network
  const networkPlugin = getPlugin(this.app, 'carnival-network');
  
  // 3. Join the carnival!
  this.carnivalNetwork = networkPlugin.joinCarnival(
    'carnival-records',
    this.storage,
    this.networkSettings
  );

  // 4. Enter the ring
  await this.carnivalNetwork.enterRing();

  // 5. Use network features
  await this.carnivalNetwork.establishTerritory('backstage');
  const nodes = await this.carnivalNetwork.scoutTerritories('backstage');
}

async onunload() {
  await this.carnivalNetwork.leaveRing();
}
```

## 🎨 White-Labeling Webhooks

### Generic Base Class
```typescript
// handlers/webhook-handlers.ts
export interface IWebhookHandler {
  handleIncoming(payload: unknown): Promise<void>;
  formatOutgoing(record: CarnivalRecord): unknown;
  verify(payload: unknown, signature: string): boolean;
}
```

### Specific Implementations
```typescript
// handlers/discord-webhook-handler.ts
export class DiscordWebhookHandler implements IWebhookHandler {
  async handleIncoming(payload: DiscordPayload): Promise<void> {
    // Discord-specific logic
  }
  
  formatOutgoing(record: CarnivalRecord): DiscordEmbed {
    // Format as Discord embed
  }
}

// handlers/slack-webhook-handler.ts (future)
export class SlackWebhookHandler implements IWebhookHandler {
  // Slack-specific implementation
}
```

## 🔧 Required Refactoring

### Service Renames
1. `RecordService` → `ActService`
2. `RegistryAccessService` → `TerritoryAccessService`
3. `NetworkQueryService` → `CarnivalQueryService`
4. `HttpRegistryService` → Keep name (still technically a registry)

### Type Renames
1. `CrossVaultRecord` → `CarnivalRecord`
2. `RecordService` → `ActService`
3. `RegistryNode` → `TerritoryNode`
4. `NodeStatus` → `PerformanceStatus`
5. `NetworkConfiguration` → `CarnivalConfiguration`

### Update Imports
All internal files need to import from `../types` instead of referencing Carnival Records types.

## 📋 TODO Checklist

- [ ] Rename files and classes to carnival theme
- [ ] Update all type references
- [ ] Update imports to use local types
- [ ] Create settings tab UI
- [ ] Add logging with carnival emojis (🎪 🎭 🎉 🔍 📢)
- [ ] Write README.md for the plugin
- [ ] Create manifest.json
- [ ] Set up build configuration
- [ ] Test basic functionality
- [ ] Test with Carnival Records integration
- [ ] Add error messages with carnival flair
- [ ] Document webhook handler extension pattern

## 🎯 Benefits of This Approach

1. **Separation of Concerns**: Network logic is independent
2. **Reusability**: Any plugin can join the carnival
3. **Optional Features**: Users can skip network features
4. **Maintainability**: Easier to update network code
5. **Fun Factor**: The carnival theme makes development enjoyable!
6. **Extensibility**: Easy to add new webhook handlers
7. **Clean Architecture**: Clear boundaries between plugins

## 🚀 Next Steps

1. **Finish type refactoring** - Complete carnival-themed renames
2. **Update internal services** - Rename and update imports
3. **Create UI** - Settings tab for managing performers
4. **Test integration** - Ensure Carnival Records works with new plugin
5. **Documentation** - Write comprehensive README
6. **Publish** - Submit to Obsidian Community Plugins

---

**The show must go on!** 🎪✨