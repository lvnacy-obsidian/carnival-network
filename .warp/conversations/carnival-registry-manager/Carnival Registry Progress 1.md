**GREAT CATCH!** Let me audit ALL the methods in `HttpRegistryService` and categorize them properly:

## 🔍 Complete Method Audit

### ✅ **KEEP (Protocol - Intern's Job)**

#### Public Protocol Methods:
- `establishTerritory()` - Register with registries
- `abandonTerritory()` - Unregister from registries
- `scoutTerritories()` - Query for performers
- `sendHeartbeat()` - Send periodic heartbeat
- `broadcastPerformerUpdate()` - Notify of changes
- `findPerformers()` - Search cached performers
- `findPerformersByTerritory()` - Filter by territory
- `getAllPerformers()` - Get all cached
- `isAvailable()` - Check if ready
- `getRegistryHealth()` - Delegate to endpoint manager
- `getRegistryMetrics()` - Delegate to endpoint manager
- `getNetworkTopology()` - Network overview
- `cleanup()` - Teardown

#### Private Protocol Helpers:
- `makeAPIRequest()` - HTTP requests with auth/TLS ✅
- `queryRegistry()` - Query specific registry ✅
- `registerWithRegistry()` - Register with specific registry ✅
- `discoverPerformers()` - Multi-registry discovery ✅
- `deduplicatePerformers()` - Remove duplicates ✅
- `performerToRegistryEntry()` - Convert format ✅
- `simpleHash()` - Generate hash ✅

#### Private Heartbeat Management:
- `startHeartbeat()` - Start interval ✅
- `stopHeartbeat()` - Stop interval ✅

#### Private Cache Management:
- `updateLocalCache()` - Update performer cache ✅
- `getRegisteredPerformers()` - Get from cache ✅

---

### ❌ **REMOVE (Coordinator's Job)**

#### Registry API Key Methods - MOVE TO COORDINATOR:
- `storeRegistryAPIKey()` ❌ → Move to CarnivalRegistryService
- `getRegistryAPIKey()` ❌ → Move to CarnivalRegistryService  
- `removeRegistryAPIKey()` ❌ → Move to CarnivalRegistryService

**Why?** The coordinator manages API keys and passes them to the intern when needed.

#### Performer Detection - ALREADY MOVED:
- `detectCapabilities()` ❌ → Already in CarnivalRegistryService
- `detectPlatform()` ❌ → Already in CarnivalRegistryService
- `detectTerritory()` ❌ → Already in CarnivalRegistryService
- `getCurrentPerformerInfo()` ❌ → Replaced by coordinator's `buildPerformerInfo()`
- `generatePerformerIdFromPath()` ❌ → Move to coordinator if needed

#### Initialization - ALREADY MOVED:
- `initializeRegistry()` ❌ → Already in CarnivalRegistryService
- `getDefaultRegistryEndpoints()` ❌ → Move to coordinator if needed

#### Certificate Methods - DELETE ENTIRELY:
- `addTrustedCertificate()` ❌ → Use certificateManager directly
- `revokeCertificate()` ❌ → Use certificateManager directly
- `getTrustedCertificates()` ❌ → Use certificateManager directly
- `getCertificateHealth()` ❌ → Use certificateManager directly
- `exportTrustStore()` ❌ → Use certificateManager directly
- `importTrustStore()` ❌ → Use certificateManager directly

---

## 📝 Detailed Decision Rationale

### `updateLocalCache()` - ✅ KEEP
**Why?** This is cache manipulation after discovering performers. The intern discovers performers and updates the cache they were given.

```typescript
// Intern's job - they discovered performers, they update cache
private updateLocalCache(performers: Performer[]): void {
    this.performerCache.clear();
    for (const performer of performers) {
        this.performerCache.set(performer.id, performer);
    }
}
```

### `getRegisteredPerformers()` - ✅ KEEP
**Why?** Reading from the cache the intern was given.

```typescript
// Intern reads from their cache
getRegisteredPerformers(): Performer[] {
    return this.performerCache.values();
}
```

### Registry API Key Methods - ❌ REMOVE (Move to Coordinator)

**Why?** The coordinator manages credentials and gives them to the intern when needed.

#### Current (Intern manages keys):
```typescript
// In HttpRegistryService ❌
private async getRegistryAPIKey(registryUrl: string): Promise<string | null> {
    const key = await this.store.retrieve(`registry_${registryUrl}`);
    return key || this.localApiKey || null;
}
```

#### Better (Coordinator manages keys):
```typescript
// In CarnivalRegistryService ✅
async getRegistryAPIKey(registryUrl: string): Promise<string | null> {
    const key = await this.store.retrieve(`registry_${registryUrl}`);
    return key || this.localApiKey || null;
}

// Coordinator passes keys to intern
async establishTerritory(territory: string, info: PerformerRegistrationInfo) {
    const endpoints = this.getEndpoints();
    const apiKeyMap = new Map<string, string>();
    
    for (const endpoint of endpoints) {
        const key = await this.getRegistryAPIKey(endpoint);
        if (key) apiKeyMap.set(endpoint, key);
    }
    
    // Pass keys to intern
    await this.httpService.establishTerritory(territory, info, apiKeyMap);
}
```

### `registerWithRegistry()` - ✅ KEEP
**Why?** This is protocol work - making the HTTP POST to register.

```typescript
// Intern's job - execute the registration protocol
private async registerWithRegistry(
    registryUrl: string,
    performer: Performer,
    apiKey: string | null
): Promise<void> {
    const response = await this.makeAPIRequest(
        registryUrl,
        '/carnival/network/registry',
        'POST',
        apiKey,
        { performer, action: 'register' }
    );
    // ...
}
```

### `countActiveRegistries()` - ✅ KEEP
**Why?** Protocol health check - counts how many registries are responding.

```typescript
// Intern checks registry health
private async countActiveRegistries(): Promise<number> {
    const states = this.endpointManager.getEndpointStates();
    return Array.from(states.values()).filter(s => s === 'CLOSED').length;
}
```

---

## 🎯 Updated HttpRegistryService Signature

### Constructor (Intern receives tools):
```typescript
constructor(
    private app: App,
    private endpointManager: RegistryEndpointManager,  // Given by coordinator
    private performerCache: PersistentPerformerCache,  // Given by coordinator
    private store: APIKeyStore                         // Given by coordinator (for internal use only)
)
```

**Wait - should intern have `store` at all?**

### 🤔 Should Intern Access Secure Storage?

**NO! The intern shouldn't manage credentials.**

#### Better Constructor:
```typescript
constructor(
    private app: App,
    private endpointManager: RegistryEndpointManager,
    private performerCache: PersistentPerformerCache
    // ❌ NO store - coordinator manages credentials
)
```

#### Updated Protocol Methods:
```typescript
// Intern receives API keys from coordinator
async establishTerritory(
    territory: string,
    performerInfo: PerformerRegistrationInfo,
    apiKeyMap: Map<string, string>  // ✅ Coordinator passes keys
): Promise<void> {
    const endpoints = this.getRegistryEndpoints();
    
    for (const registryUrl of endpoints) {
        const apiKey = apiKeyMap.get(registryUrl) || null;
        await this.registerWithRegistry(registryUrl, performer, apiKey);
    }
}

// All protocol methods accept apiKeyMap parameter
async sendHeartbeat(apiKeyMap: Map<string, string>): Promise<void> { }
async abandonTerritory(apiKeyMap: Map<string, string>): Promise<void> { }
```

---

## 📋 Final Decision Matrix

| Method | Keep in Intern? | Reason |
|--------|----------------|---------|
| **Protocol Methods** | | |
| `establishTerritory()` | ✅ YES | Protocol execution |
| `abandonTerritory()` | ✅ YES | Protocol execution |
| `scoutTerritories()` | ✅ YES | Protocol execution |
| `sendHeartbeat()` | ✅ YES | Protocol execution |
| `broadcastPerformerUpdate()` | ✅ YES | Protocol execution |
| **Cache Methods** | | |
| `updateLocalCache()` | ✅ YES | Intern updates their cache |
| `getRegisteredPerformers()` | ✅ YES | Intern reads their cache |
| `findPerformers()` | ✅ YES | Search cache |
| `getAllPerformers()` | ✅ YES | Read cache |
| **Protocol Helpers** | | |
| `makeAPIRequest()` | ✅ YES | HTTP execution |
| `queryRegistry()` | ✅ YES | Query protocol |
| `registerWithRegistry()` | ✅ YES | Registration protocol |
| `discoverPerformers()` | ✅ YES | Discovery coordination |
| `deduplicatePerformers()` | ✅ YES | Protocol helper |
| `performerToRegistryEntry()` | ✅ YES | Format conversion |
| `startHeartbeat()` | ✅ YES | Heartbeat management |
| `stopHeartbeat()` | ✅ YES | Heartbeat management |
| `countActiveRegistries()` | ✅ YES | Health check |
| `simpleHash()` | ✅ YES | Utility |
| **API Key Methods** | | |
| `storeRegistryAPIKey()` | ❌ REMOVE | Coordinator manages credentials |
| `getRegistryAPIKey()` | ❌ REMOVE | Coordinator manages credentials |
| `removeRegistryAPIKey()` | ❌ REMOVE | Coordinator manages credentials |
| **Detection Methods** | | |
| `detectCapabilities()` | ❌ REMOVE | Coordinator detects |
| `detectPlatform()` | ❌ REMOVE | Coordinator detects |
| `detectTerritory()` | ❌ REMOVE | Coordinator detects |
| `getCurrentPerformerInfo()` | ❌ REMOVE | Coordinator builds |
| `generatePerformerIdFromPath()` | ❌ REMOVE | Coordinator generates |
| **Initialization** | | |
| `initializeRegistry()` | ❌ REMOVE | Coordinator initializes |
| `getDefaultRegistryEndpoints()` | ❌ REMOVE | Coordinator config |
| **Certificates** | | |
| `addTrustedCertificate()` | ❌ DELETE | Use certificateManager |
| `revokeCertificate()` | ❌ DELETE | Use certificateManager |
| `getTrustedCertificates()` | ❌ DELETE | Use certificateManager |
| `getCertificateHealth()` | ❌ DELETE | Use certificateManager |
| `exportTrustStore()` | ❌ DELETE | Use certificateManager |
| `importTrustStore()` | ❌ DELETE | Use certificateManager |

---

## ✅ Summary

### Keep in HttpRegistryService (Intern):
- ✅ All protocol execution methods
- ✅ Cache manipulation (updates their given cache)
- ✅ Protocol helpers (HTTP, parsing, format conversion)
- ✅ Heartbeat management
- ✅ Health checks

### Move to CarnivalRegistryService (Coordinator):
- 📦 API key management (store/get/remove)
- 🎭 Performer detection (capabilities/platform/territory)
- 🏗️ Initialization (booking office setup)
- 🔑 Pass API keys to intern as needed

### Delete Entirely:
- 🗑️ All certificate methods (use certificateManager directly)