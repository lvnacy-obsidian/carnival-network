# 📚 Archive Abstraction Layer - Implementation Guide

**Purpose**: Clean separation between business logic and storage backend  
**Pattern**: Adapter Pattern for storage flexibility  
**Theme**: "Archive" - carnival's tome of records, old-world preservation

---

## Overview

The Archive Abstraction Layer provides a unified interface for storing and querying Carnival Records, enabling seamless backend swapping without changing business logic.

### Current Implementations

1. **InMemoryArchive** - Fast, ephemeral storage (current ActService storage)
2. **CacheArchive** - PersistentPerformerCache wrapper (permanent fallback layer)
3. **MockArchive** - Testing utility with call tracking
4. **RxDBArchive** - [Phase 4] RxDB integration (planned)

---

## Architecture

```
ActService (Business Logic)
       ↓
  ArchiveInterface (Contract)
       ↓
┌──────┴──────┬──────────┬────────────┐
│             │          │            │
InMemoryArchive  CacheArchive  RxDBArchive  MockArchive
(current)     (fallback)  (phase 4)  (testing)
```

---

## Core Interface

### CRUD Operations

```typescript
// Create
const record = await archive.create({
  id: 'act-123',
  title: 'New Act',
  territory: 'backstage',
  // ...
});

// Read
const single = await archive.findById('act-123');
const multiple = await archive.find({
  territory: 'backstage',
  actType: 'changelog',
  limit: 10
});

// Update
const updated = await archive.update('act-123', {
  status: 'archived'
});

// Delete
const deleted = await archive.delete('act-123');
```

### Query Operations

```typescript
// Count
const count = await archive.count({
  territory: 'backstage',
  status: 'active'
});

// Exists
const exists = await archive.exists('act-123');

// All records (use cautiously)
const all = await archive.all();
```

### Batch Operations

```typescript
// Bulk create
const createResult = await archive.bulkCreate([
  record1, record2, record3
]);
console.log(`Created: ${createResult.successful.length}`);
console.log(`Failed: ${createResult.failed.length}`);

// Bulk update
const updateResult = await archive.bulkUpdate([
  { id: 'act-1', updates: { status: 'archived' } },
  { id: 'act-2', updates: { status: 'cancelled' } }
]);

// Bulk delete
const deleteResult = await archive.bulkDelete(['act-1', 'act-2']);
```

---

## InMemoryArchive

Fast ephemeral storage with automatic indexing.

### Characteristics

- ⚡ **Extremely Fast** - No I/O operations
- 🚫 **No Persistence** - Data lost on restart
- 📊 **Indexed** - Fast queries via indexes
- 💾 **Low Memory** - Efficient storage

### Indexes

Automatically maintained indexes:
- `byTerritory` - Fast territory filtering
- `byActType` - Fast type filtering
- `byStatus` - Fast status filtering
- `byPerformer` - Fast performer filtering

### Usage

```typescript
import { InMemoryArchive } from './storage/in-memory-archive';

const archive = new InMemoryArchive();

// Use immediately - no initialization required
await archive.create(record);
const results = await archive.find({ territory: 'backstage' });
```

### Performance

- **Create**: O(1) with index updates
- **FindById**: O(1) hash lookup
- **Find**: O(n) where n = matching records after index filtering
- **Update**: O(1) with index updates
- **Delete**: O(1) with index updates

---

## MockArchive

Testing utility with call tracking and configurable behavior.

### Features

- 📝 **Call Tracking** - Records all method calls
- ⚙️ **Configurable Errors** - Throw errors for specific methods
- ⏱️ **Latency Simulation** - Simulate async operations
- 🎭 **Test Data** - Seed with test records

### Usage

```typescript
import { MockArchive, createMockRecord } from './storage/mock-archive';

// Basic usage
const mock = new MockArchive();
mock.seed([createMockRecord(), createMockRecord()]);

// Configure errors
const mock = new MockArchive({
  throwOn: {
    create: new Error('Database error'),
    update: new Error('Validation failed')
  },
  latency: 100 // Simulate 100ms delay
});

// Verify calls
await mock.create(record);
const calls = mock.getCallsFor('create');
expect(calls).toHaveLength(1);
expect(calls[0].args[0]).toEqual(record);
```

### Test Helpers

```typescript
// Create single mock record
const record = createMockRecord({
  title: 'Custom Title',
  territory: 'backstage'
});

// Create multiple mock records
const records = createMockRecords(10, {
  actType: 'changelog'
});
```

---

## Migration Guide

### Step 1: Update ActService

**Before**:
```typescript
export class ActService {
  private acts: Map<string, CarnivalRecord> = new Map();
  
  createAct(params: CreateActParams): CarnivalRecord {
    const record = { /* ... */ };
    this.acts.set(record.id, record);
    return record;
  }
  
  queryActs(options: ActQueryOptions): CarnivalRecord[] {
    const acts = Array.from(this.acts.values());
    // Filter and return...
  }
}
```

**After**:
```typescript
export class ActService {
  private archive: ArchiveInterface;
  
  constructor(
    private readonly territoryAccess: TerritoryAccessService,
    private readonly config: CarnivalConfig,
    archive?: ArchiveInterface // Optional injection
  ) {
    // Default to InMemoryArchive if not provided
    this.archive = archive ?? new InMemoryArchive();
  }
  
  async createAct(params: CreateActParams): Promise<CarnivalRecord> {
    const record = { /* ... */ };
    return await this.archive.create(record);
  }
  
  async queryActs(options: ActQueryOptions): Promise<CarnivalRecord[]> {
    return await this.archive.find(options);
  }
}
```

### Step 2: Update Method Signatures

**Convert sync → async**:
```typescript
// Before
queryActs(options: ActQueryOptions): CarnivalRecord[]

// After
async queryActs(options: ActQueryOptions): Promise<CarnivalRecord[]>
```

### Step 3: Update Callers

```typescript
// Before
const acts = service.queryActs(options);

// After
const acts = await service.queryActs(options);
```

---

## Query Options

### Filtering

```typescript
interface ArchiveQueryOptions {
  // Core filters
  territory?: string;
  actType?: string;
  status?: 'active' | 'archived' | 'cancelled';
  performerId?: string;
  
  // Date range
  dateRange?: {
    start: string; // ISO timestamp
    end: string;   // ISO timestamp
  };
  
  // Pagination
  limit?: number;
  offset?: number;
  
  // Sorting
  sortBy?: 'createdAt' | 'updatedAt' | 'title' | 'territory';
  sortOrder?: 'asc' | 'desc';
}
```

### Examples

```typescript
// Recent acts in territory
const recent = await archive.find({
  territory: 'backstage',
  sortBy: 'createdAt',
  sortOrder: 'desc',
  limit: 10
});

// Active changelogs by performer
const changelogs = await archive.find({
  actType: 'changelog',
  status: 'active',
  performerId: 'performer-123'
});

// Acts in date range
const ranged = await archive.find({
  dateRange: {
    start: '2025-01-01T00:00:00Z',
    end: '2025-12-31T23:59:59Z'
  }
});

// Paginated results
const page2 = await archive.find({
  territory: 'backstage',
  limit: 20,
  offset: 20 // Skip first 20
});
```

---

## Statistics & Monitoring

```typescript
// Get archive statistics
const stats = await archive.stats();

console.log(`Total Records: ${stats.totalRecords}`);
console.log(`Territories:`, stats.recordsByTerritory);
console.log(`Types:`, stats.recordsByType);
console.log(`Oldest: ${stats.oldestRecord}`);
console.log(`Newest: ${stats.newestRecord}`);
console.log(`Storage: ${stats.storageSize} bytes`);
```

---

## Testing

### Unit Testing ActService

```typescript
import { MockArchive, createMockRecord } from './storage/mock-archive';
import { ActService } from './act-service';

describe('ActService', () => {
  let service: ActService;
  let archive: MockArchive;
  
  beforeEach(() => {
    archive = new MockArchive();
    service = new ActService(territoryAccess, config, archive);
  });
  
  it('should create acts', async () => {
    const record = await service.createAct({
      title: 'Test Act',
      territory: 'backstage',
      actType: 'changelog',
      content: 'Test content'
    });
    
    // Verify archive was called
    const calls = archive.getCallsFor('create');
    expect(calls).toHaveLength(1);
    
    // Verify data
    const data = archive.getData();
    expect(data).toHaveLength(1);
    expect(data[0].title).toBe('Test Act');
  });
  
  it('should handle errors', async () => {
    // Configure mock to throw
    archive = new MockArchive({
      throwOn: {
        create: new Error('Database error')
      }
    });
    service = new ActService(territoryAccess, config, archive);
    
    // Verify error handling
    await expect(service.createAct({...})).rejects.toThrow('Database error');
  });
});
```

---

## Advanced Features

### Optional Features

Some archives may not support all features:

```typescript
import { supportsTransactions, supportsIndexes } from './archive-interface';

// Check transaction support
if (supportsTransactions(archive)) {
  const tx = await archive.beginTransaction();
  await tx.create(record1);
  await tx.create(record2);
  await tx.commit();
}

// Check index support
if (supportsIndexes(archive)) {
  await archive.createIndex('territory', { unique: false });
  await archive.rebuildIndexes();
}
```

---

## Phase 4 Preparation

### RxDB Integration Strategy

When Phase 4 arrives, the RxDB implementation will:

1. **Implement ArchiveInterface** - No business logic changes
2. **Use RxDB Collections** - Store acts in RxDB collection
3. **Reactive Queries** - Observable-based queries for UI updates
4. **Offline-First** - Works without network connectivity
5. **Fallback to Cache** - CacheArchive as backup

### Migration Path

```typescript
// Phase 3: InMemoryArchive
const archive = new InMemoryArchive();

// Phase 4: RxDBArchive with fallback
try {
  const archive = await RxDBArchive.create(config);
} catch (error) {
  console.warn('RxDB unavailable, using cache fallback');
  const archive = new CacheArchive(cache);
}
```

---

## Best Practices

### 1. Dependency Injection

Always inject archive instead of creating inside service:

```typescript
// ✅ Good
constructor(
  private readonly archive: ArchiveInterface
) {}

// ❌ Bad
constructor() {
  this.archive = new InMemoryArchive();
}
```

### 2. Error Handling

Always handle archive errors:

```typescript
try {
  const record = await archive.create(newRecord);
} catch (error) {
  if (error.message.includes('already exists')) {
    // Handle duplicate
  } else {
    // Handle other errors
  }
}
```

### 3. Pagination

Always paginate large queries:

```typescript
// ✅ Good
const page1 = await archive.find({ limit: 20, offset: 0 });
const page2 = await archive.find({ limit: 20, offset: 20 });

// ❌ Bad (may return thousands of records)
const all = await archive.all();
```

### 4. Batch Operations

Use batch operations for multiple records:

```typescript
// ✅ Good
await archive.bulkCreate(manyRecords);

// ❌ Bad (many round trips)
for (const record of manyRecords) {
  await archive.create(record);
}
```

---

## Troubleshooting

### Issue: "Record already exists"

**Cause**: Attempting to create record with existing ID  
**Solution**: Use `update()` instead, or check with `exists()` first

```typescript
const exists = await archive.exists(record.id);
if (exists) {
  await archive.update(record.id, record);
} else {
  await archive.create(record);
}
```

### Issue: Slow queries

**Cause**: No indexes, full table scan  
**Solution**: Ensure filters match indexed fields

```typescript
// ✅ Fast (uses territory index)
await archive.find({ territory: 'backstage' });

// ⚠️ Slower (no index on custom field)
await archive.find({ /* custom filter */ });
```

### Issue: Memory leaks

**Cause**: Not calling `cleanup()` on archive  
**Solution**: Always cleanup in service cleanup

```typescript
async cleanup(): Promise<void> {
  await this.archive.cleanup();
}
```

---

## Summary

The Archive Abstraction Layer provides:

✅ **Clean Separation** - Business logic independent of storage  
✅ **Testability** - MockArchive for unit tests  
✅ **Flexibility** - Easy backend swapping  
✅ **Performance** - Optimized implementations  
✅ **Future-Proof** - Ready for RxDB integration

**Next Steps**:
1. Update ActService to use ArchiveInterface
2. Write tests with MockArchive
3. Verify no performance regression
4. Prepare for Phase 4 RxDB integration

---

*"The archive remembers all, preserving acts for eternity through any storage medium the carnival requires."* 📚✨