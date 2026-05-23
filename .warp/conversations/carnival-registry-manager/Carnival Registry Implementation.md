# 🎪 Carnival Registry Implementation Guide

## Overview

This guide documents the Coordinator/Intern pattern implementation for the Carnival Network registry services. The refactoring separates concerns between infrastructure management (Coordinator) and protocol execution (Intern).

---

## Architecture Pattern: Coordinator/Intern

### The Metaphor

Think of this like a booking office at a carnival:

- **The Coordinator (CarnivalRegistryManager)** is the booking agent who:
  - Knows the carnival infrastructure (Local REST API, Obsidian plugins)
  - Sets up the booking office (endpoints, health monitoring)
  - Builds performer information (detects capabilities)
  - Manages credentials (API keys)
  - Hires and instructs the intern

- **The Intern (CarnivalRegistryService)** is the worker who:
  - Makes phone calls (HTTP requests) as instructed
  - Follows the registration protocol
  - Updates the filing cabinet (cache) with results
  - Uses tools given by the coordinator
  - **Does NOT** access the safe (secure storage)

```
┌─────────────────────────────────┐
│ CarnivalRegistryManager         │
│ (The Booking Agent/Coordinator) │
│                                 │
│ • Has secure storage access 🔐  │
│ • Knows carnival infrastructure │
│ • Detects capabilities          │
│ • Manages API keys              │
│ • Creates the intern            │
└────────────┬────────────────────┘
             │ creates & instructs
             │ passes API keys as parameters
             ↓
┌─────────────────────────────────┐
│ CarnivalRegistryService         │
│ (The Protocol Intern)           │
│                                 │
│ • NO secure storage access ❌   │
│ • Receives API keys as params   │
│ • Executes HTTP protocol        │
│ • Updates cache with discoveries│
│ • Reports results               │
└─────────────────────────────────┘
```

---

## Key Design Decisions

### 1. **Credential Management: Coordinator Only**

**Critical Rule:** The intern NEVER accesses secure storage directly.

#### ❌ Wrong Pattern:
```typescript
// BAD: Intern accessing storage
class CarnivalRegistryService {
  constructor(
    private app: App,
    private store: APIKeyStore  // ❌ NO!
  ) {}
  
  async establishTerritory(info) {
    const key = await this.store.retrieve('registry_key'); // ❌ NO!
    // ...
  }
}
```

#### ✅ Correct Pattern:
```typescript
// GOOD: Intern receives keys as parameters
class CarnivalRegistryService {
  constructor(
    private app: App,
    // ✅ NO store parameter
  ) {}
  
  async establishTerritory(info, apiKeyMap: Map<string, string>) {
    const key = apiKeyMap.get(registryUrl); // ✅ Uses provided keys
    // ...
  }
}

// Coordinator manages keys
class CarnivalRegistryManager {
  constructor(
    private plugin: Plugin,
    private store: APIKeyStore  // ✅ Coordinator has store
  ) {}
  
  async establishTerritory(territory, info) {
    // Build API key map
    const apiKeyMap = await this.buildAPIKeyMap();
    
    // Pass keys to intern
    return this.httpService.establishTerritory(territory, info, apiKeyMap);
  }
}
```

### 2. **Infrastructure Detection: Coordinator Only**

The coordinator knows about the carnival's infrastructure (Obsidian, plugins, vault paths).

```typescript
// CarnivalRegistryManager (Coordinator)
class CarnivalRegistryManager {
  // Coordinator detects capabilities
  private async detectCapabilities(): Promise<string[]> {
    const { plugins } = this.plugin.app.plugins;
    // Check for Local REST API, Templater, Dataview, etc.
    // ...
  }
  
  // Coordinator detects platform
  private detectPlatform(): string {
    // Analyze user agent
    // ...
  }
  
  // Coordinator detects territory
  private detectTerritory(vaultPath: string): string {
    // Analyze vault path
    // ...
  }
  
  // Coordinator builds complete performer info
  async buildPerformerInfo(performerId: string) {
    return {
      performerId,
      territoryName: this.detectTerritory(vaultPath),
      endpoint: `http://localhost:${this.localApiPort}`,
      capabilities: await this.detectCapabilities(),
      metadata: {
        platform: this.detectPlatform(),
        // ...
      }
    };
  }
}
```

### 3. **Dependency Injection: Tools from Coordinator**

The coordinator creates the intern and gives them the tools they need.

```typescript
// CarnivalRegistryManager constructor
constructor(plugin, store) {
  // 1. Initialize infrastructure
  this.initializeBookingOffice();
  
  // 2. Create cache
  this.performerCache = new PersistentPerformerCache(plugin.app);
  
  // 3. Create intern with dependencies (NO store!)
  this.httpService = new CarnivalRegistryService(
    plugin.app,              // For vault access
    this.endpointManager,    // For health monitoring
    this.performerCache      // For caching discoveries
  );
}
```

---

## File Structure

```
src/network/
├── carnival-registry-manager.ts      (Coordinator - 600 lines)
│   ├── Infrastructure initialization
│   ├── Capability detection
│   ├── API key management
│   ├── Registration tracking
│   └── Delegates to intern
│
├── carnival-registry-service.ts      (Intern - 700 lines)
│   ├── HTTP protocol execution
│   ├── Registry queries
│   ├── Cache management
│   └── Heartbeat transmission
│
├── carnival-registry-utils.ts        (Utilities - 150 lines)
│   ├── fetchWithRetry
│   ├── fetchWithTimeout
│   └── TLS certificate validation
│
├── registry-endpoint-manager.ts      (Health Monitor)
│   ├── Circuit breakers
│   ├── Health states
│   └── Metrics collection
│
└── persistent-performer-cache.ts     (Cache)
    ├── Performer storage
    └── Query methods
```

---

## Integration with main.ts

### Initialization

```typescript
// In CarnivalNetworkPlugin.onload()
export default class CarnivalNetworkPlugin extends Plugin {
  public registryManager?: CarnivalRegistryManager;
  
  async onload() {
    // ... other initialization
    
    this.app.workspace.onLayoutReady(async () => {
      // Get secure store
      const secureStorePlugin = getPlugin(this.app, 'secure-store');
      if (secureStorePlugin && isSecureStorePlugin(secureStorePlugin)) {
        const storage = await secureStorePlugin.createStorage('carnival-network');
        
        // Initialize registry manager (coordinator)
        this.registryManager = new CarnivalRegistryManager(this, storage);
      }
    });
  }
}
```

### Performer Lifecycle

```typescript
// When a performer joins
joinCarnival(performerId: string, store: APIKeyStore, config: CarnivalConfig) {
  // Create performer
  const performer = new CarnivalPerformer(this.app, config, store, performerId);
  this.activePerformers.set(performerId, performer);
  
  // Register with registry manager
  this.registryManager?.registerPerformer(performerId);
  
  return performer;
}

// When a performer leaves
async leaveCarnival(performerId: string) {
  const performer = this.activePerformers.get(performerId);
  if (performer) {
    await performer.cleanup();
    this.activePerformers.delete(performerId);
    
    // Unregister from registry manager
    this.registryManager?.unregisterPerformer(performerId);
  }
}
```

### Using the Registry Manager

```typescript
// Build performer info
const info = await this.registryManager.buildPerformerInfo('my-performer');

// Register with network
await this.registryManager.establishTerritory('backstage', info);

// Query for other performers
const performers = await this.registryManager.scoutTerritories('backstage');

// Send heartbeat (coordinator handles API keys)
await this.registryManager.sendHeartbeat();

// Unregister
await this.registryManager.abandonTerritory();
```

---

## API Flow Examples

### 1. Establishing Territory

```typescript
// User calls coordinator
await registryManager.establishTerritory('backstage', performerInfo);

// Coordinator execution:
class CarnivalRegistryManager {
  async establishTerritory(territory, performerInfo) {
    // 1. Build API key map from secure storage
    const apiKeyMap = await this.buildAPIKeyMap();
    // apiKeyMap = Map {
    //   'https://registry1.com' => 'key1',
    //   'http://localhost:27123' => 'key2'
    // }
    
    // 2. Pass keys to intern
    return this.httpService.establishTerritory(territory, performerInfo, apiKeyMap);
  }
  
  private async buildAPIKeyMap(): Map<string, string> {
    const map = new Map();
    for (const endpoint of this.getEndpoints()) {
      const key = await this.store.retrieve(`registry_${endpoint}`);
      if (key) map.set(endpoint, key);
    }
    return map;
  }
}

// Intern execution:
class CarnivalRegistryService {
  async establishTerritory(territory, performerInfo, apiKeyMap) {
    // Build performer object
    const performer = { /* ... */ };
    this.currentPerformer = performer;
    this.currentApiKeyMap = apiKeyMap; // Store for heartbeat
    
    // Register with each endpoint
    for (const registryUrl of this.getRegistryEndpoints()) {
      const apiKey = apiKeyMap.get(registryUrl); // Use provided key
      await this.registerWithRegistry(registryUrl, performer, apiKey);
    }
    
    // Start heartbeat
    this.startHeartbeat();
  }
}
```

### 2. Sending Heartbeat

```typescript
// User calls coordinator
await registryManager.sendHeartbeat();

// Coordinator execution:
class CarnivalRegistryManager {
  async sendHeartbeat() {
    // Build fresh API key map (keys might have changed)
    const apiKeyMap = await this.buildAPIKeyMap();
    
    // Pass to intern
    return this.httpService.sendHeartbeat(apiKeyMap);
  }
}

// Intern execution:
class CarnivalRegistryService {
  async sendHeartbeat(apiKeyMap) {
    // Update stored keys
    this.currentApiKeyMap = apiKeyMap;
    
    // Update timestamp
    this.currentPerformer.lastSeen = new Date().toISOString();
    
    // Send to each endpoint
    for (const registryUrl of this.getRegistryEndpoints()) {
      const apiKey = apiKeyMap.get(registryUrl); // Use provided key
      await this.makeAPIRequest(
        registryUrl,
        '/carnival/network/heartbeat',
        'POST',
        apiKey,
        { performer: this.currentPerformer, timestamp: new Date() }
      );
    }
  }
}
```

### 3. Building Performer Info

```typescript
// User calls coordinator
const info = await registryManager.buildPerformerInfo('my-performer');

// Coordinator execution:
class CarnivalRegistryManager {
  async buildPerformerInfo(performerId) {
    const vault = this.plugin.app.vault;
    const vaultPath = vault.adapter.path;
    
    return {
      performerId,
      territoryName: this.detectTerritory(vaultPath),     // Coordinator detects
      endpoint: `http://localhost:${this.localApiPort}`,  // Coordinator knows
      capabilities: await this.detectCapabilities(),      // Coordinator detects
      metadata: {
        platform: this.detectPlatform(),                  // Coordinator detects
        vaultPath,
        apiPort: this.localApiPort,
        // ...
      }
    };
  }
}
```

---

## Testing Strategy

### Unit Tests

#### Test Coordinator (CarnivalRegistryManager)

```typescript
describe('CarnivalRegistryManager', () => {
  it('should initialize booking office', () => {
    const manager = new CarnivalRegistryManager(mockPlugin, mockStore);
    expect(manager.getEndpoints()).toBeDefined();
  });
  
  it('should detect capabilities', async () => {
    const info = await manager.buildPerformerInfo('test');
    expect(info.capabilities).toContain('http_communication');
  });
  
  it('should manage API keys', async () => {
    await manager.storeRegistryAPIKey('http://localhost', 'key123');
    const key = await manager.getRegistryAPIKey('http://localhost');
    expect(key).toBe('key123');
  });
  
  it('should pass API keys to intern', async () => {
    const spy = jest.spyOn(manager['httpService'], 'establishTerritory');
    await manager.establishTerritory('backstage', mockInfo);
    expect(spy).toHaveBeenCalledWith(
      'backstage',
      mockInfo,
      expect.any(Map) // apiKeyMap
    );
  });
});
```

#### Test Intern (CarnivalRegistryService)

```typescript
describe('CarnivalRegistryService', () => {
  it('should accept dependencies without store', () => {
    const intern = new CarnivalRegistryService(
      mockApp,
      mockEndpointManager,
      mockCache
      // NO store parameter ✅
    );
    expect(intern).toBeDefined();
  });
  
  it('should use API keys from parameters', async () => {
    const apiKeyMap = new Map([['http://localhost', 'key123']]);
    await intern.establishTerritory('backstage', mockInfo, apiKeyMap);
    // Verify key was used in HTTP request
  });
  
  it('should update cache after discovery', async () => {
    const performers = await intern.scoutTerritories('backstage');
    expect(mockCache.values()).toHaveLength(performers.length);
  });
  
  it('should NOT access secure storage', () => {
    // Verify intern has no store property
    expect((intern as any).store).toBeUndefined();
  });
});
```

### Integration Tests

```typescript
describe('Registry Integration', () => {
  it('should complete full registration flow', async () => {
    // 1. Build performer info (coordinator)
    const info = await manager.buildPerformerInfo('test-performer');
    
    // 2. Establish territory (coordinator → intern with API keys)
    await manager.establishTerritory('backstage', info);
    
    // 3. Verify registration (intern updated cache)
    const performers = await manager.getAllPerformers();
    expect(performers).toContainEqual(expect.objectContaining({
      performerId: 'test-performer'
    }));
    
    // 4. Send heartbeat (coordinator passes fresh keys)
    await manager.sendHeartbeat();
    
    // 5. Abandon territory (cleanup)
    await manager.abandonTerritory();
  });
});
```

---

## Common Patterns

### Pattern 1: Coordinator Delegates with Credentials

```typescript
// Coordinator method
async someOperation() {
  const apiKeyMap = await this.buildAPIKeyMap();
  return this.httpService.someOperation(apiKeyMap);
}
```

### Pattern 2: Intern Receives and Uses Credentials

```typescript
// Intern method
async someOperation(apiKeyMap: Map<string, string>) {
  const endpoints = this.getRegistryEndpoints();
  for (const endpoint of endpoints) {
    const apiKey = apiKeyMap.get(endpoint) || null;
    await this.makeAPIRequest(endpoint, '/path', 'POST', apiKey, data);
  }
}
```

### Pattern 3: Coordinator Detects, Intern Executes

```typescript
// Coordinator builds data
async buildSomething() {
  return {
    detectedField: this.detectSomething(),  // Coordinator knows infrastructure
    computedField: await this.computeSomething(),
    // ...
  };
}

// Coordinator passes to intern
const data = await this.buildSomething();
await this.httpService.doSomething(data, apiKeyMap);

// Intern executes protocol
async doSomething(data, apiKeyMap) {
  // Use data and credentials to execute HTTP protocol
}
```

---

## Migration Checklist

When refactoring existing code:

- [ ] Remove `store` parameter from intern constructor
- [ ] Remove `store` from intern class properties
- [ ] Add `apiKeyMap: Map<string, string>` parameter to protocol methods
- [ ] Update coordinator to build API key maps before calling intern
- [ ] Move capability detection to coordinator
- [ ] Move platform detection to coordinator
- [ ] Move territory detection to coordinator
- [ ] Move API key management methods to coordinator
- [ ] Update method signatures in TerritoryServiceInterface
- [ ] Update all call sites to pass API key maps
- [ ] Update documentation and comments
- [ ] Add tests for credential separation
- [ ] Verify intern never accesses `store`

---

## Benefits of This Pattern

### 1. **Clear Separation of Concerns**
- Coordinator: Infrastructure & credentials
- Intern: Protocol execution

### 2. **Security**
- Credentials isolated to coordinator
- Intern can't accidentally leak credentials
- Easier to audit credential access

### 3. **Testability**
- Can test intern with mock credentials
- Can test coordinator's credential management independently
- No need to mock secure storage when testing protocol

### 4. **Flexibility**
- Easy to swap credential sources
- Easy to add credential rotation
- Easy to test different authentication schemes

### 5. **Maintainability**
- Single source of truth for credentials (coordinator)
- Protocol changes isolated to intern
- Infrastructure changes isolated to coordinator

---

## Anti-Patterns to Avoid

### ❌ Anti-Pattern 1: Intern Accessing Storage

```typescript
// BAD: Intern accessing secure storage
class CarnivalRegistryService {
  async sendHeartbeat() {
    const key = await this.store.retrieve('key'); // ❌ NO!
  }
}
```

### ❌ Anti-Pattern 2: Passing Store to Intern

```typescript
// BAD: Giving intern storage access
new CarnivalRegistryService(app, endpointManager, cache, store); // ❌ NO!
```

### ❌ Anti-Pattern 3: Intern Detecting Infrastructure

```typescript
// BAD: Intern knowing about Obsidian plugins
class CarnivalRegistryService {
  private detectCapabilities() {
    const plugins = this.app.plugins; // ❌ Coordinator's job!
  }
}
```

### ❌ Anti-Pattern 4: Not Passing API Keys

```typescript
// BAD: Coordinator not passing credentials
async establishTerritory(territory, info) {
  // ❌ Missing apiKeyMap parameter
  return this.httpService.establishTerritory(territory, info);
}
```

---

## Troubleshooting

### Problem: "Cannot read property 'store' of undefined"

**Solution:** Intern is trying to access `store`. Remove all storage access from intern.

### Problem: "API key is null"

**Solution:** Coordinator isn't building API key map or isn't passing it to intern.

```typescript
// Fix: Build and pass API key map
const apiKeyMap = await this.buildAPIKeyMap();
await this.httpService.someMethod(apiKeyMap);
```

### Problem: "Method signature mismatch"

**Solution:** Update TerritoryServiceInterface to include `apiKeyMap` parameter.

```typescript
interface TerritoryServiceInterface {
  establishTerritory(
    territory: string,
    info: PerformerRegistrationInfo,
    apiKeyMap: Map<string, string>  // Add this
  ): Promise<void>;
}
```

---

## Future Enhancements

### 1. Credential Rotation

```typescript
// Coordinator can rotate keys
async rotateRegistryKey(registryUrl: string) {
  const newKey = await generateNewKey();
  await this.storeRegistryAPIKey(registryUrl, newKey);
  
  // Update intern's current key map
  const apiKeyMap = await this.buildAPIKeyMap();
  this.httpService.updateAPIKeyMap(apiKeyMap);
}
```

### 2. Multi-Tenant Support

```typescript
// Coordinator manages keys per tenant
async buildAPIKeyMap(tenantId: string) {
  // Retrieve tenant-specific keys
}
```

### 3. Credential Caching

```typescript
// Coordinator caches keys to reduce storage calls
private apiKeyCache = new Map<string, { key: string; expires: number }>();

async getRegistryAPIKey(registryUrl: string) {
  const cached = this.apiKeyCache.get(registryUrl);
  if (cached && cached.expires > Date.now()) {
    return cached.key;
  }
  // Fetch from storage and cache
}
```

---

## Conclusion

The Coordinator/Intern pattern provides a clean separation between infrastructure management (coordinator) and protocol execution (intern). The key principle is:

**The coordinator manages credentials and infrastructure knowledge. The intern executes the protocol with tools and credentials provided by the coordinator.**

This pattern improves security, testability, and maintainability while making the codebase easier to understand and modify.