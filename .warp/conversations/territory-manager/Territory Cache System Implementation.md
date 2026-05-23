# Territory Cache System - Implementation Plan

**Document Version**: 1.0  
**Created**: 2025-01-18  
**Status**: Ready for Implementation  
**Phase**: 3.3 (Post-API, Pre-Archive)

---

## Executive Summary

This document outlines the implementation plan for enhancing the territory cache system with coordination, initialization, and cross-cache query capabilities. The enhancements prepare the caching layer for Phase 4 (RxDB archive integration) while maintaining backward compatibility and zero breaking changes.

---

## Nomenclature Clarification

**Storage Terminology**:
- **Store**: Key-value storage for configuration and settings (KeyStore)
- **Storage**: Cache persistence to vault files (PersistentPerformerCache, TerritoryCache)
- **Archive**: Database layer for long-term act storage (RxDB in Phase 4)

**Consistency Guidelines**:
- Cache classes use "storage" for vault persistence methods
- Archive abstraction layer uses "archive" terminology
- Store operations remain distinct from cache/archive operations

---

## Implementation Roadmap

### Priority 1: Core Coordination (Required)
1. **TerritoryCacheManager** - Coordinate territory counts and assignments
2. **CacheInitializer** - Orchestrate initialization and validate integrity

### Priority 2: Integration (Recommended)
3. **Eviction Hooks** - Clean up assignments on performer eviction
4. **Cross-Cache Queries** - Convenience methods for multi-cache operations

### Priority 3: Enhancements (Optional)
5. **Metrics Integration** - Report cache statistics to globalMetrics
6. **Storage Path Organization** - Structured directory layout

---

---

## Access Pattern: Hybrid Approach

The territory cache system uses a **hybrid access pattern** that balances consistency, performance, and developer ergonomics.

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Application Services                      │
│         (ActService, CarnivalQueryService, etc.)            │
└─────────────────────────────────────────────────────────────┘
                          ↓                ↓
         ┌────────────────┴────────┐      │ (fast reads)
         │ TerritoryCacheManager   │      │
         │  (coordination layer)   │      │
         └────────────────┬────────┘      │
                  ↓              ↓         ↓
    ┌─────────────────┐  ┌────────────────────────┐
    │ TerritoryCache  │  │ TerritoryAssignmentCache│
    │  (definitions)  │  │     (mappings)         │
    └─────────────────┘  └────────────────────────┘
```

### Usage Decision Tree

```
Need to write data?
  └─> YES → Use TerritoryCacheManager
           ✓ Automatic count sync
           ✓ Referential integrity
           ✓ Validation
           
Need cross-cache query?
  └─> YES → Use TerritoryCacheManager
           ✓ getTerritorySummary()
           ✓ getPerformerTerritories()
           ✓ getAllTerritoriesWithCounts()
           
Performance-critical read path?
  └─> YES → Direct cache access OK
           ✓ territoryCache.get()
           ✓ assignmentCache.getAssignments()
           ⚠️ No validation overhead
           
General read operation?
  └─> Either manager or direct cache
      Manager: Consistent API, convenience methods
      Direct: Slightly faster, less indirection
```

### Dependency Injection Patterns

#### Pattern 1: Manager-Only (Recommended for most services)

```typescript
export class ActService {
  constructor(
    private territoryManager: TerritoryCacheManager,
    private performerCache: PersistentPerformerCache
  ) {}
  
  // All territory operations go through manager
  async createAct(data: ActCreateData): Promise<CarnivalAct> {
    const info = this.territoryManager.getPerformerTerritories(data.performerId);
    const territory = this.territoryManager.getTerritory(info.primary.name);
    // ...
  }
}
```

**Benefits**:
- Single dependency for territory operations
- Consistent API surface
- Automatic synchronization
- Easy to test (mock manager only)

**Trade-offs**:
- Slight performance overhead on reads
- One extra function call per operation

---

#### Pattern 2: Manager + Direct Caches (For performance-critical services)

```typescript
export class CarnivalQueryService {
  constructor(
    private territoryManager: TerritoryCacheManager,
    private territoryCache: TerritoryCache,
    private assignmentCache: TerritoryAssignmentCache,
    private performerCache: PersistentPerformerCache
  ) {}
  
  // Writes through manager
  async reassignPerformer(id: string, territories: string[]): Promise<void> {
    await this.territoryManager.assignPerformer(id, territories);
  }
  
  // Hot path reads direct to cache
  async queryActsByTerritory(territory: string): Promise<CarnivalAct[]> {
    // Direct cache access for performance
    const performerIds = this.assignmentCache.getPerformersInTerritory(territory);
    
    const acts: CarnivalAct[] = [];
    for (const performerId of performerIds) {
      // Tight loop, no manager overhead
      const assignments = this.assignmentCache.getAssignments(performerId);
      // ...
    }
    return acts;
  }
}
```

**Benefits**:
- Maximum performance on hot paths
- Still coordinated for writes
- Flexible API usage

**Trade-offs**:
- More dependencies to inject
- Developer must understand access patterns
- More complex testing (mock multiple caches)

---

#### Pattern 3: Direct Caches Only (Not recommended)

```typescript
export class LegacyService {
  constructor(
    private territoryCache: TerritoryCache,
    private assignmentCache: TerritoryAssignmentCache
  ) {}
  
  // ❌ BAD - bypasses synchronization
  async assignPerformer(id: string, territories: string[]): Promise<void> {
    this.assignmentCache.assign(id, territories);
    // Count is now out of sync!
  }
}
```

**Why avoid**:
- No automatic count synchronization
- No referential integrity checks
- No validation
- Error-prone for future maintenance

---

### Manager Convenience Methods

The manager provides convenience methods for common read operations:

```typescript
// These are simple pass-throughs to underlying caches:
manager.getTerritory(name)           → territoryCache.get(name)
manager.getAllTerritories()          → territoryCache.getAll()
manager.getAssignments(performerId)  → assignmentCache.getAssignments(performerId)

// Use them for consistent manager-based API:
const territory = manager.getTerritory('backstage');

// Or use direct cache for performance:
const territory = territoryCache.get('backstage');

// Both are acceptable, choose based on context
```

---

### When to Use What

| Operation | Use Manager | Direct Cache OK | Notes |
|-----------|-------------|-----------------|-------|
| Assign performer to territories | ✅ Required | ❌ No | Count sync needed |
| Create territory | ✅ Required | ❌ No | Validation needed |
| Delete territory | ✅ Required | ❌ No | Reassignment needed |
| Get territory by name | ✅ Recommended | ✅ Yes | Manager adds no value |
| Get assignments | ✅ Recommended | ✅ Yes | Manager adds no value |
| Query territory summary | ✅ Required | ⚠️ Complex | Cross-cache operation |
| Bulk read operations | ⚠️ Either | ✅ Preferred | Avoid manager overhead |
| Validation operations | ✅ Required | ❌ No | Manager-only feature |

---

### Code Review Guidelines

When reviewing code that uses territory caches:

✅ **Good Patterns**:
```typescript
// Coordinated write
await manager.assignPerformer(id, territories);

// Cross-cache query
const summary = manager.getTerritorySummary(territory);

// Fast read with manager
const territory = manager.getTerritory(name);

// Fast read with direct cache (performance path)
const territory = territoryCache.get(name);
```

❌ **Anti-Patterns**:
```typescript
// Direct write - bypasses sync
assignmentCache.assign(id, territories);

// Manual sync - error-prone
assignmentCache.assign(id, territories);
territoryCache.updatePerformerCount(territory, count); // Might be wrong!

// Mixing writes across caches
territoryCache.upsert(name, updates);
assignmentCache.assign(id, [name]); // Count out of sync!
```

---

## Detailed Implementation Specs

---

### 1. TerritoryCacheManager

**Purpose**: Coordinate operations across TerritoryCache and TerritoryAssignmentCache to maintain referential integrity and synchronized performer counts.

**Location**: `src/territory/territory-cache-manager.ts`

**Dependencies**:
- `TerritoryCache` from `./territory-cache`
- `TerritoryAssignmentCache` from `./territory-assignment-cache`
- `Log` from `../utils/logger`
- `LogContext`, `Territory`, `TerritoryAssignment` from `../types/public`

**Class Structure**:

```typescript
export class TerritoryCacheManager {
  private managerLogger: LogContext;
  
  constructor(
    private territoryCache: TerritoryCache,
    private assignmentCache: TerritoryAssignmentCache
  )
  
  // Core coordination methods
  async assignPerformer(performerId: string, territories: string[]): Promise<void>
  async unassignPerformer(performerId: string): Promise<void>
  async addPerformerTerritory(performerId: string, territory: string): Promise<void>
  async removePerformerTerritory(performerId: string, territory: string): Promise<void>
  async setPrimaryTerritory(performerId: string, territory: string): Promise<void>
  
  // Territory management
  async createTerritory(name: string, description?: string): Promise<Territory>
  async deleteTerritory(name: string, reassignTo?: string): Promise<void>
  
  // Query operations
  getTerritorySummary(territoryName: string): TerritorySummary | null
  getPerformerTerritories(performerId: string): PerformerTerritoryInfo
  getAllTerritoriesWithCounts(): TerritoryWithCount[]
  
  // Synchronization
  async syncPerformerCounts(): Promise<Map<string, number>>
  async validateReferentialIntegrity(): Promise<ValidationResult>
  
  // Maintenance
  async cleanup(): Promise<void>
}
```

**Key Methods**:

#### assignPerformer()
```typescript
async assignPerformer(performerId: string, territories: string[]): Promise<void> {
  // 1. Validate all territories exist
  for (const territory of territories) {
    if (!this.territoryCache.has(territory)) {
      throw new ValidationError(`Territory '${territory}' does not exist`);
    }
  }
  
  // 2. Get old assignments for count diff
  const oldTerritories = this.assignmentCache.getAssignments(performerId);
  
  // 3. Update assignments
  this.assignmentCache.assign(performerId, territories);
  
  // 4. Update counts for affected territories
  await this.updateTerritoryCounts(oldTerritories, territories);
  
  Log.log(this.managerLogger, 
    `✅ Assigned performer ${performerId} to territories: ${territories.join(', ')}`
  );
}
```

#### updateTerritoryCounts()
```typescript
private async updateTerritoryCounts(
  oldTerritories: string[],
  newTerritories: string[]
): Promise<void> {
  // Get all affected territories (union of old and new)
  const affected = new Set([...oldTerritories, ...newTerritories]);
  
  // Recalculate count for each affected territory
  for (const territory of affected) {
    const performerCount = this.assignmentCache
      .getPerformersInTerritory(territory).length;
    
    this.territoryCache.updatePerformerCount(territory, performerCount);
  }
}
```

#### deleteTerritory()
```typescript
async deleteTerritory(name: string, reassignTo: string = 'general'): Promise<void> {
  // 1. Validate reassignment target exists
  if (!this.territoryCache.has(reassignTo)) {
    throw new ValidationError(`Reassignment target '${reassignTo}' does not exist`);
  }
  
  // 2. Get all performers in this territory
  const performers = this.assignmentCache.getPerformersInTerritory(name);
  
  // 3. Reassign each performer
  for (const performerId of performers) {
    const current = this.assignmentCache.getAssignments(performerId);
    const updated = current
      .filter(t => t !== name)
      .concat(current.includes(reassignTo) ? [] : [reassignTo]);
    
    await this.assignPerformer(performerId, updated);
  }
  
  // 4. Delete territory
  this.territoryCache.delete(name);
  
  Log.log(this.managerLogger, 
    `🗑️ Deleted territory '${name}', reassigned ${performers.length} performers to '${reassignTo}'`
  );
}
```

#### syncPerformerCounts()
```typescript
async syncPerformerCounts(): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  const territories = this.territoryCache.getAllNames();
  
  for (const territory of territories) {
    const performerCount = this.assignmentCache
      .getPerformersInTerritory(territory).length;
    
    this.territoryCache.updatePerformerCount(territory, performerCount);
    counts.set(territory, performerCount);
  }
  
  Log.log(this.managerLogger, 
    `🔄 Synchronized performer counts for ${territories.length} territories`
  );
  
  return counts;
}
```

#### validateReferentialIntegrity()
```typescript
async validateReferentialIntegrity(): Promise<ValidationResult> {
  const issues: string[] = [];
  const fixes: string[] = [];
  
  const allAssignments = this.assignmentCache.getAll();
  
  for (const assignment of allAssignments) {
    for (const territory of assignment.territories) {
      if (!this.territoryCache.has(territory)) {
        issues.push(
          `Performer ${assignment.performerId} assigned to non-existent territory '${territory}'`
        );
        
        // Auto-fix: remove invalid territory
        const valid = assignment.territories.filter(t => 
          this.territoryCache.has(t)
        );
        
        if (valid.length === 0) {
          valid.push('general');
          fixes.push(
            `Reassigned ${assignment.performerId} to 'general' (all territories invalid)`
          );
        }
        
        this.assignmentCache.assign(assignment.performerId, valid);
      }
    }
  }
  
  return {
    valid: issues.length === 0,
    issueCount: issues.length,
    issues,
    fixes
  };
}
```

**Return Types**:

```typescript
interface TerritorySummary {
  territory: Territory;
  performerIds: string[];
  performerCount: number;
}

interface PerformerTerritoryInfo {
  performerId: string;
  primary: Territory;
  all: Territory[];
  territoryNames: string[];
}

interface TerritoryWithCount {
  territory: Territory;
  performerCount: number;
}

interface ValidationResult {
  valid: boolean;
  issueCount: number;
  issues: string[];
  fixes: string[];
}
```

---

### 2. CacheInitializer

**Purpose**: Orchestrate initialization of all cache systems in correct dependency order, validate data integrity, and provide centralized startup logic.

**Location**: `src/territory/cache-initializer.ts`

**Dependencies**:
- `App` from `obsidian`
- `PersistentPerformerCache` from `../network/persistent-performer-cache`
- `TerritoryCache` from `./territory-cache`
- `TerritoryAssignmentCache` from `./territory-assignment-cache`
- `TerritoryCacheManager` from `./territory-cache-manager`
- `Log` from `../utils/logger`
- `LogContext` from `../types/public`

**Class Structure**:

```typescript
export class CacheInitializer {
  private initLogger: LogContext;
  private initializationPromise?: Promise<InitializedCaches>;
  private isInitialized = false;
  
  constructor(private app: App)
  
  // Initialization
  async initialize(): Promise<InitializedCaches>
  async waitForInitialization(): Promise<InitializedCaches>
  
  // Health checks
  async validateCaches(caches: InitializedCaches): Promise<CacheHealthReport>
  
  // Cleanup
  async cleanup(caches: InitializedCaches): Promise<void>
}
```

**Key Methods**:

#### initialize()
```typescript
async initialize(): Promise<InitializedCaches> {
  // Prevent duplicate initialization
  if (this.isInitialized) {
    throw new Error('CacheInitializer already initialized');
  }
  
  if (this.initializationPromise) {
    return await this.initializationPromise;
  }
  
  this.initializationPromise = this.performInitialization();
  return await this.initializationPromise;
}

private async performInitialization(): Promise<InitializedCaches> {
  const startTime = Date.now();
  
  Log.log(this.initLogger, '🎪 Starting cache initialization...');
  
  // Step 1: Initialize TerritoryCache (no dependencies)
  Log.log(this.initLogger, '📍 Initializing TerritoryCache...');
  const territoryCache = new TerritoryCache(this.app);
  await this.waitForCacheReady(territoryCache);
  Log.log(this.initLogger, `✅ TerritoryCache ready (${territoryCache.size()} territories)`);
  
  // Step 2: Initialize TerritoryAssignmentCache (depends on territories existing)
  Log.log(this.initLogger, '🎭 Initializing TerritoryAssignmentCache...');
  const assignmentCache = new TerritoryAssignmentCache(this.app);
  await this.waitForCacheReady(assignmentCache);
  Log.log(this.initLogger, `✅ TerritoryAssignmentCache ready (${assignmentCache.size()} assignments)`);
  
  // Step 3: Validate referential integrity
  Log.log(this.initLogger, '🔍 Validating referential integrity...');
  const manager = new TerritoryCacheManager(territoryCache, assignmentCache);
  const validation = await manager.validateReferentialIntegrity();
  
  if (!validation.valid) {
    Log.warn(this.initLogger, 
      `⚠️ Found ${validation.issueCount} integrity issues, applied ${validation.fixes.length} fixes`
    );
    for (const issue of validation.issues) {
      Log.warn(this.initLogger, `  - ${issue}`);
    }
  } else {
    Log.log(this.initLogger, '✅ Referential integrity validated');
  }
  
  // Step 4: Synchronize performer counts
  Log.log(this.initLogger, '🔄 Synchronizing performer counts...');
  await manager.syncPerformerCounts();
  
  // Step 5: Initialize PersistentPerformerCache (can run in parallel with territory caches)
  Log.log(this.initLogger, '🎪 Initializing PersistentPerformerCache...');
  const performerCache = new PersistentPerformerCache(this.app);
  await this.waitForCacheReady(performerCache);
  Log.log(this.initLogger, `✅ PersistentPerformerCache ready (${performerCache.size()} performers)`);
  
  const duration = Date.now() - startTime;
  Log.log(this.initLogger, `🎉 Cache initialization complete in ${duration}ms`);
  
  this.isInitialized = true;
  
  return {
    territoryCache,
    assignmentCache,
    performerCache,
    manager,
    initializationTime: duration,
    validation
  };
}
```

#### waitForCacheReady()
```typescript
private async waitForCacheReady(
  cache: TerritoryCache | TerritoryAssignmentCache | PersistentPerformerCache,
  timeoutMs: number = 10000
): Promise<void> {
  const startTime = Date.now();
  
  // Wait for internal initialization to complete
  // Each cache should expose an initialization promise
  while (!cache.isReady?.() && Date.now() - startTime < timeoutMs) {
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  
  if (Date.now() - startTime >= timeoutMs) {
    throw new Error(`Cache initialization timeout after ${timeoutMs}ms`);
  }
}
```

#### validateCaches()
```typescript
async validateCaches(caches: InitializedCaches): Promise<CacheHealthReport> {
  const report: CacheHealthReport = {
    healthy: true,
    checks: []
  };
  
  // Check territory cache
  const territoryCount = caches.territoryCache.size();
  report.checks.push({
    name: 'TerritoryCache',
    status: territoryCount > 0 ? 'healthy' : 'warning',
    message: `${territoryCount} territories loaded`,
    details: { count: territoryCount }
  });
  
  // Check assignment cache
  const assignmentCount = caches.assignmentCache.size();
  report.checks.push({
    name: 'TerritoryAssignmentCache',
    status: 'healthy',
    message: `${assignmentCount} assignments loaded`,
    details: { count: assignmentCount }
  });
  
  // Check performer cache
  const performerCount = caches.performerCache.size();
  const metrics = caches.performerCache.getMetrics();
  report.checks.push({
    name: 'PersistentPerformerCache',
    status: 'healthy',
    message: `${performerCount} performers cached`,
    details: { 
      count: performerCount,
      hitRate: metrics.hitRate,
      evictions: metrics.evictions
    }
  });
  
  // Check referential integrity
  const validation = await caches.manager.validateReferentialIntegrity();
  report.checks.push({
    name: 'ReferentialIntegrity',
    status: validation.valid ? 'healthy' : 'warning',
    message: validation.valid 
      ? 'All references valid' 
      : `${validation.issueCount} issues found`,
    details: { 
      issueCount: validation.issueCount,
      issues: validation.issues
    }
  });
  
  report.healthy = report.checks.every(c => c.status === 'healthy');
  
  return report;
}
```

**Return Types**:

```typescript
interface InitializedCaches {
  territoryCache: TerritoryCache;
  assignmentCache: TerritoryAssignmentCache;
  performerCache: PersistentPerformerCache;
  manager: TerritoryCacheManager;
  initializationTime: number;
  validation: ValidationResult;
}

interface CacheHealthReport {
  healthy: boolean;
  checks: HealthCheck[];
}

interface HealthCheck {
  name: string;
  status: 'healthy' | 'warning' | 'error';
  message: string;
  details?: Record<string, unknown>;
}
```

---

### 3. Eviction Hooks (Integration Enhancement)

**Purpose**: Clean up territory assignments when performers are evicted from the performer cache.

**Location**: Modify `src/network/persistent-performer-cache.ts`

**Changes Required**:

```typescript
// Add to PersistentPerformerCache class

private evictionHandlers: Array<(id: string, performer?: Performer) => void> = [];

/**
 * Register a handler to be called when a performer is evicted
 */
registerEvictionHandler(handler: (id: string, performer?: Performer) => void): void {
  this.evictionHandlers.push(handler);
}

/**
 * Unregister an eviction handler
 */
unregisterEvictionHandler(handler: (id: string, performer?: Performer) => void): void {
  const index = this.evictionHandlers.indexOf(handler);
  if (index > -1) {
    this.evictionHandlers.splice(index, 1);
  }
}

private evictLRU(): void {
  if (this.accessOrder.length === 0) {
    return;
  }

  const lruId = this.accessOrder[0];
  const entry = this.cache.get(lruId);
  
  // Call all registered handlers BEFORE deleting
  for (const handler of this.evictionHandlers) {
    try {
      handler(lruId, entry?.performer);
    } catch (error) {
      Log.error(
        this.cacheLogger,
        `Eviction handler failed for ${lruId}:`,
        error
      );
    }
  }
  
  this.cache.delete(lruId);
  this.accessOrder.shift();
  this.metrics.evictions++;
  
  Log.log(
    this.cacheLogger,
    `🎭 Evicted LRU performer: ${entry?.performer.name ?? lruId}`
  );
}
```

**Usage in CacheInitializer**:

```typescript
// In performInitialization(), after all caches created:

// Register eviction handler to clean up assignments
performerCache.registerEvictionHandler((performerId) => {
  Log.log(
    this.initLogger,
    `🧹 Cleaning up assignments for evicted performer: ${performerId}`
  );
  assignmentCache.delete(performerId);
  
  // Recalculate counts for affected territories
  manager.syncPerformerCounts().catch(error => {
    Log.error(this.initLogger, 'Failed to sync counts after eviction:', error);
  });
});
```

---

### 4. Cross-Cache Queries (Manager Enhancement)

**Purpose**: Add convenience methods to TerritoryCacheManager for common multi-cache queries.

**Location**: Add to `src/territory/territory-cache-manager.ts`

**New Methods**:

```typescript
/**
 * Get comprehensive summary of a territory
 */
getTerritorySummary(territoryName: string): TerritorySummary | null {
  const territory = this.territoryCache.get(territoryName);
  if (!territory) {
    return null;
  }
  
  const performerIds = this.assignmentCache.getPerformersInTerritory(territoryName);
  
  return {
    territory,
    performerIds,
    performerCount: performerIds.length
  };
}

/**
 * Get all territories a performer belongs to
 */
getPerformerTerritories(performerId: string): PerformerTerritoryInfo {
  const assignment = this.assignmentCache.get(performerId);
  
  if (!assignment) {
    // Return default 'general' territory
    const general = this.territoryCache.get('general');
    return {
      performerId,
      primary: general!,
      all: general ? [general] : [],
      territoryNames: general ? ['general'] : []
    };
  }
  
  const primary = this.territoryCache.get(assignment.primaryTerritory)!;
  const all = assignment.territories
    .map(name => this.territoryCache.get(name))
    .filter((t): t is Territory => t !== null);
  
  return {
    performerId,
    primary,
    all,
    territoryNames: assignment.territories
  };
}

/**
 * Get all territories with their current performer counts
 */
getAllTerritoriesWithCounts(): TerritoryWithCount[] {
  const territories = this.territoryCache.getAll();
  
  return territories.map(territory => ({
    territory,
    performerCount: this.assignmentCache
      .getPerformersInTerritory(territory.name).length
  }));
}

/**
 * Find territories by performer count range
 */
findTerritoriesByPerformerCount(
  min: number,
  max: number = Infinity
): TerritoryWithCount[] {
  return this.getAllTerritoriesWithCounts()
    .filter(t => t.performerCount >= min && t.performerCount <= max)
    .sort((a, b) => b.performerCount - a.performerCount);
}

/**
 * Get performers shared across multiple territories
 */
getSharedPerformers(): Map<string, string[]> {
  const shared = new Map<string, string[]>();
  const allAssignments = this.assignmentCache.getAll();
  
  for (const assignment of allAssignments) {
    if (assignment.territories.length > 1) {
      shared.set(assignment.performerId, assignment.territories);
    }
  }
  
  return shared;
}
```

---

### 5. Metrics Integration (Optional Enhancement)

**Purpose**: Report cache statistics to the global metrics system for monitoring.

**Location**: Modify each cache class

**Changes for TerritoryCache**:

```typescript
import { globalMetrics } from '../observability/global-metrics';

// Add after each operation that changes cache state:

private updateMetrics(): void {
  globalMetrics.recordGauge('cache.territory.size', this.cache.size, {
    type: 'territory'
  });
  
  globalMetrics.recordGauge('cache.territory.dirty', this.isDirty ? 1 : 0, {
    type: 'territory'
  });
}

// Call in: set(), delete(), clear(), upsert()
```

**Changes for TerritoryAssignmentCache**:

```typescript
private updateMetrics(): void {
  globalMetrics.recordGauge('cache.assignment.size', this.cache.size, {
    type: 'assignment'
  });
  
  globalMetrics.recordGauge('cache.assignment.dirty', this.isDirty ? 1 : 0, {
    type: 'assignment'
  });
  
  // Territory distribution
  const territoryCounts = new Map<string, number>();
  for (const assignment of this.cache.values()) {
    for (const territory of assignment.territories) {
      territoryCounts.set(territory, (territoryCounts.get(territory) ?? 0) + 1);
    }
  }
  
  for (const [territory, count] of territoryCounts) {
    globalMetrics.recordGauge('cache.assignment.territory_count', count, {
      territory
    });
  }
}
```

**Changes for PersistentPerformerCache**:

```typescript
// Already has metrics, enhance with globalMetrics reporting:

private updateMetrics(): void {
  // Existing updateMemoryMetrics() logic...
  
  // Add global metrics reporting
  globalMetrics.recordGauge('cache.performer.size', this.cache.size, {
    type: 'performer'
  });
  
  globalMetrics.recordGauge('cache.performer.memory', this.metrics.memoryUsage, {
    type: 'performer'
  });
  
  globalMetrics.recordGauge('cache.performer.hit_rate', this.getMetrics().hitRate, {
    type: 'performer'
  });
}
```

---

### 6. Storage Path Organization (Future Enhancement)

**Purpose**: Organize cache storage files into a structured directory.

**Location**: `src/territory/storage-paths.ts` (new file)

**Implementation**:

```typescript
/**
 * Centralized storage paths for territory caching system
 */
export const TERRITORY_STORAGE_PATHS = {
  baseDir: '.obsidian/plugins/carnival-network/data',
  
  territories: '.obsidian/plugins/carnival-network/data/territories.json',
  assignments: '.obsidian/plugins/carnival-network/data/territory-assignments.json',
  performers: '.obsidian/plugins/carnival-network/data/performer-cache.json',
  
  // Future: Archive paths for Phase 4
  archive: {
    baseDir: '.obsidian/plugins/carnival-network/archive',
    acts: '.obsidian/plugins/carnival-network/archive/acts.db',
    metadata: '.obsidian/plugins/carnival-network/archive/metadata.db'
  }
} as const;

/**
 * Ensure storage directories exist
 */
export async function ensureStorageDirectories(app: App): Promise<void> {
  const { vault } = app;
  const dirs = [
    TERRITORY_STORAGE_PATHS.baseDir,
    TERRITORY_STORAGE_PATHS.archive.baseDir
  ];
  
  for (const dir of dirs) {
    try {
      await vault.adapter.mkdir(dir);
    } catch (error) {
      // Directory might already exist, ignore
    }
  }
}
```

---

## Integration Points

### Plugin Main (main.ts)

```typescript
import { CacheInitializer } from './territory/cache-initializer';
import type { InitializedCaches } from './territory/cache-initializer';

export default class CarnivalNetworkPlugin extends Plugin {
  private caches?: InitializedCaches;
  
  async onload() {
    // Initialize caches early in plugin lifecycle
    const initializer = new CacheInitializer(this.app);
    this.caches = await initializer.initialize();
    
    // Validate cache health
    const health = await initializer.validateCaches(this.caches);
    if (!health.healthy) {
      console.warn('⚠️ Cache initialization warnings:', health);
    }
    
    // Pass caches to services that need them
    this.actService = new ActService(
      this.caches.performerCache,
      this.caches.manager
    );
    
    // ... rest of initialization
  }
  
  async onunload() {
    if (this.caches) {
      const initializer = new CacheInitializer(this.app);
      await initializer.cleanup(this.caches);
    }
  }
}
```

### ActService Integration

```typescript
export class ActService {
  constructor(
    private performerCache: PersistentPerformerCache,
    private territoryManager: TerritoryCacheManager
  ) {}
  
  async createAct(actData: ActCreateData): Promise<CarnivalAct> {
    // Use territory manager to route to correct territory
    const performerInfo = this.territoryManager.getPerformerTerritories(
      actData.metadata.performerId
    );
    
    // Use primary territory for routing
    const targetTerritory = performerInfo.primary.name;
    
    // ... rest of act creation
  }
}
```

---

## Testing Strategy

### Unit Tests

**TerritoryCacheManager Tests**:
- assignPerformer() validates territories exist
- deleteTerritory() reassigns performers correctly
- syncPerformerCounts() updates all territories
- validateReferentialIntegrity() finds and fixes issues

**CacheInitializer Tests**:
- Initialization order is correct (territories → assignments → performers)
- Validation runs automatically
- Timeout handling works
- Cleanup is thorough

**Eviction Hooks Tests**:
- Handlers are called on eviction
- Handler errors don't break eviction
- Multiple handlers are supported
- Unregister works correctly

### Integration Tests

- Full plugin initialization with real caches
- Territory creation and performer assignment flows
- Eviction triggers assignment cleanup
- Cross-cache queries return correct data

### Manual Testing Checklist

- [ ] Plugin loads with caches initialized
- [ ] Create territory via manager
- [ ] Assign performer to territory
- [ ] Verify performer count updates
- [ ] Delete territory with reassignment
- [ ] Trigger performer eviction
- [ ] Verify assignment cleanup
- [ ] Check cache health report
- [ ] Validate referential integrity with corrupt data
- [ ] Restart plugin and verify persistence

---

## Migration Path

### Phase 3.3 (Current)
- Implement TerritoryCacheManager ✓
- Implement CacheInitializer ✓
- Add eviction hooks ✓
- Update plugin integration ✓

### Phase 3.4 (Webhook Infrastructure)
- Cross-cache queries for webhook handlers
- Metrics integration for monitoring
- Storage path organization

### Phase 4 (Archive/RxDB)
- Replace vault storage with RxDB
- Keep cache interfaces unchanged
- Archive abstraction handles persistence

---

## Success Criteria

- ✅ All caches initialize in correct order
- ✅ Referential integrity is validated and maintained
- ✅ Performer counts stay synchronized
- ✅ Evictions clean up assignments
- ✅ Zero TypeScript errors
- ✅ Zero breaking changes to existing code
- ✅ Comprehensive logging at all stages
- ✅ Cross-cache queries work efficiently
- ✅ Plugin startup time < 500ms with 1000 cached items

---

## Document History

**Version 1.0** - 2025-01-18
- Initial implementation plan
- Detailed specs for TerritoryCacheManager and CacheInitializer
- Integration patterns documented
- Testing strategy outlined

---

*"Through systematic coordination, the caches become a symphony. Each component plays its part, and together they create harmony across the carnival empire."* - The Management