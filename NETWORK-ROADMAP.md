# Carnival Records Plugin - Network Development Roadmap

**Last Updated**: 2025-11-15  
**Status**: Phase 3.2/5 Complete (Archive Abstraction + Minimal Observability)  
**Next Priority**: Phase 3.3 (External API Service) or Phase 4 (RxDB Integration)

---

## Executive Summary

This roadmap outlines the complete network infrastructure development for the Carnival Records Plugin, from foundational architecture through production hardening. The plugin enables distributed record-keeping and network coordination across Obsidian vaults using HTTP-based registry discovery and P2P-inspired communication patterns.

---

## Preliminary Patchwork

### External API Service
- Compare `RegistryNode` and `NetworkNode` types
- Right now, there are routes for Discord-related endpoints, and in the 
	example to extend the service, you used Slack for adding endpoints. Is it 
	possible to create a more modular system where new endpoints can be 
	created and registered from outside of the plugin?

### Types
- document all types; create an index for reference

---

## Completed Phases

### Phase 1: Foundation & Circuit Breaking (✅ Complete)
**Status**: Initial network services established with resilience patterns

#### Deliverables
- ✅ Basic HTTP registry service for performer discovery
- ✅ Circuit breaker pattern for endpoint resilience
- ✅ TLS/mTLS support for secure communication
- ✅ Certificate store and trust management
- ✅ Network protocol abstraction layer
- ✅ HTTP client with retry logic

#### Key Files
- `src/network/http-registry-service.ts` - Registry endpoint management
- `src/network/circuit-breaker.ts` - Circuit breaker implementation
- `src/network/http-client.ts` - HTTP communication with retries
- `src/network/certificate-store.ts` - Certificate management

---

### Phase 2: Advanced Infrastructure (✅ Complete)

#### 2.1 Persistent Storage & Caching (✅ Complete)
**Status**: Performer registry now persists across plugin reloads

**Deliverables**
- ✅ LRU cache implementation with TTL support
- ✅ Persistent storage via Obsidian vault adapter
- ✅ Graceful degradation to memory-only mode
- ✅ Configurable cache size and persistence intervals
- ✅ Background auto-save mechanism
- ✅ Integration with HttpRegistryService
- ✅ Cache metrics in network health dashboard

**Key Files**
- `src/network/persistent-performer-cache.ts` - LRU cache with persistence
- `src/network/http-registry-service.ts` - Updated for persistent cache
- `src/ui/components/CarnivalRecordsSettingTab.ts` - Cache metrics UI

**Features Enabled**
- Performer registry survives plugin reloads
- Configurable retention policies
- Automatic cleanup of expired entries
- Real-time cache performance monitoring

#### 2.2 Advanced Monitoring (✅ Complete)
**Status**: Comprehensive observability across network operations

**Deliverables**
- ✅ Correlation ID tracking system
  - End-to-end request tracing
  - Session grouping for related operations
  - Component chain tracking
- ✅ Metrics collection system
  - Counters, gauges, histograms
  - Tagged metrics for filtering
  - Time-series data with p50/p95/p99
  - State transition tracking
- ✅ Endpoint health probing
  - Half-open circuit breaker testing
  - Automatic endpoint restoration
  - Configurable probe intervals
  - Probe result history
- ✅ Health check endpoints
  - Comprehensive JSON health responses
  - Kubernetes-compatible ready/live endpoints
  - Load balancer OK/ERROR responses
  - Component status aggregation
- ✅ Enhanced logging
  - Structured logging with levels
  - Log buffering (500 entry buffer)
  - JSON/CSV export capabilities
  - Configurable output formats

**Key Files**
- `src/monitoring/correlation-tracker.ts` - Request correlation
- `src/monitoring/metrics-collector.ts` - Metrics aggregation
- `src/monitoring/endpoint-prober.ts` - Health probing
- `src/monitoring/health-check.ts` - Health endpoints
- `src/utils/logger.ts` - Enhanced logging system

**Features Enabled**
- Complete request tracing across all components
- Detailed performance metrics and analysis
- Automatic circuit breaker recovery
- Real-time health monitoring
- External monitoring system integration

---

## In-Progress / Planned Phases

### Phase 3: Advanced API & External Integration (🔄 In Progress)
**Timeline**: Current development cycle (Nov 2025)  
**Dependencies**: Phase 2 complete ✅, functional network data available ✅  
**Recent Work**: Archive abstraction layer implemented ✅, minimal observability with webhook+metrics endpoints ✅

#### 3.1 Type System & Service Architecture (✅ Complete - Nov 2025)
**Scope**: Establish proper type hierarchies and service interfaces

**Completed Deliverables**
- ✅ **Act Query Type Hierarchy** - Proper extension hierarchy established
  - `ActQueryParams` (API input layer)
  - `ActQueryOptions` (internal processing with required fields)
  - `ExtendedActQueryOptions` (advanced filtering)
  - `PaginatedActResult` (response format)
  - `ActQueryBuilder` for complex query construction
- ✅ **Analytics Type System** - Comprehensive analytics types created
  - `CarnivalActivity` (renamed from NetworkActivity)
  - `CarnivalTopology` (renamed from NetworkTopology)
  - `ActivityAnalytics`, `CapabilityAnalytics`, `PerformanceAnalytics`
  - `RecordAnalytics`, `TerritoryAnalytics`, `AnalyticsData`
  - `ObservabilityConfig`, `MetricDataPoint`
  - `AnalyticsQueryParams`, `AnalyticsResponse`
- ✅ **CarnivalQueryService Refactored** - Proper interface implementation
  - Implements `QueryServiceInterface` with all 3 required methods
  - `queryTerritory()`, `queryAllTerritories()`, `getPerformerStatus()`
- ✅ **Minimal Observability System** - Lightweight, plugin-native observability
  - In-memory metrics registry with simple counters and gauges
  - Prometheus-style metrics endpoint via `obsidian-local-rest-api` plugin (pull model)
  - Webhook provider for push-based metrics with HMAC-SHA256 signature verification
  - No external dependencies on monitoring platforms (self-contained)
  - Pull model: Scrape `/carnival/metrics` endpoint for Prometheus-format metrics
  - Push model: POST metrics to webhook with optional signature for integrity verification
  - Integrated into plugin lifecycle (initialization on load, cleanup on unload)
  - Settings UI for enabling metrics and configuring webhook endpoint/secret
- ✅ **ActService Methods Implemented**
  - `queryActs()` - Full filtering and pagination support
  - `countActs()` - Count matching records
  - `broadcastAct()` - Network broadcast with acknowledgment
  - `queryActsPaginated()` - Pagination with metadata
  - `performSearch()` - Cross-act search with relevance scoring
  - `listActs()` - Simple listing with filters
  - `getAct()` - Single act retrieval
- ✅ **Network Abstraction Review** - Clean separation of concerns
  - Plugin lifecycle properly separated from business logic
  - Public API methods (`joinCarnival()`, `leaveCarnival()`)
  - Proper context binding with `.call(this, ...)`
  - API integration documentation created

**Key Files Refactored**
- `src/types/public/records-types.ts` - Act query types consolidated
- `src/types/public/act-query-types.ts` - Simplified to utilities only
- `src/types/public/analytics-types.ts` - NEW: Comprehensive analytics types
- `src/network/services/carnival-query-service.ts` - Interface implementation
- `src/network/services/act-service.ts` - Query methods implemented
- `src/main.ts` - Public API methods added
- `.github/docs/api-integration.md` - NEW: Integration guide

**Session Documentation**
- `.warp/2025-11-11-act-query-type-refactoring.md` - Type hierarchy details
- `.warp/2025-11-11-carnival-query-service-refactoring.md` - Service refactoring
- `.warp/2025-11-11-network-abstraction-review.md` - Network abstraction
- `.warp/typescript-updates-and-metrics-api.md` - Observability implementation summary

#### 3.2 Archive Abstraction Layer (✅ Complete - Nov 2025)
**Scope**: Prepare architecture for Phase 4 database integration with carnival-themed storage abstraction

**Strategic Value**:
- Enables clean RxDB integration in Phase 4 without refactoring business logic
- Improves testability immediately (mock archives for unit tests)
- Maintains PersistentPerformerCache as permanent fallback layer
- Adapter pattern proven for storage backend swaps
- Carnival-themed: "Archive" evokes tome-y, old-world record preservation

**Deliverables**
- ✅ **ArchiveInterface** - Carnival record storage contract defined
  - CRUD operations (create, findById, find, findOne, update, delete)
  - Query operations (count, exists, all with filtering)
  - Index management (createIndex, dropIndex, rebuildIndexes)
  - Batch operations (bulkCreate, bulkUpdate, bulkDelete)
  - Optional transaction support interface
  - Comprehensive JSDoc documentation
- ✅ **InMemoryArchive** - Production-ready in-memory implementation
  - Automatic index maintenance (byTerritory, byActType, byStatus, byPerformer)
  - Query optimization with index intersection
  - Full filtering, sorting, and pagination support
  - Statistics tracking and monitoring
  - 474 lines of production code in `src/archive/in-memory-archive.ts`
- ✅ **CacheArchive** - PersistentPerformerCache wrapper (NEW)
  - Wraps PersistentPerformerCache as ArchiveInterface
  - Bidirectional Performer ↔ CarnivalRecord mapping
  - Serves as fallback when primary archive unavailable
  - Respects cache size limits and TTL expiration
  - Full ArchiveInterface implementation (CRUD, batch, queries)
  - 475 lines in `src/archive/cache-archive.ts`
- ✅ **MockArchive** - Testing utility with call tracking
  - Configurable error throwing for test scenarios
  - Latency simulation
  - Call history tracking for verification
  - Test data seeding capabilities
  - 300+ lines in `tests/mock-archive.test.ts`
- ✅ **Archive Module** - Proper exports and organization
  - `src/archive/index.ts` with InMemoryArchive and CacheArchive exports
  - Type re-exports for API consistency
- ✅ **Type System** - Complete archive type definitions
  - `archive-types.ts` with ArchiveInterface, ArchiveQueryOptions, ArchiveBatchResult, ArchiveStats
  - Type guards for feature detection (supportsTransactions, supportsIndexes)
  - Safe date handling utilities in `type-guards.ts`
  - Full TypeScript support
- ✅ **Documentation** - Comprehensive implementation and testing guide
  - `.github/docs/archive-abstraction-implementation.md` (570 lines)
  - `.github/docs/observability-testing-guide.md` (310 lines - NEW for testing)
  - Usage examples and API reference
  - Manual testing procedures for complete validation
  - Session notes in `.warp/archive-abstraction/`
- ⏳ **ActService Refactoring** - Use archive interface instead of direct Map
  - Replace `private acts: Map<>` with `private archive: ArchiveInterface`
  - Convert all query methods to use archive interface
  - Update method signatures to async where needed
  - No breaking changes to public ActService API
  - Transparent to CarnivalQueryService and external consumers
- ⏳ **Integration Testing** - Full test coverage
  - Unit tests for all archive implementations
  - ActService tests with each archive backend
  - Performance verification and comparison

**Key Files Created**
- ✅ `src/archive/in-memory-archive.ts` (474 lines)
- ✅ `src/archive/cache-archive.ts` (475 lines - NEW)
- ✅ `src/archive/index.ts` (14 lines - NEW)
- ✅ `src/types/public/archive-types.ts` (230 lines)
- ✅ `src/types/type-guards.ts` (79 lines)
- ✅ `tests/mock-archive.test.ts` (300+ lines)
- ✅ `.github/docs/archive-abstraction-implementation.md` (570 lines)
- ✅ `.github/docs/observability-testing-guide.md` (310 lines - NEW)
- ✅ `.warp/archive-abstraction/` session documentation

**Current Status** (Nov 15, 2025):
- ✅ Core abstraction layer complete and tested
- ✅ InMemoryArchive production-ready
- ✅ CacheArchive provides fallback degradation pattern
- ✅ MockArchive enables comprehensive testing
- ✅ Minimal observability system integrated (metrics + webhook provider)
- ✅ Comprehensive testing guide created for manual validation
- ⏳ Manual observability testing needed (metrics endpoint and webhook delivery)
- ⏳ ActService refactoring to consume ArchiveInterface (optional - can be deferred)

**Phase 4 Benefit**: RxDB becomes RxDBArchive implementation, no business logic changes required

**Observability Completion Note**:
Phase 3.1 + 3.2 also includes minimal observability implementation:
- In-memory metrics registry with Prometheus text format
- Webhook provider with HMAC-SHA256 signature verification
- Local REST API metrics endpoint integration
- Settings UI controls for observability configuration
- `.github/docs/observability-testing-guide.md` for manual validation

---

#### 3.3 External API Service Implementation (⏳ Next Priority)
**Scope**: Create RESTful API endpoints for external clients

**High-Priority Deliverables**
- [ ] RESTful API endpoints for external clients (NEW - needs dedicated service)
  - Records query with pagination and filtering
  - Record creation with validation
  - Territory discovery and performer status
  - Network health and topology information
- [ ] Webhook integrations for external systems
  - GitHub webhook signature verification and processing
  - Newsletter platform webhook handling
  - Generic webhook framework for custom integrations
  - Event processing and automated record creation
- [ ] Cross-vault search and analytics API
  - Full-text search across carnival territories
  - Network analytics and reporting endpoints
  - Historical activity tracking and trends
- [ ] Client authentication & authorization
  - API key management and validation
  - Session token generation and lifecycle
  - Permission-based access control system
  - Client type categorization (webhook, external, service)
- [ ] Rate limiting implementation
  - Per-client request throttling
  - Configurable limits per operation type
  - Rate limit headers and status responses

**Core API Endpoints to Implement**
```
GET    /api/records              - Query records with filtering
POST   /api/records              - Create new record
GET    /api/territories          - List available territories
GET    /api/network/status       - Network health and status
POST   /api/search               - Cross-vault search
GET    /api/analytics            - Network analytics
POST   /api/webhooks/github      - GitHub event processing
POST   /api/webhooks/newsletter  - Newsletter event processing
```

**Methods Status Update**
- ✅ `queryActs()` - IMPLEMENTED in ActService (full filtering, pagination, sorting)
- ✅ `countActs()` - IMPLEMENTED in ActService (supports territory, type, status filters)
- ✅ `broadcastAct()` - IMPLEMENTED in ActService (network broadcast with acknowledgment)
- ✅ `getNetworkTopology()` - IMPLEMENTED as `getCarnivalTopology()` in CarnivalQueryService
- ✅ `getConnectedPerformersCount()` - IMPLEMENTED in CarnivalQueryService
- ✅ `getRecentActivity()` - IMPLEMENTED in CarnivalQueryService (configurable timeframe)
- ✅ `generateAnalyticsData()` - IMPLEMENTED as `generateAnalytics()` in CarnivalQueryService
- ✅ `performSearch()` - IMPLEMENTED as `performSearch()` in ActService (relevance-based)
- [ ] `verifyGitHubSignature()` - NOT YET IMPLEMENTED (webhook handlers exist but verification pending)
- [ ] `verifyNewsletterSignature()` - NOT YET IMPLEMENTED
- [ ] `handleGitHubWebhook()` - PARTIAL (handler exists in discord-handlers.ts, needs signature verification)
- [ ] `handleNewsletterWebhook()` - PARTIAL (handler exists in webhook-handlers.ts, needs signature verification)

**Leveraging Existing Infrastructure**
- ✅ Using `CorrelationTracker` for request tracing through API calls
- ✅ Using `globalMetrics` for API performance monitoring
- ✅ Using `globalProber` for endpoint health checks
- ✅ Using `globalHealthCheck` for API status endpoints
- ✅ Using enhanced `Log` system for detailed API logging
- ✅ Using `PersistentPerformerCache` for quick record access
- ✅ Observability framework integrated into CarnivalQueryService
- ✅ ActService has in-memory indexing (by territory, type, performer)

**Testing Requirements**
- [ ] Unit tests for ActService query methods
- [ ] Unit tests for CarnivalQueryService interface methods
- [ ] Integration tests with TerritoryAccessService
- [ ] Type hierarchy compatibility tests
- [ ] ActQueryBuilder tests
- [ ] Observability framework tests (metric buffering, flushing)
- [ ] Signature verification tests for webhooks (pending implementation)
- [ ] Rate limiting validation tests (pending implementation)
- [ ] Error handling and edge case coverage

**Phase 3.1 Completion Criteria** ✅
- ✅ Core query methods implemented and functional
- ✅ Proper type hierarchy established
- ✅ Interface compliance (QueryServiceInterface)
- ✅ Observability framework architecture complete
- ✅ Request correlation and metrics integrated
- ✅ ActService query/count/broadcast methods operational

**Phase 3.2 Completion Criteria** (Archive Abstraction - Current)
- [ ] ArchiveInterface defined and documented
- [ ] InMemoryArchive implemented and tested
- [ ] CacheArchive wraps PersistentPerformerCache
- [ ] ActService refactored to use archive interface
- [ ] MockArchive created for testing
- [ ] All existing tests pass with archive implementation
- [ ] No performance regression from abstraction layer

**Phase 3.3 Completion Criteria** (External API - Remaining)
- [ ] External REST API endpoints created
- [ ] Webhook signature verification implemented
- [ ] Rate limiting implementation complete
- [ ] All API endpoints tested
- [ ] Zero critical API security issues

---

### Phase 4: Persistent Database Integration (⏳ Post-API Phase)
**Timeline**: After API endpoints fully implemented  
**Dependencies**: Phase 3 complete ✅, archive abstraction layer ✅, operational API with analytics needs ✅  
**Selected Solution**: **RxDB** (reactive, offline-first NoSQL database)

**Decision Rationale** (from Phase 4 analysis in `.warp/phase4-database-analysis.md`):
- ✅ Offline-first design matches Obsidian's philosophy perfectly
- ✅ Storage adapter flexibility (LokiJS for desktop, Dexie/IndexedDB for mobile)
- ✅ Reactive queries integrate seamlessly with Obsidian UI
- ✅ Moderate bundle size (200-400 KB acceptable for features provided)
- ✅ NoSQL document model fits carnival records structure
- ✅ Active development and modern architecture
- ✅ Optional sync capabilities for future multi-vault scenarios

**Alternative Considered**: sql.js (full SQL, 850 KB-1.6 MB bundle) - available if complex relational queries become critical

#### 4.1 RxDB Integration & Schema Design
**Scope**: Integrate RxDB as ArchiveInterface implementation (RxDBArchive)

**Critical Obsidian Plugin Constraints**
- **Single Bundled File**: Plugin compiles to single JavaScript file via esbuild for Obsidian consumption
  - Any built-in database solution must be bundled within compiled plugin
  - No external database connections available during offline operation
  - File size implications: embedded database libraries increase bundle size

- **Network Independence**: Obsidian operates without network connectivity
  - Local REST API enables isolated vault automation
  - Database must work completely offline or degrade gracefully
  - Network connectivity is optional enhancement, not requirement

- **Mobile Compatibility**: Plugin runs on mobile Obsidian clients
  - Device-local databases may not be available on mobile
  - File system access constraints vary by platform
  - Memory limitations on mobile require efficient storage

- **Cache-First Architecture**: Persistent cache acts as fallback layer
  - If database unavailable: `PersistentPerformerCache` maintains data indefinitely
  - Cache should survive plugin reloads, mobile app suspension
  - Database acts as supplementary persistence, not mandatory requirement

**High-Priority Deliverables**
- [ ] **Data Model Preparation** - Prepare TypeScript types for RxDB schemas
  - Review existing types (CarnivalAct, PerformerRegistration, etc.) for RxDB compatibility
  - Add required fields: `createdAt`, `updatedAt`, `version` timestamps
  - Ensure all fields use RxDB-compatible types (string, number, boolean, object)
  - Define primary keys and index fields
  - Document schema versioning strategy for future migrations
- [ ] **RxDB Schema Definition** - Convert TypeScript interfaces to RxDB schemas
  - CarnivalAct schema with indexes on territory, type, performer, timestamp
  - PerformerRegistration schema with indexes on performerId, territory
  - MetricsHistory schema for time-series analytics data
  - NetworkTopology schema for historical topology snapshots
  - EventLog schema for webhook events and state transitions
- [ ] **RxDBArchive Implementation** - RxDB as ArchiveInterface
  - Implement ArchiveInterface using RxDB collections
  - Initialize RxDB with appropriate storage adapter:
    - Desktop: LokiJS adapter with filesystem persistence via Vault API
    - Mobile: Dexie.js adapter (IndexedDB, browser-native)
    - Fallback: In-memory adapter → CacheArchive
  - Handle RxDB initialization failures gracefully (fallback to cache)
  - Integrate reactive queries with observable patterns
- [ ] **Bundle Integration** - Add RxDB to plugin bundle
  - Install RxDB and required storage adapters via npm
  - Configure esbuild to bundle RxDB correctly
  - Measure bundle size impact (target < 400 KB increase)
  - Optimize imports to minimize bundle size (tree-shaking)
  - Test WASM loading for LokiJS adapter
- [ ] Record persistence
  - Long-term storage for all carnival records
  - Historical tracking and audit trails
  - Efficient querying and filtering
- [ ] Metrics history persistence
  - Time-series data storage for analytics
  - Aggregation and rollup strategies
  - Efficient retention policies
- [ ] Network topology history
  - Track network changes over time
  - Performer registration/deregistration history
  - Territory evolution tracking
- [ ] Event log persistence
  - Webhook events and external integrations
  - Network events and state transitions
  - Audit trail for compliance and debugging

**Offline-First Strategy**
- **Primary Layer**: `PersistentPerformerCache` (LRU + filesystem persistence)
  - Guaranteed operation without database
  - Indefinite data retention
  - Cross-reload, cross-session durability
  - Mobile-safe with no special permissions

- **Secondary Layer**: Database (if available)
  - Enhanced query capabilities
  - Advanced analytics and historical tracking
  - Graceful initialization if database unavailable
  - Automatic fallback to cache-only mode

- **Sync Layer** (for multi-device scenarios)
  - Optional network sync when connectivity available
  - Conflict resolution for offline edits
  - Bidirectional sync from vault to external persistence
  - Non-blocking: sync errors don't affect local operation

**Mobile Considerations**
- **File System**: Use Obsidian's Vault API for all file I/O (handles mobile permissions)
- **Memory Efficiency**: Database query results paginated, streaming where possible
- **Power Consumption**: Batch write operations, minimize disk I/O patterns
- **Platform Variations**: Test on iOS/Android to identify platform-specific constraints

**Core Capabilities**
- [ ] CRUD operations for persistent records
- [ ] Time-series data models for metrics
- [ ] Query optimization for analytics
- [ ] Backup and restore procedures
- [ ] Database migration tools
- [ ] Concurrent access handling
- [ ] Graceful database initialization with cache fallback
- [ ] Offline operation verification and testing

**Integration Points**
- ActService uses RxDBArchive via ArchiveInterface (no business logic changes)
- Replace/supplement in-memory structures with RxDB collections
- Persist metrics from `globalMetrics` for historical analysis
- Store webhook events for replay and debugging
- Archive correlation and trace data for audit purposes
- CacheArchive remains available as fallback layer

#### 4.2 Analytics & Reporting
**Scope**: Build analytics capabilities on top of persistent data

**Deliverables**
- [ ] Historical metrics and trends
  - Request volume trends
  - Error rate evolution
  - Performance degradation detection
- [ ] Network analytics
  - Territory activity metrics
  - Performer reliability statistics
  - Discovery and registration patterns
- [ ] API usage analytics
  - Per-client request patterns
  - Endpoint popularity
  - Rate limit usage
- [ ] Advanced reporting
  - Custom time-range queries
  - Cross-dimensional analysis
  - Export capabilities (CSV, JSON)

#### 4.3 Data Migration & Compatibility
**Scope**: Ensure smooth transition to persistent storage

**Deliverables**
- [ ] Migration utilities
  - Tools to export in-memory data
  - Database initialization and seeding
  - Backwards compatibility layer
- [ ] Rollback procedures
  - Graceful downgrade path
  - Data preservation during rollback
  - Fallback to in-memory mode
- [ ] Testing infrastructure
  - Database integrity verification
  - Data consistency checks
  - Performance benchmarking

#### 4.4 Performance Optimization
**Scope**: Ensure database doesn't become bottleneck

**Deliverables**
- [ ] Query optimization
  - Indexing strategies
  - Query plan optimization
  - Connection pooling
- [ ] Caching strategies
  - Database query caching
  - Hot data in-memory caching
  - Cache invalidation strategies
- [ ] Data retention policies
  - Automatic cleanup of old data
  - Archival strategies
  - Storage optimization

**Bundle Size Impact Analysis (RxDB)**
- **Baseline**: Current plugin bundle ~300-500 KB
- **RxDB Core**: +150-200 KB minified
- **LokiJS Adapter**: +200 KB (desktop)
- **Dexie.js Adapter**: +50 KB (mobile alternative)
- **Total Impact**: +200-400 KB depending on adapters included
- **Target**: Keep total plugin bundle < 1 MB for good mobile experience
- **Mitigation**: Tree-shake unused plugins, selective imports, lazy-load sync features

**RxDB Storage Adapter Strategy**

**Desktop Obsidian (Electron):**
- Use LokiJS adapter with filesystem persistence via Vault API
- Benefits: In-memory speed with disk persistence, no IndexedDB needed
- Trade-off: +200 KB bundle size, requires manual save/load coordination

**Mobile Obsidian (iOS/Android):**
- Use Dexie.js adapter (IndexedDB wrapper)
- Benefits: Browser-native, automatic persistence, mobile-optimized
- Trade-off: IndexedDB not file-based (harder to backup via Vault)

**Fallback (All Platforms):**
- In-memory adapter → CacheArchive (PersistentPerformerCache)
- Guaranteed operation without database
- No RxDB initialization required
- Zero bundle size impact if RxDB fails to load

**Phase Completion Criteria**
- ✅ Database selection: RxDB chosen (see `.warp/phase4-database-analysis.md`)
- [ ] Data model preparation: TypeScript types RxDB-ready
- [ ] RxDB schemas defined for all entity types
- [ ] RxDBArchive implements ArchiveInterface
- [ ] Bundle size impact measured (target < 400 KB increase)
- [ ] All records persist correctly in RxDB
- [ ] Historical analytics queryable and performant
- [ ] Migration from Phase 3 storage successful
- [ ] Backup/restore procedures functional
- [ ] Desktop (LokiJS) and mobile (Dexie) adapters tested
- [ ] Offline operation verified on mobile clients
- [ ] CacheArchive fallback verified when RxDB unavailable
- [ ] Reactive queries integrated with UI updates
- [ ] No breaking changes to ActService public API

---

### Phase 5: Production Hardening (⏳ Final Phase)
**Timeline**: After database integration complete  
**Dependencies**: Phase 4 complete

#### 5.1 Security Hardening
- [ ] Input validation and sanitization across all endpoints
- [ ] CSRF protection for state-changing operations
- [ ] Injection attack prevention (SQL, NoSQL, command)
- [ ] XSS prevention in API responses
- [ ] Rate limiting refinement and DOS mitigation
- [ ] Security audit of certificate validation
- [ ] Secrets management for API keys and tokens
- [ ] Audit logging for security events

#### 5.2 Performance Optimization
- [ ] API response caching strategy
- [ ] Database query optimization (with Phase 4 database)
- [ ] Connection pooling for registry endpoints
- [ ] Memory profiling and optimization
- [ ] Cache hit rate optimization
- [ ] Payload compression (gzip support)
- [ ] Load testing and benchmarking

#### 5.3 Reliability & Resilience
- [ ] Graceful degradation when registries unavailable
- [ ] Fallback mechanisms for failed operations
- [ ] Dead letter queue for failed webhooks
- [ ] Automatic recovery procedures
- [ ] Network partition handling
- [ ] Data consistency verification

#### 5.4 Operational Excellence
- [ ] Comprehensive monitoring dashboards
- [ ] Alerting for critical conditions
- [ ] Log aggregation and analysis
- [ ] Metrics export (Prometheus, etc.)
- [ ] Health check dashboards
- [ ] Runbooks for common issues
- [ ] Deployment automation

#### 5.5 Documentation & Knowledge Transfer
- [ ] API documentation (OpenAPI/Swagger specification)
- [ ] Integration guides for external systems
- [ ] Client library examples and SDKs
- [ ] Troubleshooting guide
- [ ] Architecture documentation updates
- [ ] Migration guides for future versions
- [ ] Example webhook consumer implementations
- [ ] Rate limiting and authentication guides

#### 5.6 Testing & Validation
- [ ] End-to-end integration tests
- [ ] Chaos engineering tests
- [ ] Backward compatibility tests
- [ ] Migration testing
- [ ] Performance regression tests
- [ ] Security penetration testing

---

## Infrastructure & Support Systems

### Available Infrastructure (✅ Implemented)

#### Monitoring & Observability
- **Correlation Tracking**: End-to-end request tracing
- **Metrics Collection**: Counters, gauges, histograms with time-series
- **Health Probing**: Automatic endpoint recovery testing
- **Health Endpoints**: Kubernetes-compatible monitoring
- **Enhanced Logging**: Structured logs with export capabilities

#### Network Services
- **Persistent Registry**: LRU cache with cross-reload persistence
- **Circuit Breaker**: Resilient endpoint management
- **HTTP Client**: Retry logic and timeout handling
- **Certificate Management**: TLS/mTLS support
- **Network Protocol**: Abstraction for communication patterns

#### Operational Tools
- **Settings Dashboard**: Network health UI with real-time metrics
- **Cache Management**: Manual flush, clear, and configuration
- **Log Export**: JSON and CSV export for analysis
- **Health API**: Status endpoints for external monitoring

---

## Architecture Patterns & Conventions

### Global Instances (Available System-Wide)
- `globalMetrics` - Metrics collection and analysis
- `globalProber` - Endpoint health probing
- `globalHealthCheck` - Health status aggregation
- `globalStructuredLogger` - Enhanced logging
- `CorrelationTracker` - Request correlation

### Data Structures
- **StructuredLogEntry**: Timestamp, level, component, message, data, error
- **MetricCounter**: Name, type, value, tags, dataPoints
- **ProbeResult**: Endpoint, health status, latency, error
- **HealthCheckResponse**: Status, uptime, components, metrics, probes
- **CorrelationContext**: ID, session, component, operation, metadata

### Integration Points
- `LoggerConfig` API for configuring logging
- `MetricsCollector.recordRequest()` for API metrics
- `CorrelationTracker.startCorrelation()` for request tracing
- `EndpointProber.startProbing()` for health checks
- `HealthCheckSystem` for status aggregation

---

## Development Guidelines

### Before Starting Phase 3
1. **Review Infrastructure**: Familiarize yourself with monitoring, metrics, and health systems
2. **Integration Testing**: Test how API calls integrate with correlation tracking
3. **Metrics Planning**: Identify which metrics are critical for each endpoint
4. **Error Handling**: Plan graceful degradation strategies

### Phase 3 Implementation Strategy
1. **Start with Core Records API**: Most straightforward CRUD operations
2. **Add External Integration**: Expand to webhook and external systems
3. **Implement Search & Analytics**: Leverage existing network data
4. **Test Thoroughly**: Each endpoint under various network conditions

### Phase 4 Database Design Strategy
1. **Evaluate Options**: SQLite for single-vault, PostgreSQL for multi-vault
2. **Schema First**: Design schema before implementation
3. **Migration Planning**: Plan transition from in-memory storage
4. **Performance Baseline**: Establish performance targets early

### Phase 5 Hardening Priorities
1. **Security First**: Never skip security reviews
2. **Performance Baselines**: Establish metrics before optimization
3. **Operational Readiness**: Deploy with monitoring and alerting in place
4. **Documentation**: Keep docs updated as implementation proceeds

---

## Known Limitations & Future Considerations

### Current Limitations
- External REST API service not yet created (ActService/QueryService are internal only)
- No persistent database (planned for Phase 4) - currently in-memory with persistence cache
- No authentication beyond basic API keys (when external API created)
- No webhook signature verification (handlers exist but need security implementation)
- No webhook retry logic for failures
- Limited rate limiting (per-client only, not yet implemented)
- Observability providers not yet implemented (framework exists)

### Future Enhancements
- OAuth2/JWT authentication
- Webhook retry queues with exponential backoff
- Advanced rate limiting (per-endpoint, per-operation)
- GraphQL API alongside REST
- Real-time event streaming (WebSocket)
- Multi-region federation support
- Machine learning-based anomaly detection
- Advanced data visualization dashboards

### Scalability Considerations
- Current architecture supports single Obsidian instance
- Registry endpoints provide horizontal scaling
- Cache TTL can be tuned for larger deployments
- Rate limiting needs adjustment for high-volume use
- Database selection impacts scalability in Phase 4

---

## Success Metrics

### Phase 3 (API Implementation)
- ✅ Core service methods implemented (ActService, CarnivalQueryService)
- ✅ 8 of 12 key methods functional (queryActs, countActs, broadcastAct, getCarnivalTopology, getConnectedPerformersCount, getRecentActivity, generateAnalytics, performSearch)
- [ ] External REST API endpoints created
- [ ] Webhook signature verification implemented (4 methods remaining)
- [ ] 100% of endpoint scenarios tested
- [ ] Zero unhandled exceptions in production logs
- [ ] API response times < 500ms (p95)

### Phase 4 (Database Integration)
- [ ] Database schema designed and implemented
- [ ] All records persisted successfully
- [ ] Metrics history stored and queryable
- [ ] Migration utilities functional
- [ ] Analytics queries performant (< 1s for standard queries)
- [ ] Backup/restore procedures documented and tested

### Phase 5 (Production Hardening)
- [ ] Security audit pass (zero critical findings)
- [ ] Performance baseline established with database
- [ ] 99.9% uptime across test period
- [ ] Complete API documentation coverage
- [ ] Zero data loss events
- [ ] Disaster recovery procedures tested

---

## Document History

**Version 1.2** - 2025-11-12 (Updated)
- Updated Phase 3 status with completed refactoring work
- Documented type system improvements and service implementations
- Added session documentation references from `.warp/` directory
- Updated stub method status (8 of 12 core methods implemented)
- Clarified remaining work for Phase 3.2 (external API endpoints)
- Added observability framework status (architecture complete, providers pending)

**Version 1.1** - 2025-10-17 (Updated)
- Separated database integration into dedicated Phase 4
- Bumped production hardening to Phase 5
- Added database architecture, analytics, and migration details
- Made API client-agnostic (any authenticated client can use endpoints)

**Version 1.0** - 2025-10-17
- Initial roadmap compiled from session work
- Phases 1-2 marked complete
- Infrastructure documented

---

## Contact & Escalation

For questions about this roadmap or to update phases:
- Review existing session notes in `.warp/` directory
- Check ARCHIVE for completed phase documentation
- Reference CHANGELOG files for implementation details

---

*"Through systematic precision in planning, the impossible becomes inevitable. The carnival network roadmap guides us from chaos toward orchestrated excellence across the distributed empire."* - The Management