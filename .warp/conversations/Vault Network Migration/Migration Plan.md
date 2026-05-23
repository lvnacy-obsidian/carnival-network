# Vault Network Migration Plan
**Project:** Carnival Network → Vault Network  
**Timeline:** 6 Weeks  
**Status:** Planning Phase  
**Backwards Compatibility:** None Required (Pre-Release)

---

## Executive Summary

This document outlines the complete migration from the metaphor-heavy "Carnival Network" architecture to a direct, practical "Vault Network" system. The migration eliminates theatrical abstractions in favor of clear, functional terminology.

### Terminology Changes

| Old (Carnival) | New (Vault Network) | Rationale |
|----------------|---------------------|-----------|
| Performer | Vault | Direct: A vault is the network node |
| Territory | Type | Clear: Type categorizes modules |
| Act | Note | Simple: Notes are the synced data |
| establishTerritory() | registerModule() | Explicit: Registering functional units |
| scoutTerritories() | discoverType() | Precise: Discovering by type |
| broadcastAct() | syncNote() | Accurate: Synchronizing data |

---

## Migration Overview

### What We're Keeping (~60% of codebase)

✅ **Infrastructure Layer**
- HTTP communication patterns
- Archive abstraction (`ArchiveInterface`, `InMemoryArchive`, `CacheArchive`)
- Observability system (`MetricsCollector`, `Log`, circuit breakers)
- Cache infrastructure (rename only)
- API Router patterns
- Correlation tracking
- Error handling patterns

✅ **Proven Patterns**
- Circuit breakers for resilience
- Retry logic with exponential backoff
- Request correlation tracking
- Metrics collection
- Structured logging

### What We're Replacing (~40% of codebase)

❌ **Domain Model**
- All "Carnival" metaphor classes and types
- `CarnivalPerformer` → `VaultClient`
- `CarnivalAct` → `NetworkNote`
- Territory-based grouping → Type-based grouping
- `CarnivalQueryService` → Simplified discovery utilities

❌ **Complex State Management**
- Multi-service performer state → Single client state
- Territory service → Type registry
- Performer cache → Vault registry

---

## Week-by-Week Migration Plan

### Week 1: Core Type System & Data Structures

**Goals:**
- Define all new types
- Create migration mapping
- Establish data structures

**Deliverables:**
- `src/types/network-core.ts` - Core network types
- `src/types/vault-types.ts` - Vault and module types
- `src/types/note-types.ts` - Note and sync types
- `src/types/discovery-types.ts` - Discovery protocol types
- `docs/MIGRATION-MAPPING.md` - Old → New mapping reference

**Type Modules to Create:**

1. **network-core.ts**
   - `NetworkIdentity`
   - `NetworkConfig`
   - `DiscoveryConfig`
   - `SecurityConfig`

2. **vault-types.ts**
   - `VaultInfo`
   - `VaultCapabilities`
   - `VaultStatus`
   - `VaultMetadata`

3. **module-types.ts**
   - `ModuleInfo`
   - `ModuleCapabilities`
   - `TypeInfo`
   - `TypeSchema`

4. **note-types.ts**
   - `NetworkNote`
   - `NoteMetadata`
   - `SyncPreferences`
   - `SyncResult`

5. **discovery-types.ts**
   - `PeerAnnouncement`
   - `PeerRegistry`
   - `DiscoveryMessage`
   - `GossipMessage`

**Success Criteria:**
- All types defined and documented
- Zero circular dependencies
- Types compile without errors
- Migration mapping document complete

---

### Week 2: Discovery System Implementation

**Goals:**
- Implement UDP multicast discovery
- Create peer registry
- Build gossip protocol

**Deliverables:**
- `src/network/discovery/local-discovery-service.ts`
- `src/network/discovery/peer-registry-service.ts`
- `src/network/discovery/gossip-protocol-service.ts`
- `src/network/discovery/vault-discovery-coordinator.ts`
- Unit tests for discovery services

**Implementation Order:**

1. **LocalDiscoveryService** (2 days)
   - UDP multicast sender
   - UDP multicast receiver
   - Announcement generation
   - Peer list building

2. **PeerRegistryService** (1 day)
   - In-memory peer storage
   - Peer cache persistence
   - Peer timeout/pruning
   - Registry queries

3. **GossipProtocolService** (2 days)
   - Peer-to-peer gossip
   - Transitive discovery
   - Network topology building
   - Gossip message validation

4. **VaultDiscoveryCoordinator** (2 days)
   - Orchestrates all discovery methods
   - Bridge mode handling
   - Manual peer configuration
   - Heartbeat coordination

**Success Criteria:**
- Two vaults on same LAN discover each other automatically
- Peer registry persists across restarts
- Gossip protocol discovers transitive peers
- Heartbeat maintains connectivity

---

### Week 3: Vault Client Implementation

**Goals:**
- Create simplified client replacing CarnivalPerformer
- Implement module registration
- Build type discovery

**Deliverables:**
- `src/network/vault-client.ts`
- `src/network/services/module-registry-service.ts`
- `src/network/services/type-discovery-service.ts`
- Integration tests

**VaultClient Interface:**

```typescript
class VaultClient {
    // Lifecycle
    async initialize(): Promise<void>
    async registerVault(name: string): Promise<string>
    async unregister(): Promise<void>
    
    // Module management
    async registerModule(moduleId: string, typeName: string, options?: ModuleOptions): Promise<void>
    async unregisterModule(moduleId: string): Promise<void>
    getRegisteredModules(): ModuleInfo[]
    
    // Type discovery
    async discoverType(typeName: string): Promise<VaultInfo[]>
    async getAllTypes(): Promise<Map<string, VaultInfo[]>>
    
    // Note sync (Week 4)
    async syncNote(note: NetworkNote): Promise<SyncResult>
    async pullNotes(typeName: string, since?: string): Promise<NetworkNote[]>
    
    // Network status
    getNetworkInfo(): NetworkIdentity
    getPeerCount(): number
    getConnectionStatus(): ConnectionStatus
}
```

**Success Criteria:**
- VaultClient initializes without errors
- Module registration works
- Type discovery returns correct vaults
- Clean separation from old CarnivalPerformer

---

### Week 4: Note Synchronization

**Goals:**
- Implement note push/pull between vaults
- Create sync coordination
- Build conflict resolution

**Deliverables:**
- `src/network/services/note-sync-service.ts`
- `src/network/services/sync-coordinator-service.ts`
- `src/network/services/conflict-resolver-service.ts`
- Sync integration tests

**NoteSyncService:**

```typescript
class NoteSyncService {
    // Push operations
    async pushToType(note: NetworkNote): Promise<SyncResult>
    async pushToVault(vaultId: string, note: NetworkNote): Promise<void>
    
    // Pull operations
    async pullFromType(typeName: string, since?: string): Promise<NetworkNote[]>
    async pullFromVault(vaultId: string, typeName: string, since?: string): Promise<NetworkNote[]>
    
    // Sync coordination
    async syncModule(moduleId: string): Promise<SyncResult>
    async fullSync(): Promise<SyncResult>
}
```

**Success Criteria:**
- Notes push successfully between vaults
- Pull operations retrieve correct notes
- Sync handles offline vaults gracefully
- Conflict resolution works for simultaneous edits

---

### Week 5: Type Management & API Updates

**Goals:**
- Implement type-level operations
- Update external API endpoints
- Create new REST API routes

**Deliverables:**
- `src/network/services/type-management-service.ts`
- `src/api/vault-api-handlers.ts`
- `src/api/note-api-handlers.ts`
- `src/api/discovery-api-handlers.ts`
- Updated API Router

**New API Endpoints:**

```
Network Management:
POST   /api/network/create          - Create new network
POST   /api/network/join            - Join existing network
GET    /api/network/info            - Get network info
DELETE /api/network/leave           - Leave network

Vault Management:
POST   /api/vaults/register         - Register this vault
GET    /api/vaults                  - List all known vaults
GET    /api/vaults/:id              - Get vault details
POST   /api/vaults/heartbeat        - Keep-alive

Module Management:
POST   /api/modules/register        - Register module
GET    /api/modules                 - List modules
DELETE /api/modules/:id             - Unregister module

Type Management:
GET    /api/types                   - List all types
GET    /api/types/:name/vaults      - Get vaults with type
POST   /api/types/:name/structure   - Push directory structure

Note Synchronization:
POST   /api/notes/sync              - Sync note
GET    /api/notes                   - Query notes
POST   /api/notes/pull              - Pull notes from network

Discovery:
GET    /api/discovery/peers         - Get peer list
POST   /api/discovery/announce      - Announce presence
```

**Success Criteria:**
- All API endpoints functional
- Type management operations work
- External clients can interact with network
- API documentation complete

---

### Week 6: Plugin Integration & Testing

**Goals:**
- Integrate VaultClient with main plugin
- Update UI/settings
- Comprehensive testing
- Documentation

**Deliverables:**
- Updated `src/main.ts`
- Settings UI for network configuration
- User documentation
- Integration test suite
- Migration verification

**Plugin Integration:**

```typescript
export default class VaultNetworkPlugin extends Plugin {
    private vaultClient: VaultClient;
    private apiRouter: APIRouter;
    
    async onload() {
        // Load configuration
        await this.loadSettings();
        
        // Initialize vault client
        this.vaultClient = new VaultClient(
            this.settings.networkConfig,
            this.apiKeyStorage
        );
        
        await this.vaultClient.initialize();
        
        // Register API routes
        await this.initializeAPI();
        
        // Add commands
        this.addCommands();
        
        // Add settings tab
        this.addSettingTab(new VaultNetworkSettingsTab(this.app, this));
    }
    
    async onunload() {
        await this.vaultClient.unregister();
        await this.apiRouter.cleanup();
    }
    
    // Public API for other plugins
    public getVaultClient(): VaultClient {
        return this.vaultClient;
    }
}
```

**Settings UI Sections:**

1. **Network Configuration**
   - Network name
   - Network ID (display only)
   - Create/Join network options

2. **Discovery Settings**
   - Local discovery toggle
   - Bridge mode configuration
   - Manual peer management

3. **Module Management**
   - List registered modules
   - Register new modules
   - Module-type assignments

4. **Sync Settings**
   - Auto-sync toggle
   - Sync interval
   - Conflict resolution strategy

5. **Advanced**
   - Security settings
   - Network diagnostics
   - Debug logging

**Success Criteria:**
- Plugin loads without errors
- Settings UI functional
- Two vaults can sync notes end-to-end
- All tests passing
- Documentation complete

---

## File Structure Changes

### New Directory Structure

```
src/
├── types/
│   ├── network-core.ts          # NEW: Core network types
│   ├── vault-types.ts           # NEW: Vault definitions
│   ├── module-types.ts          # NEW: Module definitions
│   ├── note-types.ts            # NEW: Note definitions
│   ├── discovery-types.ts       # NEW: Discovery protocol types
│   └── public/                  # Public API types
│       └── index.ts             # Re-exports
│
├── network/
│   ├── vault-client.ts          # NEW: Main client (replaces carnival-performer.ts)
│   │
│   ├── discovery/               # NEW: Discovery subsystem
│   │   ├── local-discovery-service.ts
│   │   ├── peer-registry-service.ts
│   │   ├── gossip-protocol-service.ts
│   │   └── vault-discovery-coordinator.ts
│   │
│   ├── services/
│   │   ├── note-sync-service.ts         # NEW: Replaces act-service.ts
│   │   ├── module-registry-service.ts   # NEW: Module management
│   │   ├── type-discovery-service.ts    # NEW: Type operations
│   │   ├── type-management-service.ts   # NEW: Type-level ops
│   │   ├── sync-coordinator-service.ts  # NEW: Sync orchestration
│   │   ├── conflict-resolver-service.ts # NEW: Conflict handling
│   │   └── vault-registry-cache.ts      # RENAMED: From persistent-performer-cache.ts
│   │
│   └── storage/
│       ├── archive-interface.ts         # KEEP: Storage abstraction
│       ├── in-memory-archive.ts         # KEEP: In-memory storage
│       └── cache-archive.ts             # KEEP: Cached storage
│
├── api/
│   ├── api-router.ts            # KEEP: Update routes
│   ├── vault-api-handlers.ts    # NEW: Vault endpoints
│   ├── note-api-handlers.ts     # NEW: Note endpoints
│   ├── discovery-api-handlers.ts # NEW: Discovery endpoints
│   └── external-api-service.ts  # UPDATE: Rename handlers
│
├── observability/
│   ├── metrics-collector.ts     # KEEP: Update metric names
│   ├── logger.ts                # KEEP: Update log contexts
│   └── circuit-breaker.ts       # KEEP: No changes needed
│
├── ui/
│   └── vault-network-settings.ts # NEW: Settings tab
│
└── main.ts                      # UPDATE: VaultClient integration

```

### Files to Delete

```
src/network/
├── carnival-performer.ts        # DELETE: Replaced by vault-client.ts
├── carnival-troupe-manager.ts   # DELETE: No longer needed
├── carnival-query-service.ts    # DELETE: Over-engineered
└── services/
    ├── http-registry-service.ts # DELETE: Using peer-to-peer now
    └── performer-access-service.ts # DELETE: Merged into discovery

src/types/
└── public/
    ├── carnival-client-types.ts # DELETE: Old API
    └── carnival-grounds-types.ts # DELETE: Territory concept removed
```

---

## Migration Verification Checklist

### Pre-Migration Verification
- [ ] All existing code committed and tagged
- [ ] Create migration branch: `refactor/vault-network`
- [ ] Document current test coverage
- [ ] Back up any production data (if applicable)

### Week 1 Verification
- [ ] All type modules created
- [ ] Types compile without errors
- [ ] Zero circular dependencies
- [ ] Migration mapping document complete
- [ ] Code review completed

### Week 2 Verification
- [ ] Local discovery works on same network
- [ ] Peer registry persists correctly
- [ ] Gossip protocol discovers peers
- [ ] Unit tests pass (>80% coverage)

### Week 3 Verification
- [ ] VaultClient initializes successfully
- [ ] Module registration functional
- [ ] Type discovery returns correct results
- [ ] Integration tests pass

### Week 4 Verification
- [ ] Notes sync between two vaults
- [ ] Pull operations retrieve correct data
- [ ] Conflict resolution works
- [ ] Sync handles offline vaults

### Week 5 Verification
- [ ] All API endpoints functional
- [ ] Type management operations work
- [ ] API documentation complete
- [ ] External client can interact with API

### Week 6 Verification
- [ ] Plugin loads without errors
- [ ] Settings UI functional
- [ ] End-to-end sync works
- [ ] All tests passing (>85% coverage)
- [ ] User documentation complete
- [ ] Performance acceptable (<100ms for local ops)

---

## Risk Mitigation

### High-Risk Areas

1. **Discovery Protocol Complexity**
   - Risk: UDP multicast may not work on all networks
   - Mitigation: Provide manual peer configuration fallback
   - Contingency: Document Tailscale setup as recommended approach

2. **Data Migration**
   - Risk: Existing act data needs conversion to notes
   - Mitigation: Create migration script for existing data
   - Contingency: Pre-release, so acceptable to lose test data

3. **Sync Conflicts**
   - Risk: Simultaneous edits cause data loss
   - Mitigation: Implement conflict detection and resolution
   - Contingency: Last-write-wins with conflict markers

4. **Network Partitions**
   - Risk: Network splits cause inconsistent state
   - Mitigation: Implement vector clocks for causality
   - Contingency: Manual reconciliation tools

### Testing Strategy

**Unit Tests:**
- All services tested in isolation
- Mock external dependencies
- Cover edge cases and error conditions
- Target: >80% code coverage

**Integration Tests:**
- Multi-vault scenarios
- Network partition simulation
- Concurrent sync operations
- Target: All critical paths covered

**End-to-End Tests:**
- Full user workflows
- Real network conditions
- Performance benchmarks
- Target: All documented features tested

---

## Success Metrics

### Technical Metrics
- [ ] <100ms latency for local operations
- [ ] <5s for cross-vault sync on LAN
- [ ] >85% test coverage
- [ ] Zero memory leaks
- [ ] <10MB memory footprint per vault

### User Experience Metrics
- [ ] Zero-config setup for local network
- [ ] <5 minutes to set up cross-internet sync
- [ ] Clear error messages for all failure modes
- [ ] Comprehensive documentation

### Code Quality Metrics
- [ ] Zero TypeScript errors
- [ ] Zero linter warnings
- [ ] All public APIs documented
- [ ] Consistent naming conventions
- [ ] Clear separation of concerns

---

## Post-Migration Cleanup

### Week 7: Cleanup & Polish
- [ ] Remove all old carnival-related code
- [ ] Update all documentation references
- [ ] Clean up unused dependencies
- [ ] Optimize bundle size
- [ ] Final code review

### Week 8: Release Preparation
- [ ] Version bump to 2.0.0 (breaking changes)
- [ ] Write release notes
- [ ] Create migration guide for any alpha testers
- [ ] Update README and documentation site
- [ ] Tag release candidate

---

## Appendix A: Type Migration Map

| Old Type | New Type | Location |
|----------|----------|----------|
| `CarnivalAct` | `NetworkNote` | `note-types.ts` |
| `CarnivalPerformer` | `VaultInfo` | `vault-types.ts` |
| `CarnivalPerformerInterface` | `VaultClient` | `vault-client.ts` |
| `Territory` | `string` (typeName) | Throughout |
| `ActService` | `NoteSyncService` | `note-sync-service.ts` |
| `HttpRegistryService` | `PeerRegistryService` | `peer-registry-service.ts` |
| `PerformerAccessService` | `TypeDiscoveryService` | `type-discovery-service.ts` |
| `CarnivalQueryService` | Utility functions | Various services |
| `PersistentPerformerCache` | `VaultRegistryCache` | `vault-registry-cache.ts` |

---

## Appendix B: Method Migration Map

| Old Method | New Method | Notes |
|------------|------------|-------|
| `joinCarnival()` | `registerVault()` | Now returns VaultClient |
| `establishTerritory()` | `registerModule()` | Takes typeName instead |
| `broadcastAct()` | `syncNote()` | Clearer intent |
| `scoutTerritories()` | `discoverType()` | Type-based discovery |
| `queryActs()` | `pullNotes()` | Simplified API |
| `leaveRing()` | `unregister()` | Direct language |
| `getCarnivalTopology()` | `getNetworkInfo()` | Removed "carnival" |
| `getRecentActivity()` | `pullNotes()` with filter | Simplified |

---

## Document History

**Version 1.0** - 2025-01-24
- Initial migration plan created
- 6-week timeline established
- Complete file structure defined
- Risk mitigation strategies documented

---

**Next Document:** See `VAULT-DISCOVERY-IMPLEMENTATION.md` for detailed discovery system implementation.