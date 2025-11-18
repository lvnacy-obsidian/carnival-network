# Phase 4 Database Integration - Options Analysis

**Document Version**: 1.0  
**Created**: 2025-11-12  
**Project Phase**: Pre-Phase 4 Research  
**Purpose**: Evaluate persistent database solutions for Carnival Network Plugin

---

## Executive Summary

This document analyzes database options for Phase 4 implementation of the Carnival Network Plugin, considering Obsidian's unique constraints: single-file compilation, offline-first operation, mobile compatibility, and existing cache infrastructure. Based on project requirements at Phase 3 completion, recommendations are provided with implementation considerations.

**Quick Recommendation**: **RxDB** (Rank #1) or **sql.js** (Rank #2) depending on query complexity needs.

---

## Project Context at Phase 3 Completion

### Current Infrastructure
- **PersistentPerformerCache**: LRU cache with filesystem persistence via Obsidian Vault API
- **ActService**: In-memory indexing by territory, type, and performer
- **CarnivalQueryService**: Interface for territory queries, performer status, analytics
- **Observability Framework**: Metrics buffering, correlation tracking, health monitoring
- **API Methods**: 8/12 core methods implemented (queryActs, countActs, broadcastAct, etc.)

### Key Requirements
1. **Single-bundle constraint**: Plugin compiles to one JavaScript file via esbuild
2. **Offline-first**: Must operate without network connectivity
3. **Mobile compatibility**: iOS/Android Obsidian clients with limited resources
4. **Cache fallback**: PersistentPerformerCache must remain as fallback layer
5. **Query capabilities**: Support complex filtering, pagination, full-text search
6. **Analytics support**: Time-series metrics, historical tracking, aggregations

### Data Types to Persist
- **Carnival Records**: Historical record tracking, audit trails
- **Network Topology**: Performer registration history, territory evolution
- **Metrics History**: Time-series performance data, analytics aggregates
- **Event Logs**: Webhook events, state transitions, correlation traces
- **Cache Data**: Enhanced persistent performer cache with query layer

---

## Option Analysis

### 🥇 1. RxDB (Recommended - Highest)

**Repository**: https://github.com/pubkey/rxdb  
**Type**: Local-first reactive database with storage adapter abstraction

#### Overview
RxDB is a reactive, NoSQL database for JavaScript applications with a "local-first" philosophy. It provides an abstraction layer over multiple storage backends (IndexedDB, LokiJS, in-memory) with automatic synchronization capabilities when online.

#### Strengths for This Project

**✅ Storage Adapter Flexibility**
- **Dexie.js (IndexedDB) adapter**: Browser-native, zero bundle overhead for web-based use
- **LokiJS adapter**: In-memory with filesystem persistence, suitable for offline Node.js contexts
- **Memory adapter**: Fallback when filesystem unavailable
- Abstracts storage backend, allowing runtime selection based on environment

**✅ Offline-First by Design**
- Built explicitly for offline operation with optional synchronization
- Local data persistence guaranteed before any network operation
- Conflict resolution built-in for multi-device scenarios
- Aligns perfectly with Obsidian's offline-first philosophy

**✅ Reactive Query System**
- Observable queries that automatically update when data changes
- Perfect for Obsidian plugin's reactive UI updates
- Eliminates manual cache invalidation logic
- Live query subscriptions for real-time dashboards

**✅ Query Capabilities**
- MongoDB-like query syntax (familiar for developers)
- Indexes for performance optimization
- Full-text search via plugins
- Aggregation pipeline support
- Cross-collection queries

**✅ Mobile Optimization**
- Designed for mobile-first web applications
- Memory-efficient query execution
- Lazy loading and pagination built-in
- Works seamlessly on iOS/Android via IndexedDB

**✅ Synchronization Options**
- Optional sync to remote databases (CouchDB, GraphQL, custom)
- Can remain purely local if network sync not needed
- Conflict resolution strategies included
- Fits Phase 4's hybrid offline/online model

#### Weaknesses

**❌ Bundle Size**
- RxDB core: ~150-200 KB minified
- Storage adapters add additional weight (e.g., Dexie.js ~50 KB, LokiJS ~200 KB)
- Total estimated bundle impact: **200-400 KB** depending on adapters
- Mitigated by tree-shaking and selecting minimal adapters

**❌ Learning Curve**
- Requires understanding RxDB's reactive patterns
- Schema definition and migration process
- Different query syntax from SQL (NoSQL style)
- Additional abstraction layer to maintain

**❌ Not True SQL**
- NoSQL document model, not relational
- Limited JOIN capabilities compared to SQL databases
- Complex relational queries require application-level logic
- May require schema design adjustments for normalized data

#### Integration with Carnival Network

**How It Fits Phase 3 State**:
```typescript
// Current: ActService with in-memory indexing
class ActService {
  private acts: Map<string, CarnivalAct>;
  private actsByTerritory: Map<string, Set<string>>;
  // ... indexes
}

// With RxDB: Replace in-memory structures
import { createRxDatabase } from 'rxdb';

class ActService {
  private db: RxDatabase;
  private actsCollection: RxCollection<CarnivalAct>;
  
  async initialize() {
    this.db = await createRxDatabase({
      name: 'carnival_network',
      storage: getRxStorageLoki(), // LokiJS for Node/Electron
      multiInstance: false
    });
    
    this.actsCollection = await this.db.addCollections({
      acts: {
        schema: carnivalActSchema,
        methods: {
          // Custom act methods
        }
      }
    });
  }
  
  // Queries become reactive and persistent
  queryActs(params: ActQueryParams) {
    return this.actsCollection.find({
      selector: {
        territory: params.territory,
        type: params.type
      },
      skip: params.offset,
      limit: params.limit
    });
  }
}
```

**Cache Fallback Strategy**:
- RxDB initialization failure → gracefully fallback to PersistentPerformerCache
- RxDB uses Obsidian Vault API for LokiJS persistence files
- Mobile devices without filesystem → use in-memory adapter with cache backup

**Observability Integration**:
- RxDB hooks can emit metrics to `globalMetrics`
- Query performance tracked via correlation IDs
- Collection changes trigger event logs

#### Implementation Considerations

**Storage Adapter Selection**:
- **Desktop Obsidian**: LokiJS adapter (filesystem persistence via Vault API)
- **Mobile Obsidian**: Dexie.js adapter (IndexedDB, browser-native)
- **Fallback**: In-memory adapter → PersistentPerformerCache

**Schema Design**:
```typescript
const carnivalActSchema = {
  version: 0,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: { type: 'string', maxLength: 100 },
    territory: { type: 'string' },
    type: { type: 'string' },
    performer: { type: 'string' },
    timestamp: { type: 'number' },
    payload: { type: 'object' }
  },
  required: ['id', 'territory', 'type', 'performer', 'timestamp'],
  indexes: ['territory', 'type', 'performer', 'timestamp']
};
```

**Migration Path**:
1. Initialize RxDB with schema
2. Import existing cache data from PersistentPerformerCache
3. Switch ActService queries to RxDB
4. Maintain cache as fallback layer
5. Monitor bundle size impact

**Bundle Size Mitigation**:
- Use selective imports: `import { createRxDatabase } from 'rxdb/plugins/core'`
- Tree-shake unused plugins
- Consider only including adapters needed for primary use case
- Lazy-load sync plugins if network features optional

#### Recommendation Score: **9.5/10**

**Best for**: Projects prioritizing offline-first operation, reactive queries, flexible storage, and mobile compatibility with acceptable bundle size trade-off.

---

### 🥈 2. sql.js (Recommended - High)

**Repository**: https://github.com/sql-js/sql.js  
**Type**: SQLite compiled to WebAssembly/JavaScript via Emscripten

#### Overview
sql.js brings SQLite to the browser by compiling it to WebAssembly. It runs entirely in-memory or with manual file export/import, providing full SQL capabilities without external dependencies.

#### Strengths for This Project

**✅ Full SQL Capabilities**
- Complete SQLite feature set (JOINs, transactions, triggers)
- Familiar SQL syntax for complex queries
- ACID compliance for data integrity
- Relational model for normalized data structures

**✅ Single Bundled File Friendly**
- Distributed as WASM file + JavaScript glue code
- Can be bundled into plugin or loaded separately
- No external database server required
- Fully self-contained

**✅ Advanced Query Features**
- Complex JOINs for relational analytics
- Aggregation functions (SUM, AVG, COUNT with GROUP BY)
- Full-text search via FTS5 extension
- Window functions for time-series analysis
- Views and CTEs for complex reporting

**✅ Predictable Performance**
- SQLite query optimizer handles complex queries efficiently
- Indexing strategies well-documented and mature
- Deterministic query execution
- Efficient for analytical queries on moderate datasets

**✅ Data Export/Import**
- Export database as binary array for persistence
- Import existing SQLite files
- Portable database format
- Easy backup and restore

#### Weaknesses

**❌ In-Memory Only by Default**
- No automatic filesystem persistence
- Must manually export/import database file
- Risk of data loss if export fails or plugin crashes
- Requires custom persistence layer integration

**❌ Bundle Size**
- WASM file: ~800 KB - 1.5 MB (depending on build)
- JavaScript wrapper: ~50-100 KB
- Total estimated bundle impact: **850 KB - 1.6 MB**
- Significantly larger than RxDB or cache-based approaches

**❌ Memory Constraints**
- Entire database loaded in memory
- Mobile devices may struggle with large datasets (> 50 MB)
- Memory usage grows with database size
- Garbage collection pressure on large queries

**❌ Manual Persistence Management**
- Must implement save/load logic to Obsidian Vault
- No automatic write-through to filesystem
- Requires periodic export or event-driven saves
- Complexity in ensuring data consistency

**❌ No Reactive Queries**
- Traditional query execution model (no observables)
- Manual cache invalidation required
- No automatic UI updates on data changes
- Additional layer needed for reactive patterns

#### Integration with Carnival Network

**How It Fits Phase 3 State**:
```typescript
import initSqlJs from 'sql.js';

class ActService {
  private db: Database;
  private SQL: SqlJsStatic;
  
  async initialize() {
    this.SQL = await initSqlJs({
      locateFile: file => `/.obsidian/plugins/carnival-network/${file}`
    });
    
    // Try loading existing database
    const dbData = await this.loadDatabaseFromVault();
    this.db = dbData 
      ? new this.SQL.Database(dbData)
      : new this.SQL.Database();
    
    // Create schema
    this.db.run(`
      CREATE TABLE IF NOT EXISTS acts (
        id TEXT PRIMARY KEY,
        territory TEXT NOT NULL,
        type TEXT NOT NULL,
        performer TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        payload TEXT
      );
      CREATE INDEX idx_territory ON acts(territory);
      CREATE INDEX idx_type ON acts(type);
      CREATE INDEX idx_timestamp ON acts(timestamp);
    `);
    
    // Auto-save on changes
    this.setupAutoSave();
  }
  
  queryActs(params: ActQueryParams): CarnivalAct[] {
    const stmt = this.db.prepare(`
      SELECT * FROM acts 
      WHERE territory = ? AND type = ?
      ORDER BY timestamp DESC
      LIMIT ? OFFSET ?
    `);
    stmt.bind([params.territory, params.type, params.limit, params.offset]);
    
    const results = [];
    while (stmt.step()) {
      results.push(this.rowToAct(stmt.getAsObject()));
    }
    stmt.free();
    return results;
  }
  
  private async setupAutoSave() {
    // Save every 5 minutes or on specific events
    setInterval(() => this.saveDatabase(), 5 * 60 * 1000);
    
    // Save on plugin unload
    this.plugin.register(() => this.saveDatabase());
  }
  
  private async saveDatabase() {
    const data = this.db.export();
    await this.vault.adapter.writeBinary(
      '.obsidian/plugins/carnival-network/carnival.db',
      data
    );
  }
}
```

**Cache Fallback Strategy**:
- sql.js initialization failure → PersistentPerformerCache
- WASM loading failure → fallback to cache-only mode
- Memory limits exceeded → cache handles recent data, database for historical

**Observability Integration**:
- Wrap SQL queries with correlation tracking
- Record query execution time in `globalMetrics`
- Log slow queries (> 100ms) for optimization

#### Implementation Considerations

**Persistence Strategy**:
1. **Periodic export**: Save database to vault every N minutes
2. **Event-driven export**: Save on significant changes (record creation, updates)
3. **Unload export**: Always save when plugin unloads
4. **Crash recovery**: Maintain transaction log in separate file

**Memory Management**:
- Monitor database size via `db.export().length`
- Implement data retention policies (delete old records)
- Archive historical data to separate files
- Consider splitting database by time period (monthly archives)

**WASM Loading**:
```typescript
// Load WASM from plugin directory
const SQL = await initSqlJs({
  locateFile: file => {
    const pluginDir = this.manifest.dir;
    return `${pluginDir}/${file}`;
  }
});
```

**Migration Path**:
1. Bundle sql.js WASM and JS files with plugin
2. Implement database initialization and schema creation
3. Migrate data from PersistentPerformerCache to SQLite
4. Replace ActService queries with SQL
5. Implement auto-save and crash recovery
6. Monitor memory usage and performance

**Bundle Size Mitigation**:
- Use optimized WASM build (remove unused SQLite features)
- Consider lazy-loading WASM (load on first database access)
- Compress WASM with gzip (server-side, if distributed separately)
- Document bundle size increase for users

#### Recommendation Score: **8.0/10**

**Best for**: Projects requiring complex SQL queries, relational data modeling, and advanced analytics where bundle size increase is acceptable.

---

### 🥉 3. sqliteDB Plugin (Dependency)

**Repository**: https://github.com/stfrigerio/sqliteDB  
**Type**: Obsidian community plugin providing SQLite database functionality

#### Overview
The sqliteDB plugin is an existing Obsidian community plugin that wraps sql.js and provides a higher-level API for interacting with SQLite databases from within Obsidian. It supports both local database files and remote API modes.

#### Strengths for This Project

**✅ Pre-Built Obsidian Integration**
- Already designed for Obsidian plugin ecosystem
- Handles Vault API integration
- Provides code block syntax for queries (optional, can use API directly)
- Existing persistence layer via Vault

**✅ Familiar SQL Syntax**
- Full SQLite capabilities via sql.js
- Complex queries, JOINs, aggregations
- FTS5 full-text search support

**✅ Remote API Mode**
- Optional sync to remote database server
- Good for multi-vault scenarios
- Cloudflare Access integration for security

**✅ No Bundle Size Impact**
- User installs sqliteDB separately
- Carnival Network plugin remains small
- WASM files managed by sqliteDB plugin

**✅ Maintenance Offloaded**
- sqliteDB handles sql.js updates
- Bug fixes and improvements from maintainer
- Community support and testing

#### Weaknesses

**❌ External Dependency**
- Requires users to install two plugins
- Breaks if sqliteDB plugin disabled or removed
- Version compatibility concerns
- Dependency on third-party maintenance schedule

**❌ Not Guaranteed Available**
- Users may not have sqliteDB installed
- Graceful degradation required
- Cannot assume database functionality
- Complicates setup instructions

**❌ API Constraints**
- Limited to sqliteDB's provided API
- Cannot customize underlying behavior
- May not support all required features
- Breaking changes in sqliteDB affect Carnival Network

**❌ Architectural Coupling**
- Plugin interdependency creates fragility
- Difficult to test in isolation
- Users confused by multi-plugin requirement
- Increases support burden

**❌ Limited Control**
- Cannot optimize query execution
- No control over WASM loading
- Persistence strategy determined by sqliteDB
- Cannot integrate deeply with observability framework

#### Integration with Carnival Network

**How It Fits Phase 3 State**:
```typescript
class ActService {
  private sqlitePlugin: any;
  
  async initialize() {
    // Check if sqliteDB plugin available
    this.sqlitePlugin = app.plugins.plugins['sqlite-db'];
    
    if (!this.sqlitePlugin) {
      Log.warn('sqliteDB plugin not found, falling back to cache');
      return this.initializeCacheFallback();
    }
    
    // Use sqliteDB API
    await this.sqlitePlugin.initDatabase('carnival_network.db');
    
    // Create schema
    await this.sqlitePlugin.executeQuery(`
      CREATE TABLE IF NOT EXISTS acts (
        id TEXT PRIMARY KEY,
        territory TEXT NOT NULL,
        type TEXT NOT NULL,
        performer TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        payload TEXT
      );
    `);
  }
  
  async queryActs(params: ActQueryParams): Promise<CarnivalAct[]> {
    if (!this.sqlitePlugin) {
      return this.queryCacheFallback(params);
    }
    
    const results = await this.sqlitePlugin.executeQuery(`
      SELECT * FROM acts 
      WHERE territory = ? AND type = ?
      ORDER BY timestamp DESC
      LIMIT ? OFFSET ?
    `, [params.territory, params.type, params.limit, params.offset]);
    
    return results.map(row => this.rowToAct(row));
  }
}
```

**Cache Fallback Strategy**:
- Always implement full PersistentPerformerCache fallback
- Detect sqliteDB availability at runtime
- Seamlessly switch between database and cache
- Warn users about reduced functionality without sqliteDB

**Observability Integration**:
- Limited instrumentation of sqliteDB queries
- Cannot inject correlation tracking into sqliteDB
- Wrap all calls with metrics collection
- Log performance from external perspective

#### Implementation Considerations

**Dependency Management**:
- Document sqliteDB as optional dependency
- Provide clear installation instructions
- Implement comprehensive fallback behavior
- Test both with and without sqliteDB

**API Compatibility**:
- Review sqliteDB API surface
- Ensure all required operations supported
- Plan for API changes in future sqliteDB versions
- Maintain abstraction layer to isolate dependency

**User Experience**:
- Clear messaging about enhanced features with sqliteDB
- Graceful degradation without confusing errors
- Settings UI indicates sqliteDB status
- Link to sqliteDB installation in settings

**Testing Strategy**:
- Mock sqliteDB plugin for unit tests
- Integration tests with sqliteDB installed
- Tests for fallback behavior when missing
- Version compatibility matrix

#### Recommendation Score: **5.5/10**

**Best for**: Projects with minimal database requirements where offloading maintenance is priority, acceptable if users already have sqliteDB installed.

**Not recommended** due to fragility of external dependency and loss of control over critical persistence layer.

---

### 4. Realm.js (Not Recommended - Deprecated)

**Repository**: https://github.com/realm/realm-js  
**Type**: Mobile-first object database (MongoDB's embedded database)

#### Overview
Realm is a mobile-focused object database designed for React Native and native mobile apps. While powerful, it's being sunset in favor of Atlas Device SDK and has limited applicability to Obsidian plugins.

#### Strengths (Historical)

**✅ Mobile Optimization**
- Designed for iOS/Android native apps
- Memory-efficient object storage
- Fast queries on mobile devices

**✅ Reactive Queries**
- Live objects that automatically update
- Observable query results
- Event-driven data changes

**✅ Synchronization**
- Built-in MongoDB Atlas sync
- Conflict resolution
- Offline-first with automatic sync

#### Weaknesses

**❌ Deprecated / Sunset Path**
- Realm.js being phased out for Atlas Device SDK
- Limited future development
- Documentation increasingly focused on React Native only
- Uncertain long-term viability

**❌ Native Module Dependency**
- Requires native C++ modules
- Not pure JavaScript
- Incompatible with Obsidian's plugin architecture
- Cannot compile to single JavaScript file

**❌ Platform-Specific Builds**
- Separate builds for iOS, Android, desktop
- Requires native compilation per platform
- esbuild cannot bundle native modules
- Breaks Obsidian's single-bundle requirement

**❌ React Native Focused**
- Obsidian plugins are not React Native apps
- Most documentation irrelevant
- Expo/React Native tooling required
- Poor fit for Electron-based apps

**❌ Large Bundle Size**
- Native module adds significant size
- Cannot tree-shake native code
- Platform-specific binaries required
- Much larger than JavaScript-only solutions

#### Integration with Carnival Network

**Not Feasible**: Realm.js cannot integrate with Obsidian plugins due to native module requirements and platform-specific compilation needs.

#### Recommendation Score: **2.0/10**

**Not recommended** due to deprecation status, native module requirements incompatible with Obsidian, and React Native focus.

---

### 5. Enhanced PersistentPerformerCache (File-Based)

**Type**: Extension of existing cache with query capabilities  
**Current Implementation**: `src/network/persistent-performer-cache.ts`

#### Overview
Rather than adding a database, enhance the existing `PersistentPerformerCache` with indexing, query methods, and structured storage using Obsidian's Vault API for persistence.

#### Strengths for This Project

**✅ Zero Bundle Size Impact**
- Pure TypeScript implementation
- No external dependencies
- Minimal code addition
- Already integrated with Obsidian Vault API

**✅ Already Implemented & Tested**
- PersistentPerformerCache proven in Phase 2
- Cross-reload persistence working
- Mobile compatibility verified
- Graceful degradation tested

**✅ Obsidian-Native**
- Uses Vault API for file I/O
- Respects Obsidian's file permissions
- Works identically on desktop and mobile
- No platform-specific code

**✅ Offline-First by Default**
- No network required ever
- No initialization failure modes
- Instant availability
- No WASM loading delays

**✅ Simple Maintenance**
- Pure TypeScript, easy to understand
- No database schema migrations
- No query language to learn
- Full control over implementation

**✅ Flexible Storage Format**
- JSON for human-readable debugging
- MessagePack for compact binary storage
- Can switch formats without major refactoring
- Easy export and import

#### Weaknesses

**❌ Limited Query Capabilities**
- No SQL or advanced query language
- Must implement filtering manually
- Complex queries require application logic
- No query optimizer

**❌ Performance Limitations**
- Linear scans for unindexed queries
- Large datasets (> 10k records) become slow
- No sophisticated indexing strategies
- Memory overhead for in-memory indexes

**❌ Manual Index Management**
- Must manually create and maintain indexes
- Index invalidation logic required
- No automatic query optimization
- Complexity grows with data model

**❌ No Advanced Features**
- No transactions (all-or-nothing writes)
- No triggers or stored procedures
- No views or materialized aggregates
- No full-text search (must implement manually)

**❌ Scalability Concerns**
- Single file per collection → file I/O bottleneck
- Large datasets cause long load times
- No query parallelization
- File corruption impacts entire collection

#### Integration with Carnival Network

**How It Fits Phase 3 State**:
```typescript
// Extend existing PersistentPerformerCache
class EnhancedActCache extends PersistentPerformerCache {
  private actsByTerritory: Map<string, Set<string>>;
  private actsByType: Map<string, Set<string>>;
  private actsByTimestamp: Array<{ id: string; timestamp: number }>;
  
  constructor(vault: Vault, config: CacheConfig) {
    super(vault, { ...config, maxSize: 10000 });
    this.actsByTerritory = new Map();
    this.actsByType = new Map();
    this.actsByTimestamp = [];
  }
  
  async addAct(act: CarnivalAct): Promise<void> {
    // Store in base cache
    await this.set(act.id, act);
    
    // Update indexes
    this.indexAct(act);
  }
  
  private indexAct(act: CarnivalAct): void {
    // Territory index
    if (!this.actsByTerritory.has(act.territory)) {
      this.actsByTerritory.set(act.territory, new Set());
    }
    this.actsByTerritory.get(act.territory)!.add(act.id);
    
    // Type index
    if (!this.actsByType.has(act.type)) {
      this.actsByType.set(act.type, new Set());
    }
    this.actsByType.get(act.type)!.add(act.id);
    
    // Timestamp index (sorted)
    this.actsByTimestamp.push({ id: act.id, timestamp: act.timestamp });
    this.actsByTimestamp.sort((a, b) => b.timestamp - a.timestamp);
  }
  
  queryActs(params: ActQueryParams): CarnivalAct[] {
    // Get candidates from indexes
    let candidateIds: Set<string> | null = null;
    
    if (params.territory) {
      candidateIds = this.actsByTerritory.get(params.territory) || new Set();
    }
    
    if (params.type) {
      const typeIds = this.actsByType.get(params.type) || new Set();
      candidateIds = candidateIds 
        ? this.intersect(candidateIds, typeIds)
        : typeIds;
    }
    
    // Apply additional filters
    const results = [];
    for (const id of candidateIds || this.data.keys()) {
      const act = this.get(id);
      if (act && this.matchesFilters(act, params)) {
        results.push(act);
      }
    }
    
    // Sort and paginate
    results.sort((a, b) => b.timestamp - a.timestamp);
    return results.slice(params.offset, params.offset + params.limit);
  }
  
  private matchesFilters(act: CarnivalAct, params: ActQueryParams): boolean {
    if (params.performer && act.performer !== params.performer) return false;
    if (params.startDate && act.timestamp < params.startDate) return false;
    if (params.endDate && act.timestamp > params.endDate) return false;
    return true;
  }
  
  private intersect(setA: Set<string>, setB: Set<string>): Set<string> {
    return new Set([...setA].filter(x => setB.has(x)));
  }
  
  // Persist indexes alongside cache data
  async saveToDisk(): Promise<void> {
    await super.saveToDisk();
    
    // Save indexes
    await this.vault.adapter.write(
      this.indexPath,
      JSON.stringify({
        byTerritory: Array.from(this.actsByTerritory.entries()),
        byType: Array.from(this.actsByType.entries()),
        byTimestamp: this.actsByTimestamp
      })
    );
  }
  
  async loadFromDisk(): Promise<void> {
    await super.loadFromDisk();
    
    // Load indexes
    try {
      const indexData = await this.vault.adapter.read(this.indexPath);
      const indexes = JSON.parse(indexData);
      this.actsByTerritory = new Map(indexes.byTerritory);
      this.actsByType = new Map(indexes.byType);
      this.actsByTimestamp = indexes.byTimestamp;
    } catch (err) {
      // Rebuild indexes from cache data
      this.rebuildIndexes();
    }
  }
}

class ActService {
  private actCache: EnhancedActCache;
  
  async initialize() {
    this.actCache = new EnhancedActCache(this.vault, {
      maxSize: 10000,
      ttl: 24 * 60 * 60 * 1000, // 24 hours
      persistPath: '.obsidian/plugins/carnival-network/acts.json',
      persistInterval: 5 * 60 * 1000 // 5 minutes
    });
    
    await this.actCache.loadFromDisk();
  }
  
  async queryActs(params: ActQueryParams): Promise<CarnivalAct[]> {
    return this.actCache.queryActs(params);
  }
}
```

**Observability Integration**:
- Cache queries emit metrics to `globalMetrics`
- Index rebuilds tracked and logged
- Query performance profiled
- Cache hit/miss rates monitored

#### Implementation Considerations

**Index Design**:
- Create indexes for frequently queried fields (territory, type, performer)
- Use in-memory indexes for fast lookups
- Persist indexes alongside cache data
- Rebuild indexes on load or corruption

**Data Structures**:
- `Map<string, Set<string>>` for category indexes (territory → act IDs)
- `Array<{id, timestamp}>` sorted for time-range queries
- `Map<string, Act>` for primary storage (existing cache)
- Periodic compaction to remove deleted entries

**Persistence Strategy**:
- Save data and indexes separately (faster partial saves)
- Use MessagePack for compact binary format
- Implement atomic writes (write to temp file, rename)
- Background auto-save every 5 minutes

**Query Optimization**:
- Use indexes to reduce candidate set
- Short-circuit evaluation for impossible queries
- Cache frequent queries (query result cache)
- Paginate results to limit memory usage

**Storage Format Options**:
```typescript
// Option A: JSON (human-readable, debugging-friendly)
await this.vault.adapter.write(path, JSON.stringify(data, null, 2));

// Option B: MessagePack (compact binary, faster parsing)
import { encode } from 'msgpackr';
await this.vault.adapter.writeBinary(path, encode(data));

// Option C: Hybrid (JSON for indexes, MessagePack for large data)
await this.vault.adapter.write(indexPath, JSON.stringify(indexes));
await this.vault.adapter.writeBinary(dataPath, encode(records));
```

**Migration Path**:
1. Extend `PersistentPerformerCache` with index structures
2. Implement query methods on extended cache
3. Add index persistence and loading
4. Replace ActService in-memory structures with enhanced cache
5. Benchmark query performance and optimize
6. Document limitations for users

#### Recommendation Score: **7.5/10**

**Best for**: Projects prioritizing minimal dependencies, simplicity, and mobile compatibility over advanced query capabilities.

**Good choice if**: Bundle size is critical constraint and query requirements remain moderate.

---

## Additional Viable Options

### 6. LokiJS (In-Memory Document Store)

**Repository**: https://github.com/techfort/LokiJS  
**Type**: Lightweight in-memory document database with persistence adapters

#### Overview
LokiJS is a fast, in-memory document-oriented database with optional persistence via filesystem adapters. It provides MongoDB-like query syntax and dynamic views.

#### Strengths

**✅ Lightweight**
- ~200 KB minified bundle size
- Pure JavaScript, no WASM
- Fast in-memory operations
- Good performance for datasets < 100k documents

**✅ Persistence Adapters**
- Filesystem adapter for Node.js/Electron
- IndexedDB adapter for browsers
- Can use Obsidian Vault API via custom adapter
- Periodic or manual persistence

**✅ Query Features**
- MongoDB-style query syntax
- DynamicView for live updating result sets
- Chained query operators
- Indexing support

**✅ Transactions & Events**
- Event emitters for data changes
- Before/after hooks
- Transaction support (basic)
- Good for reactive UIs

#### Weaknesses

**❌ In-Memory Only**
- Entire database loaded in memory
- Large datasets consume significant RAM
- Mobile devices may struggle
- Must implement save/load logic

**❌ Limited Advanced Features**
- No SQL JOINs (document-oriented)
- Basic aggregation only
- No full-text search built-in
- Limited query optimization

**❌ Maintenance Concerns**
- Less active development recently
- Community smaller than alternatives
- Documentation sometimes outdated
- Fewer plugins and extensions

#### Recommendation Score: **7.0/10**

**Good alternative** if NoSQL document model preferred and RxDB seems too complex. Lighter than sql.js, more features than plain cache.

---

### 7. PouchDB (CouchDB for JavaScript)

**Repository**: https://github.com/pouchdb/pouchdb  
**Type**: JavaScript database inspired by CouchDB with sync capabilities

#### Overview
PouchDB is an open-source JavaScript database that syncs with Apache CouchDB. It works offline-first with automatic synchronization when online.

#### Strengths

**✅ Offline-First**
- Designed explicitly for offline operation
- Automatic sync when network available
- Conflict resolution built-in
- Works identically online and offline

**✅ Browser-Native**
- Uses IndexedDB in browsers
- No WASM or native modules
- ~150 KB bundle size
- Mobile-friendly

**✅ Sync Capabilities**
- CouchDB replication protocol
- Bidirectional sync
- Conflict resolution strategies
- Good for multi-device scenarios

**✅ Mature & Stable**
- Long history and development
- Active community
- Extensive documentation
- Many plugins available

#### Weaknesses

**❌ Document Model Only**
- No relational queries
- No JOINs or complex aggregations
- Document-oriented design
- May require schema redesign

**❌ Query Limitations**
- Mango query language (not SQL)
- Limited indexing strategies
- No full-text search built-in (plugin available)
- Complex queries can be slow

**❌ Sync Overhead**
- Designed for sync, even if not needed
- Adds complexity if sync not required
- CouchDB-specific features may be irrelevant
- Replication protocol adds bundle size

**❌ Performance**
- Slower than LokiJS or Realm for local-only
- IndexedDB can be slower than in-memory
- Large queries can block UI
- Revision history adds storage overhead

#### Recommendation Score: **6.5/10**

**Consider if**: Multi-device sync via CouchDB is valuable and document model acceptable. Overhead may not justify benefits for single-vault use.

---

### 8. Dexie.js (IndexedDB Wrapper)

**Repository**: https://github.com/dexie/Dexie.js  
**Type**: Minimalistic wrapper for IndexedDB with Promises

#### Overview
Dexie.js is a wrapper around the browser's IndexedDB API, providing a cleaner Promise-based interface with advanced query capabilities.

#### Strengths

**✅ Browser-Native**
- No external database engine
- Uses IndexedDB (built into browsers)
- Zero additional storage backend
- ~20 KB bundle size (minimal overhead)

**✅ Excellent Performance**
- Direct IndexedDB access
- Efficient indexing
- Fast for large datasets
- Asynchronous, non-blocking

**✅ Advanced Queries**
- Compound indexes
- Full-text search plugin
- Range queries and sorting
- Cursor-based iteration

**✅ Reactive Queries**
- `liveQuery()` for auto-updating results
- Observable collections
- Works well with React/Vue/Svelte
- Good for reactive UIs

**✅ Minimal Bundle Size**
- Core: ~20 KB minified
- Plugins add minimal weight
- Smallest database solution
- No performance trade-off

#### Weaknesses

**❌ Browser Environment Only**
- Requires IndexedDB (browser API)
- Not available in Node.js/Electron main process
- Mobile Obsidian OK (Capacitor has IndexedDB)
- Desktop Obsidian in Electron renderer OK

**❌ Not Relational**
- Object store model, not tables
- No SQL or JOINs
- Multi-collection queries awkward
- Normalized data requires manual joins

**❌ No Built-In Persistence to Files**
- IndexedDB is browser-managed
- Cannot export to vault easily
- No Obsidian Vault API integration
- Harder to backup/restore

**❌ Limited Portability**
- Data locked in IndexedDB
- Cannot easily move between devices
- Backup requires custom export logic
- Migration to other storage difficult

#### Recommendation Score: **7.5/10**

**Good choice if**: Obsidian plugin runs in renderer process (likely), IndexedDB acceptable, and minimal bundle size critical. Loses some Obsidian-native benefits.

---

## Comparison Matrix

| Feature | RxDB | sql.js | sqliteDB | Realm.js | Enhanced Cache | LokiJS | PouchDB | Dexie.js |
|---------|------|--------|----------|----------|----------------|--------|---------|----------|
| **Bundle Size** | 200-400 KB | 850 KB - 1.6 MB | 0 KB (external) | N/A | ~10 KB | ~200 KB | ~150 KB | ~20 KB |
| **Offline-First** | ✅ Excellent | ⚠️ Manual | ✅ Good | N/A | ✅ Excellent | ⚠️ Manual | ✅ Excellent | ✅ Good |
| **Mobile Compat** | ✅ Excellent | ⚠️ Memory limits | ✅ Good | ❌ No | ✅ Excellent | ⚠️ Memory limits | ✅ Good | ✅ Excellent |
| **Query Power** | ✅ NoSQL | ✅✅ SQL | ✅✅ SQL | ✅ NoSQL | ⚠️ Basic | ✅ NoSQL | ⚠️ Limited | ✅ NoSQL |
| **Reactive Queries** | ✅ Yes | ❌ No | ❌ No | ✅ Yes | ❌ No | ⚠️ Limited | ⚠️ Limited | ✅ Yes |
| **Persistence** | ✅ Automatic | ⚠️ Manual | ✅ Automatic | N/A | ✅ Automatic | ⚠️ Manual | ✅ Automatic | ⚠️ IndexedDB |
| **Sync Support** | ✅ Optional | ❌ No | ✅ Optional | ✅ MongoDB | ❌ No | ❌ No | ✅ CouchDB | ❌ No |
| **Learning Curve** | ⚠️ Moderate | ⚠️ SQL knowledge | ✅ Easy | ❌ High | ✅ Easy | ✅ Easy | ⚠️ Moderate | ✅ Easy |
| **Maintenance** | ✅ Active | ✅ Active | ⚠️ 3rd party | ❌ Deprecated | ✅ Internal | ⚠️ Less active | ✅ Active | ✅ Active |
| **Obsidian Native** | ⚠️ Adapter | ❌ No | ✅ Yes | ❌ No | ✅ Yes | ⚠️ Adapter | ❌ No | ❌ No |
| **Full-Text Search** | ✅ Plugin | ✅ FTS5 | ✅ FTS5 | ⚠️ Limited | ❌ Manual | ❌ Manual | ⚠️ Plugin | ✅ Plugin |
| **Transaction Support** | ✅ Yes | ✅ Yes | ✅ Yes | ✅ Yes | ❌ No | ⚠️ Basic | ⚠️ Basic | ✅ Yes |

---

## Ranked Recommendations

### 🥇 1. RxDB (Score: 9.5/10)
**Recommended For**: Most projects

**Rationale**:
- Perfectly aligns with offline-first philosophy
- Reactive queries ideal for Obsidian UI updates
- Storage adapter flexibility handles desktop/mobile/fallback scenarios
- Moderate bundle size (200-400 KB) acceptable for feature set
- Future-proof with active development and modern architecture
- NoSQL model fits document-oriented carnival records well

**When to Choose**:
- Offline operation is non-negotiable requirement
- Mobile compatibility critical
- Reactive UI updates valuable
- Moderate bundle size increase acceptable
- NoSQL query model sufficient for needs

**Implementation Priority**: **High** - Start Phase 4 with RxDB as primary option

---

### 🥈 2. sql.js (Score: 8.0/10)
**Recommended For**: SQL-heavy projects

**Rationale**:
- Full SQL capabilities for complex analytics
- Relational model for normalized data structures
- Mature and stable technology
- Excellent for advanced reporting and aggregations
- Deterministic query performance

**When to Choose**:
- Complex SQL queries required (JOINs, window functions)
- Relational data model preferred
- Advanced analytics critical
- Bundle size increase (850 KB - 1.6 MB) acceptable
- Manual persistence management acceptable

**Implementation Priority**: **Medium-High** - Consider if analytics require SQL power

---

### 🥉 3. Enhanced PersistentPerformerCache (Score: 7.5/10)
**Recommended For**: Minimalist projects

**Rationale**:
- Zero bundle size impact
- Already implemented and tested foundation
- Obsidian-native with Vault API integration
- Simple to maintain and understand
- Perfect mobile compatibility

**When to Choose**:
- Bundle size is critical constraint
- Query requirements moderate and predictable
- Simplicity and maintainability prioritized
- Existing cache performance acceptable
- No complex relational queries needed

**Implementation Priority**: **Medium** - Good baseline, can upgrade later if needed

---

### 4. Dexie.js (Score: 7.5/10)
**Recommended For**: Minimal-overhead projects

**Rationale**:
- Smallest bundle size (~20 KB)
- Browser-native IndexedDB performance
- Reactive queries available
- Excellent for large datasets

**When to Choose**:
- Bundle size paramount concern
- IndexedDB acceptable (no Vault integration)
- Obsidian plugin runs in renderer process
- NoSQL object store model sufficient

**Implementation Priority**: **Medium** - Alternative to RxDB for extreme size constraints

---

### 5. LokiJS (Score: 7.0/10)
**Recommended For**: Document-oriented projects

**Rationale**:
- Lighter than RxDB, more features than cache
- In-memory speed with persistence option
- MongoDB-like query syntax
- Dynamic views for live updates

**When to Choose**:
- NoSQL document model preferred
- RxDB seems over-engineered for needs
- Moderate bundle size acceptable (~200 KB)
- In-memory performance critical

**Implementation Priority**: **Low-Medium** - Solid alternative but RxDB more complete

---

### 6. PouchDB (Score: 6.5/10)
**Recommended For**: CouchDB sync projects

**Rationale**:
- Offline-first with automatic sync
- Mature and stable
- Good multi-device support
- CouchDB integration if needed

**When to Choose**:
- CouchDB synchronization valuable
- Multi-device scenarios common
- Document model acceptable
- Sync overhead acceptable

**Implementation Priority**: **Low** - Only if CouchDB sync needed

---

### 7. sqliteDB Plugin Dependency (Score: 5.5/10)
**Not Generally Recommended**

**Rationale**:
- Fragile external dependency
- Users may not have plugin installed
- Loss of control over persistence layer
- Complicates setup and support

**When to Choose**:
- Users already have sqliteDB
- Minimal development effort critical
- SQL needed but cannot accept sql.js bundle size
- Maintenance offloading worth dependency risk

**Implementation Priority**: **Low** - Avoid if possible

---

### 8. Realm.js (Score: 2.0/10)
**Not Recommended**

**Rationale**:
- Deprecated and being sunset
- Native module incompatible with Obsidian
- Cannot compile to single bundle
- React Native focus irrelevant

**When to Choose**: Never for this project

**Implementation Priority**: **None** - Do not use

---

## Implementation Roadmap Recommendation

### Phase 4.1: Database Selection & Prototyping

**Week 1-2: Prototyping**
1. **Primary**: RxDB with LokiJS adapter
   - Setup test environment
   - Implement basic schema
   - Test persistence via Vault API
   - Benchmark query performance
   - Measure bundle size impact

2. **Secondary**: sql.js comparison
   - Same test scenarios as RxDB
   - Compare query performance
   - Evaluate manual persistence overhead
   - Document trade-offs

3. **Baseline**: Enhanced cache implementation
   - Extend PersistentPerformerCache
   - Add indexes and query methods
   - Benchmark against database options
   - Keep as fallback implementation

**Decision Criteria**:
- **Choose RxDB if**: Query performance acceptable, bundle size < 400 KB, reactive features valuable
- **Choose sql.js if**: Complex SQL queries required, analytics performance critical, bundle size < 1.5 MB acceptable
- **Choose Enhanced Cache if**: Bundle size must be minimal, query performance adequate, simplicity prioritized

### Phase 4.2: Implementation (4-6 weeks)

**Week 3-4: Core Integration**
- Implement chosen database solution
- Migrate ActService to database
- Create schema and migrations
- Implement persistence layer
- Integrate with Obsidian Vault API

**Week 5-6: Data Migration**
- Export existing cache data
- Import into database
- Verify data integrity
- Test migration procedures
- Document rollback process

**Week 7-8: Testing & Optimization**
- Performance benchmarking
- Mobile device testing
- Fallback behavior verification
- Query optimization
- Bundle size validation

### Phase 4.3: Analytics Layer (2-3 weeks)

**Week 9-10: Historical Analytics**
- Time-series metrics storage
- Aggregation queries
- Analytics API implementation
- Dashboard integration

**Week 11: Observability Integration**
- Database query metrics
- Correlation tracking
- Health monitoring
- Performance dashboards

### Phase 4.4: Production Hardening (2 weeks)

**Week 12: Backup & Recovery**
- Backup procedures
- Restore testing
- Disaster recovery documentation
- Data integrity verification

**Week 13: Documentation & Release**
- User documentation
- Migration guides
- Troubleshooting guides
- Release notes

**Total Timeline**: 13 weeks (~3 months)

---

## Bundle Size Budget Analysis

### Current State (Phase 3)
- **Estimated Plugin Size**: ~300-500 KB (typical Obsidian plugin with TypeScript)
- **PersistentPerformerCache**: ~5-10 KB
- **Network Services**: ~30-50 KB
- **Monitoring Infrastructure**: ~20-30 KB
- **UI Components**: ~50-100 KB

### Database Options Impact

| Option | Additional Size | Total Plugin Size | Mobile Load Time Impact |
|--------|----------------|-------------------|------------------------|
| **RxDB + LokiJS** | +400 KB | ~700-900 KB | ⚠️ Moderate (+0.5-1s) |
| **sql.js** | +850-1600 KB | ~1.15-2.1 MB | ❌ Significant (+1-2s) |
| **sqliteDB (external)** | +0 KB | ~300-500 KB | ✅ None |
| **Enhanced Cache** | +10-20 KB | ~310-520 KB | ✅ Minimal (<0.1s) |
| **LokiJS** | +200 KB | ~500-700 KB | ✅ Minor (+0.3-0.5s) |
| **PouchDB** | +150 KB | ~450-650 KB | ✅ Minor (+0.2-0.4s) |
| **Dexie.js** | +20 KB | ~320-520 KB | ✅ Minimal (<0.1s) |

### Recommendation Based on Bundle Size
- **< 600 KB**: Enhanced Cache or Dexie.js
- **< 1 MB**: RxDB, LokiJS, or PouchDB
- **< 2 MB**: sql.js acceptable if SQL required
- **> 2 MB**: Consider external dependency (sqliteDB) or re-evaluate requirements

**Target**: Keep plugin under 1 MB for good mobile experience

---

## Security Considerations

### Data at Rest
- **Encryption**: Obsidian vaults can be encrypted (user responsibility)
- **Sensitive Data**: API keys stored via Obsidian's secure storage, not database
- **Audit Logs**: Database should log access patterns for security review
- **Backup Security**: Database exports should respect vault encryption

### Data in Transit
- **Local Only**: Database never sends data over network (unless explicit sync)
- **API Security**: External API endpoints (Phase 3) handle authentication separately
- **Sync Security**: If sync enabled, use TLS/mTLS (existing Phase 1 infrastructure)

### Access Control
- **Plugin Isolation**: Database only accessible within Carnival Network plugin
- **No External Access**: Database not exposed to other Obsidian plugins
- **Audit Trail**: Log all database modifications for debugging and compliance

### Database-Specific Security

**RxDB**:
- Encryption plugin available
- Validate all writes to prevent injection
- Sanitize query parameters

**sql.js**:
- No SQL injection risk (parameterized queries)
- Validate schema on load to prevent corruption
- Sanitize all user input before queries

**Enhanced Cache**:
- JSON parsing vulnerabilities (use safe parser)
- File permission checks (use Vault API properly)
- Validate data integrity on load

---

## Testing Strategy

### Unit Tests
- Database initialization and teardown
- CRUD operations for all entity types
- Query methods with various parameters
- Index management and rebuilding
- Migration and rollback procedures
- Error handling and fallback behavior

### Integration Tests
- ActService integration with database
- CarnivalQueryService with persistence
- Observability framework integration
- Cache fallback when database unavailable
- Mobile environment simulation

### Performance Tests
- Query performance benchmarks (baseline and targets)
- Large dataset handling (10k, 100k, 1M records)
- Memory usage profiling
- Bundle size validation
- Mobile device testing (iOS and Android)

### Compatibility Tests
- Obsidian version compatibility (desktop and mobile)
- Plugin upgrade scenarios
- Data migration from Phase 3 state
- Concurrent access patterns
- Platform-specific behaviors (macOS, Windows, Linux, iOS, Android)

---

## Migration Plan from Phase 3

### Pre-Migration
1. **Backup existing data**: Export all cache data to JSON
2. **Document current state**: Record all performers, acts, territories
3. **Create test environment**: Clone vault for testing
4. **Version check**: Ensure plugin version supports migration

### Migration Steps

**Step 1: Database Initialization**
```typescript
async function initializeDatabase() {
  // Initialize chosen database (e.g., RxDB)
  const db = await createRxDatabase({ /* config */ });
  
  // Create schema and collections
  await db.addCollections({
    acts: { schema: actSchema },
    performers: { schema: performerSchema },
    territories: { schema: territorySchema },
    metrics: { schema: metricsSchema }
  });
  
  return db;
}
```

**Step 2: Data Export from Cache**
```typescript
async function exportCacheData() {
  const cache = this.persistentPerformerCache;
  
  const data = {
    acts: Array.from(cache.data.values()),
    metadata: {
      exportDate: Date.now(),
      pluginVersion: this.manifest.version,
      recordCount: cache.size
    }
  };
  
  await this.vault.adapter.write(
    '.obsidian/plugins/carnival-network/migration-export.json',
    JSON.stringify(data, null, 2)
  );
  
  return data;
}
```

**Step 3: Data Import to Database**
```typescript
async function importToDatabase(db: RxDatabase, data: any) {
  const actsCollection = db.acts;
  
  // Batch insert for performance
  const batchSize = 100;
  for (let i = 0; i < data.acts.length; i += batchSize) {
    const batch = data.acts.slice(i, i + batchSize);
    await actsCollection.bulkInsert(batch);
  }
  
  Log.info(`Migrated ${data.acts.length} acts to database`);
}
```

**Step 4: Verification**
```typescript
async function verifyMigration(cache: PersistentPerformerCache, db: RxDatabase) {
  const cacheCount = cache.size;
  const dbCount = await db.acts.count().exec();
  
  if (cacheCount !== dbCount) {
    throw new Error(`Migration verification failed: cache=${cacheCount}, db=${dbCount}`);
  }
  
  // Spot check random records
  const sampleIds = Array.from(cache.data.keys()).slice(0, 10);
  for (const id of sampleIds) {
    const cacheRecord = cache.get(id);
    const dbRecord = await db.acts.findOne(id).exec();
    
    if (JSON.stringify(cacheRecord) !== JSON.stringify(dbRecord)) {
      throw new Error(`Record mismatch for ${id}`);
    }
  }
  
  Log.info('Migration verification successful');
}
```

**Step 5: Cutover**
```typescript
async function cutoverToDatabase(db: RxDatabase) {
  // Update ActService to use database
  this.actService.setDatabase(db);
  
  // Mark migration complete
  await this.vault.adapter.write(
    '.obsidian/plugins/carnival-network/migration-status.json',
    JSON.stringify({
      completed: true,
      date: Date.now(),
      databaseType: 'rxdb'
    })
  );
  
  // Keep cache as fallback
  this.actService.setFallbackCache(this.persistentPerformerCache);
}
```

### Rollback Plan
```typescript
async function rollbackMigration() {
  // Disable database
  await this.db.destroy();
  
  // Restore ActService to cache-only mode
  this.actService.setDatabase(null);
  this.actService.useCacheOnly(true);
  
  // Load cache from disk
  await this.persistentPerformerCache.loadFromDisk();
  
  Log.warn('Rolled back to cache-only mode');
}
```

---

## Conclusion

For the Carnival Network Plugin's Phase 4 database integration, **RxDB is the recommended primary choice** due to its:
- Offline-first design philosophy matching project requirements
- Storage adapter flexibility supporting desktop, mobile, and fallback scenarios
- Reactive query system ideal for Obsidian's UI updates
- Acceptable bundle size impact (200-400 KB)
- Active development and modern architecture

**sql.js is recommended as secondary option** if:
- Complex SQL analytics are essential
- Relational data model strongly preferred
- Bundle size increase (850 KB - 1.6 MB) is acceptable
- Manual persistence management is acceptable

**Enhanced PersistentPerformerCache is recommended as baseline implementation**:
- Provides fallback when database unavailable
- Minimal bundle size impact (~10-20 KB)
- Already proven in Phase 2
- Can be extended with indexes and query methods
- Future database integration remains possible

### Final Recommendation

**Implement in order**:
1. **Prototype RxDB** (2 weeks): Validate performance, bundle size, integration
2. **Maintain Enhanced Cache** (ongoing): Keep as fallback and baseline
3. **Evaluate sql.js** (1 week): Only if RxDB query performance insufficient
4. **Make final decision**: Based on prototype results and requirements

This approach de-risks Phase 4 by validating assumptions early while maintaining a working fallback solution throughout development.

---

## Additional Resources

### RxDB
- **Documentation**: https://rxdb.info/
- **GitHub**: https://github.com/pubkey/rxdb
- **Examples**: https://github.com/pubkey/rxdb/tree/master/examples
- **Storage Adapters**: https://rxdb.info/rx-storage.html

### sql.js
- **Documentation**: https://sql.js.org/
- **GitHub**: https://github.com/sql-js/sql.js
- **Examples**: https://sql.js.org/#/?id=examples
- **SQLite Documentation**: https://www.sqlite.org/docs.html

### sqliteDB Plugin
- **GitHub**: https://github.com/stfrigerio/sqliteDB
- **Installation**: Via Obsidian Community Plugins

### LokiJS
- **Documentation**: https://github.com/techfort/LokiJS/wiki
- **GitHub**: https://github.com/techfort/LokiJS

### Dexie.js
- **Documentation**: https://dexie.org/
- **GitHub**: https://github.com/dexie/Dexie.js

### PouchDB
- **Documentation**: https://pouchdb.com/
- **GitHub**: https://github.com/pouchdb/pouchdb

---

*Document prepared for Phase 4 planning. Review and validate recommendations through prototyping before final implementation decision.*
