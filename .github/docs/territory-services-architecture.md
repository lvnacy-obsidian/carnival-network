# Territory Services Architecture

## Overview

The territory services layer manages performer coordination and network discovery across the carnival network. This document describes the three key files and their relationships:

1. **`carnival-service-types.ts`** — Interface definitions
2. **`http-registry-service.ts`** — Network implementation
3. **`territory-access-service.ts`** — Cache query layer

---

## File Purposes

### 1. `src/types/public/carnival-service-types.ts`

**Purpose**: Defines service interfaces and contracts for all network services.

**Key Exports**:
- `TerritoryServiceInterface` — Territory communication protocol
- `ActServiceInterface` — Record/act operations protocol
- `QueryServiceInterface` — Cross-territory query protocol

**TerritoryServiceInterface Details**:
```typescript
export interface TerritoryServiceInterface {
  establishTerritory(territory: string, performerInfo: PerformerRegistrationInfo): Promise<void>;
  scoutTerritories(territory: string): Promise<RegistryEntry[]>;
  sendHeartbeat(performerId: string): Promise<void>;
  abandonTerritory(performerId: string): Promise<void>;
  isAvailable(): boolean;
  getAllPerformers(): RegistryEntry[];
}
```

This interface defines the contract that any territory service must fulfill, ensuring consistent behavior across different implementations.

---

### 2. `src/network/http-registry-service.ts`

**Purpose**: Implements network-based performer discovery and coordination via HTTP/HTTPS.

**Key Responsibilities**:
- **Registry Communication**: Manages HTTP/HTTPS connections to multiple registry endpoints
- **Performer Registration**: Registers the current performer with network registries
- **Heartbeat Management**: Maintains periodic heartbeats to keep performer presence alive
- **Performer Discovery**: Queries registries to discover other performers across territories
- **Cache Management**: Maintains an in-memory cache of discovered performers
- **Certificate Management**: Handles TLS certificate trust and validation
- **Endpoint Management**: Implements circuit-breaker pattern for registry endpoints

**Implementation Details**:
- Implements `TerritoryServiceInterface` (line 39)
- Uses `PersistentPerformerCache` for local performer caching
- Communicates with multiple registry endpoints with retry logic
- Enforces HTTPS for non-localhost endpoints
- Provides additional utility methods beyond the interface for network topology monitoring

**Key Methods**:
- `establishTerritory()` — Registers performer with registries and starts heartbeat
- `scoutTerritories()` — Discovers performers in a specific territory
- `sendHeartbeat()` — Sends heartbeat to all registries
- `abandonTerritory()` — Unregisters performer from registries
- `isAvailable()` — Checks if registries are reachable
- `getAllPerformers()` — Returns all cached performers as registry entries

---

### 3. `src/network/services/territory-access-service.ts`

**Purpose**: Provides read-only query access to cached performer data.

**Key Responsibilities**:
- **Cache Queries**: Retrieves performer data from the persistent cache
- **Territory Queries**: Filters performers by territory
- **Capability Queries**: Filters performers by capability
- **Cache Management**: Clears cache when needed
- **Availability Checking**: Verifies if cache has data

**Important Distinction**:
- **Does NOT implement** `TerritoryServiceInterface`
- Serves a different purpose: read-only cache accessor, not network coordinator
- Missing network operations: `establishTerritory()`, `scoutTerritories()`, `sendHeartbeat()`, `abandonTerritory()`

**Key Methods**:
- `getAllPerformers()` — Returns all performers as registry entries
- `getPerformersByTerritory()` — Filters performers by territory
- `getPerformersByCapability()` — Filters performers by capability
- `getPerformer()` — Retrieves single performer by ID
- `getAllTerritories()` — Gets unique territory names
- `getPerformerCount()` — Gets total performer count
- `isAvailable()` — Checks if cache has data

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────┐
│        carnival-service-types.ts (Interfaces)           │
│                                                          │
│  ┌──────────────────────────────────────────────────┐   │
│  │ TerritoryServiceInterface (Contract)             │   │
│  │ - establishTerritory()                           │   │
│  │ - scoutTerritories()                             │   │
│  │ - sendHeartbeat()                                │   │
│  │ - abandonTerritory()                             │   │
│  │ - isAvailable()                                  │   │
│  │ - getAllPerformers()                             │   │
│  └──────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
           ▲                              ▲
           │ implements                   │ not implementing
           │                              │
    ┌──────┴─────────────────┐    ┌──────┴──────────────────────┐
    │                         │    │                             │
┌───┴──────────────────────┐ │  ┌─┴────────────────────────────┐│
│ http-registry-service.ts │ │  │ territory-access-service.ts  ││
│                          │ │  │                              ││
│ Network Implementation   │ │  │ Cache Query Layer            ││
│                          │ │  │                              ││
│ - Registry endpoints     │ │  │ - Read-only cache access     ││
│ - HTTP communication     │ │  │ - Territory filtering        ││
│ - Heartbeat loop         │ │  │ - Capability filtering       ││
│ - Performer discovery    │ │  │ - No network operations      ││
│ - Circuit breaker        │ │  │ - Lightweight wrapper        ││
│ - TLS/Certificate mgmt   │ │  │                              ││
│ - Performance cache      │ │  │ Uses: PersistentPerformerCache
│                          │ │  │                              │
│ Extends interface        │ │  │                              │
│ with utility methods     │ │  │ Does NOT extend interface    │
└────────────────────┬─────┘ │  └──────────────────────────────┘
                     │        │
                     └────────┘
                Both use:
         PersistentPerformerCache
```

---

## Data Flow

### Network Discovery Flow (HttpRegistryService)
```
establishTerritory()
  ↓
Build Performer object from PerformerRegistrationInfo
  ↓
Register with each registry endpoint (POST /carnival/network/registry)
  ↓
Start heartbeat loop (every 30 seconds)
  ↓
Periodically:
  - sendHeartbeat() → POST to registries
  - discoverPerformers() → GET from registries
  - Update PersistentPerformerCache
```

### Cache Query Flow (PerformerAccessService)
```
Client requests performers
  ↓
Query method called (e.g., getPerformersByTerritory())
  ↓
Read from PersistentPerformerCache
  ↓
Filter/transform data
  ↓
Convert Performer → RegistryEntry
  ↓
Return results
```

---

## Key Relationships

### `HttpRegistryService` → `PerformerAccessService`
- **Direction**: HttpRegistryService populates cache that PerformerAccessService queries
- **Data Flow**: Network discovery writes to PersistentPerformerCache; PerformerAccessService reads from it
- **Separation of Concerns**: 
  - HttpRegistryService: Active network management
  - PerformerAccessService: Passive read-only queries

### Both Services → `PersistentPerformerCache`
- **HttpRegistryService**: Writes discovered performers to cache
- **PerformerAccessService**: Reads performer data from cache
- **Independence**: Each service can be used independently
  - HttpRegistryService for coordination/discovery
  - PerformerAccessService for read-only queries

### `TerritoryServiceInterface` → Implementations
- **HttpRegistryService**: Full implementation of the interface (6/6 methods)
- **PerformerAccessService**: Not an implementation; serves a different purpose
- **Other implementations**: Interface allows for future implementations (e.g., local-only discovery)

---

## When to Use Each

### Use `HttpRegistryService` when you need to:
- Register the current performer with the network
- Discover performers across territories
- Maintain network presence (heartbeat)
- Unregister from the network
- Manage TLS certificates and endpoints
- Monitor network topology

### Use `PerformerAccessService` when you need to:
- Query locally cached performer data
- Filter performers by territory
- Search performers by capability
- Check cache availability
- Count performers in cache
- Avoid network operations (read-only access)

### Use `TerritoryServiceInterface` when you need to:
- Implement a new territory service
- Ensure protocol compliance
- Mock the service for testing
- Support multiple implementations

---

## Common Patterns

### Pattern 1: Network Setup
```typescript
// Initialize HttpRegistryService (implements TerritoryServiceInterface)
const registryService = new HttpRegistryService(app, config, storage, cache);

// Establish network presence
await registryService.establishTerritory('necropolis', performerInfo);

// Now the performer is registered and heartbeat is active
```

### Pattern 2: Query Local Cache
```typescript
// Create access layer
const accessService = new PerformerAccessService(cache);

// Query without network operations
const performers = accessService.getPerformersByTerritory('necropolis');
const count = accessService.getPerformerCount();
```

### Pattern 3: Network Monitoring
```typescript
// Use HttpRegistryService for network topology
const topology = await registryService.getNetworkTopology();
console.log(`${topology.totalPerformers} performers across ${Object.keys(topology.territories).length} territories`);

// Then use PerformerAccessService for detailed queries
const necropolis = accessService.getPerformersByTerritory('necropolis');
```

---

## Interface Contract Summary

| Method | HttpRegistryService | PerformerAccessService | Required |
|--------|:---:|:---:|:---:|
| `establishTerritory()` | ✓ | ✗ | TerritoryServiceInterface |
| `scoutTerritories()` | ✓ | ✗ | TerritoryServiceInterface |
| `sendHeartbeat()` | ✓ | ✗ | TerritoryServiceInterface |
| `abandonTerritory()` | ✓ | ✗ | TerritoryServiceInterface |
| `isAvailable()` | ✓ | ✓ | TerritoryServiceInterface |
| `getAllPerformers()` | ✓ | ✓ | TerritoryServiceInterface |
| `getPerformersByTerritory()` | ✗ | ✓ | Custom method |
| `getPerformersByCapability()` | ✗ | ✓ | Custom method |
| `getPerformer(id)` | ✗ | ✓ | Custom method |

---

## See Also

- `PersistentPerformerCache` — Persistent storage for performer data
- `RegistryEndpointManager` — Circuit breaker management for registry endpoints
- `http-client.ts` — HTTP request utilities with retry logic
- `validation.ts` — Response validation for registry queries
