# 🗺️ Cache-Based Territory System - Implementation Summary

## Overview

Territory data is now managed using persistent caches (similar to `PersistentPerformerCache`) instead of storing in plugin settings. This keeps settings clean and focused on configuration while providing a scalable data storage pattern.

---

## Architecture

### Data Storage

```
.obsidian/plugins/carnival-network/
├── data.json                              # Plugin settings (config only)
├── carnival-territories.json              # Territory definitions (TerritoryCache)
├── carnival-territory-assignments.json    # Performer assignments (TerritoryAssignmentCache)
└── carnival-performer-cache.json          # Performer cache (existing)
```

### Cache Classes

```typescript
┌─────────────────────────────────┐
│     TerritoryCache              │
│  (Territory Definitions)        │
│                                 │
│ Stores:                         │
│ - Territory name                │
│ - Description                   │
│ - Status (active/inactive)      │
│ - Performer count               │
│ - Metadata                      │
│ - Timestamps                    │
└─────────────────────────────────┘

┌─────────────────────────────────┐
│  TerritoryAssignmentCache       │
│  (Performer → Territories)      │
│                                 │
│ Stores:                         │
│ - Performer ID                  │
│ - Assigned territories []       │
│ - Primary territory             │
│ - Timestamps                    │
└─────────────────────────────────┘
```

---

## Key Benefits

### 1. Clean Settings
```typescript
// BEFORE ❌
interface CarnivalConfig {
  performerTerritories?: string[];  // Bloats settings
  // ... other config ...
}

// AFTER ✅
interface CarnivalConfig {
  territoryConfig?: {
    defaultTerritory: string;  // Minimal config only
  };
  // ... other config ...
}
```

### 2. Scalable Storage
- Territory data can grow independently
- No settings file bloat
- Background auto-save (5 min intervals)
- Efficient JSON serialization

### 3. Better Querying
```typescript
// Get all territories
const territories = territoryCache.getAll();

// Get performers in a territory
const performers = assignmentCache.getPerformersInTerritory('backstage');

// Get territory details
const territory = territoryCache.get('backstage');
```

### 4. Follows Existing Patterns
- Same pattern as `PersistentPerformerCache`
- Familiar API
- Easy to understand
- Prepares for RxDB migration

---

## Usage Examples

### Initialize in Registry Manager

```typescript
export class CarnivalRegistryManager {
  private territoryCache: TerritoryCache;
  private assignmentCache: TerritoryAssignmentCache;

  constructor(plugin: CarnivalNetworkPlugin, store: APIKeyStore) {
    // ... other initialization ...
    
    // Initialize territory caches
    this.territoryCache = new TerritoryCache(plugin.app);
    this.assignmentCache = new TerritoryAssignmentCache(plugin.app);
  }
}
```

### Create/Update Territories

```typescript
// Create or update territory
manager.upsertTerritory('backstage', {
  description: 'Development and staging area',
  status: 'active'
});

// Get territory details
const territory = manager.getTerritoryDetails('backstage');
console.log(territory.performerCount);
```

### Manage Assignments

```typescript
// Assign performer to territories
await manager.assignTerritories(['backstage', 'workshop']);

// Add a territory
await manager.addTerritory('library');

// Remove a territory
await manager.removeTerritory('workshop');

// Set primary territory
await manager.setPrimaryTerritory('library');

// Get assignments
const territories = manager.getAssignedTerritories();
console.log(territories); // ['library', 'backstage']

// Get primary
const primary = manager.getPrimaryTerritory();
console.log(primary); // 'library'
```

### Query Operations

```typescript
// Get all known territories
const allTerritories = manager.getKnownTerritories();
// Returns: ['backstage', 'general', 'library', 'workshop']

// Get performers in territory
const performers = assignmentCache.getPerformersInTerritory('backstage');
// Returns: ['performer-1', 'performer-2']

// Check if assigned
const isAssigned = assignmentCache.isAssigned('performer-1', 'backstage');
// Returns: true
```

---

## API Reference

### TerritoryCache

```typescript
class TerritoryCache {
  // Core operations
  get(name: string): Territory | null
  set(name: string, territory: Territory): void
  has(name: string): boolean
  delete(name: string): boolean
  
  // Query operations
  getAll(): Territory[]
  getAllNames(): string[]
  getActive(): Territory[]
  
  // Upsert operation
  upsert(name: string, updates: Partial<Territory>): Territory
  
  // Utility
  clear(): void
  size(): number
  updatePerformerCount(name: string, count: number): void
  
  // Persistence
  flush(): Promise<void>
  cleanup(): Promise<void>
}
```

### TerritoryAssignmentCache

```typescript
class TerritoryAssignmentCache {
  // Core operations
  get(performerId: string): TerritoryAssignment | null
  assign(performerId: string, territories: string[]): void
  delete(performerId: string): boolean
  
  // Assignment operations
  getAssignments(performerId: string): string[]
  getPrimaryTerritory(performerId: string): string
  isAssigned(performerId: string, territory: string): boolean
  addTerritory(performerId: string, territory: string): void
  removeTerritory(performerId: string, territory: string): void
  setPrimaryTerritory(performerId: string, territory: string): void
  
  // Query operations
  getPerformersInTerritory(territory: string): string[]
  getAll(): TerritoryAssignment[]
  
  // Utility
  clear(): void
  size(): number
  
  // Persistence
  flush(): Promise<void>
  cleanup(): Promise<void>
}
```

### CarnivalRegistryManager (Updated)

```typescript
class CarnivalRegistryManager {
  // Territory management
  getAssignedTerritories(performerId?: string): string[]
  getPrimaryTerritory(performerId?: string): string
  assignTerritories(territories: string[], performerId?: string): Promise<void>
  addTerritory(territory: string, performerId?: string): Promise<void>
  removeTerritory(territory: string, performerId?: string): Promise<void>
  setPrimaryTerritory(territory: string, performerId?: string): Promise<void>
  
  // Territory queries
  getKnownTerritories(): string[]
  getTerritoryDetails(territory: string): Territory | null
  upsertTerritory(name: string, updates: Partial<Territory>): Territory
  
  // Performer info (updated signature)
  buildPerformerInfo(performerId: string, territory: string): Promise<PerformerRegistrationInfo>
}
```

---

## Data Structures

### Territory

```typescript
interface Territory {
  name: string;
  description?: string;
  performerCount: number;
  status: 'active' | 'inactive' | 'establishing';
  establishedAt?: string;
  lastActivity?: string;
  metadata?: Record<string, unknown>;
}
```

### TerritoryAssignment

```typescript
interface TerritoryAssignment {
  performerId: string;
  territories: string[];
  primaryTerritory: string;
  createdAt: string;
  updatedAt: string;
}
```

---

## Storage Format

### carnival-territories.json

```json
{
  "territories": {
    "backstage": {
      "name": "backstage",
      "description": "Development and staging area",
      "performerCount": 3,
      "status": "active",
      "establishedAt": "2025-01-15T10:00:00Z",
      "lastActivity": "2025-01-20T15:30:00Z",
      "metadata": {}
    },
    "general": {
      "name": "general",
      "description": "Default territory for all performers",
      "performerCount": 10,
      "status": "active",
      "establishedAt": "2025-01-01T00:00:00Z",
      "lastActivity": "2025-01-20T16:00:00Z",
      "metadata": {}
    }
  },
  "savedAt": "2025-01-20T16:00:00Z"
}
```

### carnival-territory-assignments.json

```json
{
  "assignments": {
    "performer-1": {
      "performerId": "performer-1",
      "territories": ["backstage", "workshop", "library"],
      "primaryTerritory": "backstage",
      "createdAt": "2025-01-15T10:00:00Z",
      "updatedAt": "2025-01-20T15:30:00Z"
    },
    "performer-2": {
      "performerId": "performer-2",
      "territories": ["general"],
      "primaryTerritory": "general",
      "createdAt": "2025-01-10T09:00:00Z",
      "updatedAt": "2025-01-10T09:00:00Z"
    }
  },
  "savedAt": "2025-01-20T16:00:00Z"
}
```

---

## Migration Strategy

### Automatic Migration (Optional)

If you want to migrate existing `settings.performerTerritories`:

```typescript
// In CarnivalRegistryManager constructor, after cache initialization
private async migrateFromSettings(): Promise<void> {
  // Check if old setting exists
  const oldTerritories = this.plugin.settings.performerTerritories;
  
  if (oldTerritories && oldTerritories.length > 0) {
    const performerId = this.getCurrentPerformerId();
    
    // Migrate to assignment cache
    this.assignmentCache.assign(performerId, oldTerritories);
    
    // Create territories in territory cache
    for (const territory of oldTerritories) {
      if (!this.territoryCache.has(territory)) {
        this.territoryCache.upsert(territory, {
          description: `Migrated territory: ${territory}`,
          status: 'active'
        });
      }
    }
    
    // Clear old setting
    delete this.plugin.settings.performerTerritories;
    await this.plugin.saveSettings();
    
    Log.log(this.registryLogger, `Migrated ${oldTerritories.length} territories to cache`);
  }
}
```

### First-Time Setup

When no territories exist, initialize with default:

```typescript
// In TerritoryCache.loadFromStorage()
if (this.cache.size === 0) {
  // Create default 'general' territory
  this.upsert('general', {
    description: 'Default territory for all performers',
    status: 'active'
  });
}

// In TerritoryAssignmentCache (when performer has no assignments)
if (!this.assignmentCache.get(performerId)) {
  this.assignmentCache.assign(performerId, ['general']);
}
```

---

## Comparison: Settings vs Cache

### Before (Settings-Based) ❌

**Pros:**
- Simple to implement
- All data in one place

**Cons:**
- Settings file bloat
- No structured queries
- Hard to scale
- Mixes config with data

**Example:**
```json
{
  "performerTerritories": ["backstage", "workshop", "library"],
  "heartbeatInterval": 30000,
  "communicationTimeout": 5000
  // Settings + data mixed together
}
```

### After (Cache-Based) ✅

**Pros:**
- Clean settings (config only)
- Structured data storage
- Efficient queries
- Scales independently
- Follows existing patterns
- Prepares for RxDB

**Cons:**
- Slightly more complex
- Multiple files to manage

**Example:**
```json
// data.json (config only)
{
  "territoryConfig": { "defaultTerritory": "general" },
  "heartbeatInterval": 30000,
  "communicationTimeout": 5000
}

// carnival-territory-assignments.json (data)
{
  "assignments": {
    "performer-1": {
      "territories": ["backstage", "workshop", "library"],
      "primaryTerritory": "backstage"
    }
  }
}
```

---

## Future: RxDB Integration

This cache-based approach prepares for RxDB migration:

```typescript
// Future: RxDB collections
const territoriesCollection = db.collection('territories');
const assignmentsCollection = db.collection('assignments');

// Query with RxDB
const territories = await territoriesCollection
  .find()
  .where('status').eq('active')
  .exec();

// Reactive queries
territoriesCollection.find().$.subscribe(territories => {
  // Auto-updates when data changes
});
```

The cache pattern provides a smooth migration path to RxDB while maintaining the same API surface.

---

## Testing

### Unit Tests

```typescript
describe('TerritoryCache', () => {
  it('should store and retrieve territories', () => {
    const cache = new TerritoryCache(app);
    cache.set('test', { name: 'test', performerCount: 0, status: 'active' });
    expect(cache.get('test')).toBeDefined();
  });
  
  it('should persist to storage', async () => {
    const cache = new TerritoryCache(app);
    cache.set('test', { name: 'test', performerCount: 0, status: 'active' });
    await cache.flush();
    
    // Verify file exists
    const exists = await app.vault.adapter.exists('carnival-territories.json');
    expect(exists).toBe(true);
  });
});

describe('TerritoryAssignmentCache', () => {
  it('should manage assignments', () => {
    const cache = new TerritoryAssignmentCache(app);
    cache.assign('performer-1', ['backstage', 'workshop']);
    
    const assignments = cache.getAssignments('performer-1');
    expect(assignments).toEqual(['backstage', 'workshop']);
    expect(cache.getPrimaryTerritory('performer-1')).toBe('backstage');
  });
  
  it('should ensure at least one territory', () => {
    const cache = new TerritoryAssignmentCache(app);
    cache.assign('performer-1', ['backstage']);
    cache.removeTerritory('performer-1', 'backstage');
    
    const assignments = cache.getAssignments('performer-1');
    expect(assignments).toEqual(['general']);
  });
});
```

---

## Troubleshooting

### Cache not persisting

**Check:**
- Background save enabled: `backgroundSaveEnabled: true`
- No write permission issues
- File path correct

**Solution:**
```typescript
// Force save
await territoryCache.flush();
await assignmentCache.flush();
```

### Assignments not loading after restart

**Check:**
- Cache initialization called
- File exists at correct path
- JSON is valid

**Solution:**
```typescript
// Debug load
const path = 'carnival-territory-assignments.json';
const exists = await app.vault.adapter.exists(path);
console.log('File exists:', exists);

if (exists) {
  const content = await app.vault.adapter.read(path);
  console.log('Content:', content);
}
```

### Territory doesn't exist in cache

**Solution:**
```typescript
// Auto-create when assigning
if (!territoryCache.has(territory)) {
  territoryCache.upsert(territory, {
    description: `Territory: ${territory}`,
    status: 'active'
  });
}
```

---

## Summary

The cache-based territory system provides:

✅ **Clean Settings** - Config only, no data bloat  
✅ **Scalable Storage** - Separate JSON files for data  
✅ **Structured Queries** - Efficient data access  
✅ **Familiar Pattern** - Same as PersistentPerformerCache  
✅ **RxDB Ready** - Easy migration path  
✅ **Background Saves** - Automatic persistence  
✅ **Type Safe** - Full TypeScript support  

This architecture keeps the codebase clean, maintainable, and ready for future enhancements.