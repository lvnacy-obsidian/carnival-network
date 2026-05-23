# 🎪 HTTP Registry Service - Refactoring Guide

## Key Changes Summary

###  1. **Type Replacements**

| Old Type | New Type | Location |
|----------|----------|----------|
| `NetworkNode` | `Performer` | Throughout |
| `NetworkConfiguration` | `CarnivalConfiguration` | Constructor |
| `PersistentNodeCache` | `PersistentPerformerCache` | Class member |
| `CacheConfig` | `PerformerCacheConfig` | Configuration |

### 2. **Class Rename**

```typescript
// Old
export class HttpRegistryService {
  private performerCache: PersistentNodeCache;
  // ...
}

// New
export class HttpRegistryService implements ITerritoryService {
  private performerCache: PersistentPerformerCache;
  private currentPerformer: Performer | null = null;
  // ...
}
```

### 3. **Import Updates**

```typescript
// Remove these
import type { NetworkNode, NetworkConfiguration } from '../types';

// Add these
import type {
  Performer,
  PerformerInfo,
  RegistryEntry,
  PerformerRegistrationInfo,
  CarnivalConfiguration,
  ITerritoryService
} from '../types/public';
```

### 4. **Method Signatures (ITerritoryService)**

```typescript
// Implement the interface methods:
async establishTerritory(territory: string, performerInfo: PerformerRegistrationInfo): Promise<void>
async scoutTerritories(territory: string): Promise<RegistryEntry[]>
async sendHeartbeat(performerId: string): Promise<void>
async abandonTerritory(performerId: string): Promise<void>
isAvailable(): boolean
getAllNodes(): RegistryEntry[]
```

### 5. **Internal Method Renames**

| Old Method | New Method |
|-----------|------------|
| `registerNode()` | `establishTerritory()` (public API) |
| `unregisterNode()` | `abandonTerritory()` (public API) |
| `discoverNetworkNodes()` | `discoverPerformers()` (internal) |
| `getCurrentNodeInfo()` | `getCurrentPerformerInfo()` (internal) |
| `getRegisteredNodes()` | Returns `RegistryEntry[]` via `getAllNodes()` |
| `findNode()` | `findPerformer()` |
| `findNodesByTerritory()` | `findPerformersByTerritory()` |
| `updateLocalRegistry()` | `updateLocalCache()` |
| `deduplicateNodes()` | `deduplicatePerformers()` |
| `generateNodeIdFromPath()` | `generatePerformerIdFromPath()` |

### 6. **Cache Method Updates**

```typescript
// Old
this.performerCache.get(id)
this.performerCache.set(id, performer)
this.performerCache.values()

// New
this.performerCache.get(id) // Returns Performer
this.performerCache.set(id, performer)
this.performerCache.values() // Returns Performer[]
```

### 7. **Validation Updates**

```typescript
// In validation.ts, rename:
export function validateNetworkNodes(performers: unknown[]): NetworkNode[]

// To:
export function validatePerformers(performers: unknown[]): Performer[]
```

### 8. **Conversion Helper**

Add this helper method to convert between types:

```typescript
/**
 * Convert Performer to RegistryEntry (lightweight registry format)
 */
private performerToRegistryEntry(performer: Performer): RegistryEntry {
  return {
    performerId: performer.id,
    territoryName: performer.territory,
    endpoint: `http://${performer.metadata.apiHost || 'localhost'}:${performer.metadata.apiPort || 27123}`,
    capabilities: performer.capabilities,
    lastSeen: performer.lastSeen,
    metadata: performer.metadata
  };
}
```

### 9. **Logging Updates**

```typescript
// Add carnival emojis throughout
Log.log(httpRegistryLogger, '🎪 Registered with registry...');
Log.log(httpRegistryLogger, '🎭 Performer discovered...');
Log.log(httpRegistryLogger, '💓 Heartbeat sent...');
Log.log(httpRegistryLogger, '🔍 Scouting territories...');
```

### 10. **Configuration Constructor Update**

```typescript
constructor(
  private app: App,
  private config: CarnivalConfiguration,  // Changed from NetworkConfiguration
  private storage: APIKeyStorage
) {
  // Update cache initialization
  const cacheConfig: Partial<PerformerCacheConfig> = {
    maxSize: config.maxCachedNodes ?? 1000,
    defaultTtlMs: config.performerCacheTTL ?? (30 * 60 * 1000),
    persistenceEnabled: true,
    persistenceKey: 'carnival-performer-cache',  // Changed key name
    backgroundSaveIntervalMs: 5 * 60 * 1000,
    compressionEnabled: true
  };
  this.performerCache = new PersistentPerformerCache(app, cacheConfig);
}
```

## Step-by-Step Refactoring Process

1. ✅ **Update imports** - Replace old types with new carnival types
2. ✅ **Rename class members** - `performerCache` → `performerCache`
3. ✅ **Add interface** - `implements ITerritoryService`
4. ✅ **Update constructor** - Use `CarnivalConfiguration`, `PersistentPerformerCache`
5. ✅ **Implement interface methods** - Add public API methods
6. ✅ **Rename internal methods** - Update method names for clarity
7. ✅ **Update all type references** - `NetworkNode` → `Performer`
8. ✅ **Add conversion helper** - `performerToRegistryEntry()`
9. ✅ **Update logging** - Add carnival emojis
10. ✅ **Test compilation** - Fix any remaining type errors

## Methods That Stay the Same

These utility methods don't need renaming:
- `simpleHash()`
- `detectPlatform()`
- `detectTerritory()`
- `detectCapabilities()`
- `makeAPIRequest()`
- `getDefaultRegistryEndpoints()`
- Certificate-related methods
- Registry API key methods
- Endpoint manager methods

## New Public API (ITerritoryService)

Consumers will now call:
```typescript
// Instead of: await registryService.registerNode()
await territoryService.establishTerritory('backstage', performerInfo);

// Instead of: await registryService.discoverNetworkNodes()
const performers = await territoryService.scoutTerritories('backstage');

// Instead of: await registryService.unregisterNode()
await territoryService.abandonTerritory(performerId);

// Check availability
if (territoryService.isAvailable()) {
  const allNodes = territoryService.getAllNodes();
}
```

## Files That Need Similar Updates

After completing `http-registry-service.ts`, these files need similar treatment:

1. **`validation.ts`** - Rename `validateNetworkNodes` → `validatePerformers`
2. **`registry-endpoint-manager.ts`** - Minimal changes (mostly internal)
3. **`services/territory-access-service.ts`** - Implement `ITerritoryService` pattern
4. **`services/act-service.ts`** - Use `Performer` instead of `NetworkNode`
5. **`services/carnival-query-service.ts`** - Use new types

---

**The carnival theme is now consistent throughout!** 🎪🎭