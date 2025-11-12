# Carnival Records Plugin - Network Development Roadmap

**Last Updated**: 2025-10-17  
**Status**: Phase 2/5 Complete (Phase 3 Ready, Phases 4-5 Planned)  
**Next Major Phase**: Advanced API & External Integration

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

### Phase 3: Advanced API & External Integration (⏳ Ready to Start)
**Timeline**: Following current development cycle  
**Dependencies**: Phase 2 complete ✅, functional network data available ✅

#### 3.1 External API Service Implementation
**Scope**: Flesh out stub implementations in `external-api-service.ts`

**High-Priority Deliverables**
- [ ] RESTful API endpoints for external clients
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

**Stub Methods to Implement**
- `queryActs()` - Query records from network with filtering
- `countActs()` - Count matching records for pagination
- `broadcastAct()` - Broadcast record via network protocol
- `getNetworkTopology()` - Retrieve current topology
- `getConnectedPerformersCount()` - Active performer count
- `getRecentActivity()` - Network activity log retrieval
- `verifyGitHubSignature()` - GitHub webhook signature validation
- `verifyNewsletterSignature()` - Newsletter webhook signature validation
- `handleGitHubWebhook()` - GitHub event processing logic
- `handleNewsletterWebhook()` - Newsletter event processing
- `performCarnivalSearch()` - Cross-vault search implementation
- `generateAnalyticsData()` - Analytics aggregation and generation

**Leveraging Existing Infrastructure**
- Use `CorrelationTracker` for request tracing through API calls
- Use `globalMetrics` for API performance monitoring
- Use `globalProber` for endpoint health checks
- Use `globalHealthCheck` for API status endpoints
- Use enhanced `Log` system for detailed API logging
- Use `PersistentPerformerCache` for quick record access

**Testing Requirements**
- [ ] Unit tests for each endpoint handler
- [ ] Integration tests with mock registry
- [ ] Signature verification tests for webhooks
- [ ] Rate limiting validation tests
- [ ] Error handling and edge case coverage

**Phase Completion Criteria**
- All API endpoints operational and tested
- Request correlation and metrics integrated
- Health endpoints functional
- Rate limiting effective
- Zero critical API security issues

---

### Phase 4: Persistent Database Integration (⏳ Post-API Phase)
**Timeline**: After API endpoints fully implemented  
**Dependencies**: Phase 3 complete ✅, operational API with analytics needs ✅

#### 4.1 Database Architecture Design
**Scope**: Design and implement persistent storage for network data

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
- [ ] Database selection and schema design
  - **Option A (Embedded)**: SQLite.js, sql.js, or similar bundled solution
    - Pros: Single file deployment, zero external dependencies, works offline
    - Cons: Larger bundle size, limited performance for large datasets
  - **Option B (File-based)**: Vault-local JSON/MessagePack files
    - Pros: Minimal dependencies, file-native to Obsidian, mobile-friendly
    - Cons: Less efficient querying, file I/O bottlenecks for large datasets
  - **Option C (Hybrid)**: Embedded SQLite for local, remote sync when available
    - Pros: Best performance offline and online, flexible deployment
    - Cons: Complex sync logic, potential data conflict resolution
  - **Option D (Enhanced Cache)**: Keep PersistentPerformerCache, add optional external persistence
    - Pros: Minimal changes, offline-first by design, mobile-native
    - Cons: Limited query capabilities without database
  - Design schema for records, network topology, metrics history
  - Plan for migration strategy from in-memory to persistent storage
  - **Plan for offline-first behavior**: Define fallback to cache-only operation
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
- Replace/supplement in-memory `PersistentPerformerCache` with database backing
- Persist metrics from `globalMetrics` for historical analysis
- Store webhook events for replay and debugging
- Archive correlation and trace data for audit purposes

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

**Bundle Size Impact Analysis**
- **Baseline**: Current plugin bundle ~X MB
- **SQLite.js**: +Y MB (evaluate impact on plugin load time)
- **sql.js**: +Z MB (in-memory SQL engine)
- **Custom file-based**: Minimal (+K KB for marshaling code)
- **Decision**: Only add embedded database if bundle size remains acceptable
  - Target: Keep plugin bundle < 2-3 MB for mobile compatibility
  - Fallback: Use cache-based approach if embedded DB exceeds budget

**Decision Framework for Database Option Selection**

**Choose Option A (Embedded SQLite) if:**
- Complex query patterns required beyond simple filtering
- Bundle size acceptable (< 500 KB for database library)
- Desktop-primary usage pattern expected
- Advanced analytics queries needed regularly

**Choose Option B (File-based JSON) if:**
- Simple key-value or document-based queries sufficient
- Mobile usage significant
- Bundle size critical constraint
- Obsidian vault file integration preferred

**Choose Option C (Hybrid) if:**
- Best-of-both-worlds approach acceptable
- Sync complexity can be managed
- Offline desktop + online mobile usage pattern

**Choose Option D (Enhanced Cache) if:**
- Current PersistentPerformerCache performance adequate
- Offline-first without database acceptable
- Minimal implementation complexity desired
- Future database integration remains possible

**Phase Completion Criteria**
- Database architecture selected with written justification
- Bundle size impact assessed and approved
- All records persist correctly in chosen storage
- Historical analytics queryable and performant
- Migration from Phase 2 storage successful
- Backup/restore procedures functional
- Offline operation tested on mobile clients
- Cache fallback verified to work when database unavailable

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
- External API service stub implementations
- No persistent database (planned for Phase 4)
- No authentication beyond basic API keys
- No webhook retry logic for failures
- Limited rate limiting (per-client only)

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
- [ ] All 8 API endpoints fully implemented
- [ ] All 12 stub methods functional
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