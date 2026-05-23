# Carnival Records - Network Development Roadmap

**Last Updated**: 2025-01-18  
**Status**: Phase 3.3/5 Complete ✅ (External API + Infrastructure-Only)  
**Next Priority**: Phase 3.4 (Generic Webhook Infrastructure)

---

## Executive Summary

This roadmap outlines the complete network infrastructure development for the Carnival Records Plugin, from foundational architecture through production hardening. The plugin enables distributed act-keeping and network coordination across Obsidian vaults using HTTP-based registry discovery and P2P-inspired communication patterns.

---

## Completed Phases

### Phase 1: Foundation & Circuit Breaking (✅ Complete)
**Status**: Initial network services established with resilience patterns

[... existing Phase 1 content ...]

---

### Phase 2: Advanced Infrastructure (✅ Complete)

[... existing Phase 2 content ...]

---

### Phase 3: Advanced API & External Integration (✅ Complete)
**Timeline**: Nov 2025 - Jan 2025  
**Dependencies**: Phase 2 complete ✅, functional network data available ✅  
**Status**: All sub-phases complete ✅

#### 3.1 Type System & Service Architecture (✅ Complete - Nov 2025)
**Scope**: Establish proper type hierarchies and service interfaces

[... existing Phase 3.1 content ...]

#### 3.2 Archive Abstraction Layer (✅ Complete - Nov 2025)
**Scope**: Prepare architecture for Phase 4 database integration with carnival-themed storage abstraction

[... existing Phase 3.2 content ...]

---

#### 3.3 External API Service Implementation (✅ Complete - Jan 2025)
**Scope**: Create RESTful API endpoints for external clients with multi-performer aggregation

**Final Status** (as of 2025-01-18):
- ✅ Type system complete and validated
- ✅ Nomenclature standardized (Acts, Carnival, Performers)
- ✅ Response wrapper patterns established
- ✅ Request/response types organized
- ✅ API Router fully implemented
- ✅ All 7 API endpoints complete with aggregation
- ✅ Route registration working
- ✅ Infrastructure-only refactoring complete
- ✅ Zero technical debt (no 'as any' casts)
- ✅ Comprehensive testing guide created

**Type System Deliverables** (✅ Complete)
- ✅ **API Response Types Module** (`api-response-types.ts`)
  - `APIResponse<T>` - Generic response wrapper with status, data, error, message, details, timestamp
  - `PaginationMeta` - Pagination metadata (limit, offset, total, hasNext, hasPrevious)
- ✅ **Acts Types Updates** (`acts-types.ts`)
  - Renamed `CarnivalRecord` → `CarnivalAct` for consistency
  - Renamed `RecordMetadata` → `ActMetadata`
  - Added `ActCreateData` for API response format
- ✅ **Search Types Updates** (`search-types.ts`)
  - Added `SearchResponse` for API endpoint format
- ✅ **Territory Types Updates** (`carnival-grounds-types.ts`)
  - Added `TerritoryInfo` (lightweight summary: 3 fields)
  - Added `TerritoriesListData` (API list response)
  - Retained `Territory` (full internal: 7 fields)
  - **Design Decision**: Keep both for API stability and performance
- ✅ **Request Types Updates** (`api-request-types.ts`)
  - Consolidated `ActCreateRequestBody` with inline sync preferences
  - Eliminated redundant `ActCreateBody` type alias
  - Made sync preferences optional for API convenience
- ✅ **Nomenclature Standardization**
  - All "Records" → "Acts"
  - All "Network" → "Carnival" (in status contexts)
  - All method names updated (handleRecordsQuery → handleActsQuery, etc.)
- ✅ **Design Principles Established**
  - Explicit inline fields over complex type compositions
  - No adapters needed (internal/external types aligned)
  - Build inline for simple response types
  - Separate summary vs full types for REST patterns

**Implementation Deliverables** (✅ Complete)
- ✅ **API Router** (`src/api/api-router.ts`)
  - Route registration with Local REST API plugin
  - HTTP method mapping (GET, POST)
  - Error response formatting with proper status codes
  - Type-safe request/response handling
- ✅ **External API Service** (`src/api/external-api-service.ts`)
  - All 7 endpoint handlers implemented
  - Multi-performer aggregation logic
  - Territory-aware routing for act creation
  - Integrated with ActService and CarnivalQueryService
  - Comprehensive error handling (ValidationError, NotFoundError, InternalServerError)
- ✅ **Plugin Integration** (Updated `src/main.ts`)
  - Initialize API router on layout ready
  - Register routes with Local REST API plugin
  - Cleanup routes on plugin unload
  - Exposed activePerformers for API access
- ✅ **Testing & Validation**
  - Created comprehensive API testing guide (`.github/docs/api-testing-phase-3-3.md`)
  - curl examples for all 7 endpoints
  - Error scenario documentation
  - Performance testing guidelines
  - Integration examples (Discord, GitHub, webhooks)

**Core API Endpoints to Implement** (Infrastructure-Only)
```
GET    /api/acts                    - Query acts with filtering/pagination
POST   /api/acts                    - Create new act
GET    /api/acts/:id                - Get specific act by ID
POST   /api/search                  - Cross-vault search
GET    /api/carnival/status         - Carnival health and status
GET    /api/territories             - List available territories
GET    /api/analytics               - Network analytics
POST   /api/webhooks/:webhookId     - Generic webhook endpoint (Phase 3.4)
```

**Note**: Service-specific endpoints (GitHub, Beehiiv, Discord) have been removed.
Integration plugins should implement these as companion plugins.
See `examples/integrations/README.md` for integration patterns.

**Methods Status Update**
- ✅ `queryActs()` - IMPLEMENTED in ActService (full filtering, pagination, sorting)
- ✅ `countActs()` - IMPLEMENTED in ActService (supports territory, type, status filters)
- ✅ `broadcastAct()` - IMPLEMENTED in ActService (network broadcast with acknowledgment)
- ✅ `getNetworkTopology()` - IMPLEMENTED as `getCarnivalTopology()` in CarnivalQueryService
- ✅ `getConnectedPerformersCount()` - IMPLEMENTED in CarnivalQueryService
- ✅ `getRecentActivity()` - IMPLEMENTED in CarnivalQueryService (configurable timeframe)
- ✅ `generateAnalyticsData()` - IMPLEMENTED as `generateAnalytics()` in CarnivalQueryService
- ✅ `performSearch()` - IMPLEMENTED as `performSearch()` in ActService (relevance-based)
- ✅ **Service-specific handlers REMOVED** (moved to `examples/integrations/`)
  - Discord handlers → `discord-integration-example.ts`
  - GitHub webhook → `webhook-integration-example.ts`
  - Beehiiv webhook → `webhook-integration-example.ts`
  - Webhook verification → `webhook-verification-example.ts`

**Type System Accomplishments** (2025-11-16)
- ✅ Eliminated 3 redundant interfaces (RecordsQueryData, ActCreateBody, NetworkStatusData)
- ✅ Created 1 new type module (api-response-types.ts)
- ✅ Relocated 5 interfaces to appropriate modules
- ✅ Renamed 2 major types (CarnivalRecord → CarnivalAct, RecordMetadata → ActMetadata)
- ✅ Renamed 4 methods for consistency
- ✅ Established design principles for API type organization
- ✅ Documented Territory summary vs full object pattern
- ✅ Validated explicit inline fields approach

**Infrastructure-Only Refactoring** (2025-01-17)
- ✅ **Nomenclature Hierarchy Clarified**
  - Carnival (everything) > Troupe (network collection) > Performer (individual client)
  - `CarnivalClient` → `CarnivalPerformer`
  - `CarnivalClientInterface` → `CarnivalPerformerInterface`
  - `ExternalClient` → `GuestPerformer`
  - Files: `carnival-network-client.ts` → `carnival-performer.ts`
  - Files: `carnival-network.ts` → `carnival-troupe-manager.ts`
- ✅ **Service-Specific Handlers Removed**
  - Deleted: `discord-handlers.ts`, `webhook-handlers.ts`, `webhook-verifier.ts`
  - Removed: GitHub and Beehiiv webhook types
  - Kept: Generic webhook infrastructure types
  - Created: Reference implementations in `examples/integrations/`
- ✅ **Configuration Simplified**
  - Removed `integrations.github` and `integrations.beehiiv`
  - Changed `APIKeyConfig.allowedTypes` to generic `string[]`
  - Changed `GuestPerformer.type` from union to `string`
- ✅ **Integration Guide Created**
  - `examples/integrations/README.md` with companion plugin patterns
  - Discord, GitHub, Beehiiv reference implementations
  - Webhook verification examples
  - Clear infrastructure vs application separation documented

**API Implementation Complete** (2025-01-18)
- ✅ **All 7 REST API Endpoints Implemented**
  - `GET /api/acts` - Query with filtering/pagination (multi-performer aggregation)
  - `POST /api/acts` - Create acts with territory-aware routing
  - `GET /api/acts/:id` - Get specific act (searches all performers)
  - `POST /api/search` - Full-text search with deduplication and relevance ranking
  - `GET /api/carnival/status` - Aggregated network health and topology
  - `GET /api/territories` - Combined territory counts
  - `GET /api/analytics` - Merged analytics from all performers
- ✅ **Multi-Performer Aggregation**
  - Smart aggregation strategies per endpoint type
  - Territory filtering across all performers
  - Deduplication by act ID in search results
  - Specialized merge functions for analytics metrics
  - Graceful degradation on performer failures
- ✅ **Territory-Aware Routing**
  - `getPerformerForTerritory()` routes to performer with established territory
  - Fallback to first available performer
  - Improves locality and distribution efficiency
- ✅ **Type Safety & Zero Technical Debt**
  - No `as any` casts anywhere
  - Concrete return types from `carnival-performer.ts`
  - Proper `LocalRestAPIRequest`/`LocalRestAPIResponse` types
  - Unused parameters handled with underscore prefix
- ✅ **Clean Architecture**
  - API files moved to dedicated `src/api/` directory
  - Clear separation: `src/network/` (internal) vs `src/api/` (external)
  - Created subdirectories for Phase 3.4: `handlers/`, `middleware/`, `validators/`
- ✅ **Comprehensive Documentation**
  - 800+ line testing guide (`.github/docs/api-testing-phase-3-3.md`)
  - curl examples for all endpoints
  - Error scenario documentation
  - Performance testing guidelines
  - Integration examples

**Leveraging Existing Infrastructure**
- ✅ Using `CorrelationTracker` for request tracing through API calls
- ✅ Using `globalMetrics` for API performance monitoring
- ✅ Using `globalProber` for endpoint health checks
- ✅ Using `globalHealthCheck` for API status endpoints
- ✅ Using enhanced `Log` system for detailed API logging
- ✅ Using `PersistentPerformerCache` for quick act access
- ✅ Observability framework integrated into CarnivalQueryService
- ✅ ActService has in-memory indexing (by territory, type, performer)

**Testing Requirements**
- ✅ Manual API endpoint testing (curl/Postman examples in testing guide)
- ✅ Response format validation (all endpoints tested)
- ✅ Type hierarchy compatibility (zero TypeScript errors)
- ✅ Error handling scenarios documented
- [ ] Automated unit tests for API Router (future work)
- [ ] Automated unit tests for ExternalAPIService handlers (future work)
- [ ] Integration test suite (future work)

**Phase 3.3 Completion Criteria** (✅ ALL MET)
- ✅ Type system complete and organized
- ✅ Nomenclature standardized across API layer
- ✅ Design principles documented
- ✅ Infrastructure-only refactoring complete
- ✅ Service handlers moved to examples
- ✅ Integration guide created
- ✅ API Router implemented and tested
- ✅ ExternalAPIService handlers complete (all 7 endpoints)
- ✅ Routes registered with Local REST API plugin
- ✅ All API endpoints tested manually
- ✅ Error handling comprehensive (ValidationError, NotFoundError, InternalServerError)
- ✅ Documentation complete (API testing guide with 800+ lines)
- ✅ Zero critical API issues
- ✅ Zero technical debt (no 'as any' casts)
- ✅ Multi-performer aggregation working
- ✅ Territory-aware routing implemented
- ✅ Clean directory structure (src/api/ separation)

---

### Phase 3 Complete Summary

**Duration**: Nov 2025 - Jan 2025  
**Total Accomplishments**: 3 major sub-phases complete

**What Was Built**:
1. **Type System & Service Architecture** (Phase 3.1)
   - Carnival-themed type hierarchy
   - Service interfaces and implementations
   - Comprehensive type organization

2. **Archive Abstraction Layer** (Phase 3.2)
   - ArchiveInterface for future database integration
   - InMemoryArchive, CacheArchive, MockArchive implementations
   - Fallback chain for resilient storage

3. **External API + Infrastructure-Only Architecture** (Phase 3.3)
   - 7 fully functional REST API endpoints
   - Multi-performer aggregation
   - Territory-aware routing
   - Service-specific handlers removed
   - Integration guide and reference implementations
   - Zero technical debt

**Key Metrics**:
- ✅ 100% of planned API endpoints implemented
- ✅ Zero TypeScript errors
- ✅ Zero 'as any' casts
- ✅ 800+ lines of testing documentation
- ✅ Infrastructure-only architecture achieved
- ✅ Comprehensive type safety

**Breaking Changes**:
- API files moved to `src/api/` directory
- Service-specific handlers removed (moved to examples)
- Type unions changed to generic strings for extensibility

---

### Phase 3.4: Generic Webhook Infrastructure (⏳ Next Priority)
**Timeline**: Q1 2025  
**Dependencies**: Phase 3.3 complete ✅  
**Scope**: Generic webhook system for plugin ecosystem

**Objectives**:
- [ ] Generic webhook registration API (`POST /api/webhooks/:webhookId`)
- [ ] Plugin event system for webhook handling
- [ ] Signature verification framework (plugin-provided)
- [ ] Webhook routing by ID
- [ ] Event emission to registered handlers
- [ ] Integration with companion plugins

**Design Goals**:
- Infrastructure provides routing and registration
- Plugins provide service-specific parsing and verification
- Event-driven architecture for scalability
- No service-specific logic in core

---

### Phase 3.5: Authentication & Authorization (⏳ Future)
**Timeline**: Q1-Q2 2025  
**Dependencies**: Phase 3.4 complete  
**Scope**: Secure API access and permission management

**Objectives**:
- [ ] API key management and validation
- [ ] Session token generation and lifecycle
- [ ] Permission-based access control
- [ ] Client type categorization (generic string-based)
- [ ] Rate limiting implementation
- [ ] JWT authentication support

---

### Phase 4: Persistent Database Integration (⏳ Post-API Phase)
**Timeline**: After API endpoints fully implemented  
**Dependencies**: Phase 3 complete ✅, archive abstraction layer ✅, operational API with analytics needs ✅  
**Selected Solution**: **RxDB** (reactive, offline-first NoSQL database)

[... existing Phase 4 content ...]

---

### Phase 5: Production Hardening (⏳ Final Phase)
**Timeline**: After database integration complete  
**Dependencies**: Phase 4 complete

[... existing Phase 5 content ...]

---

## Infrastructure & Support Systems

[... existing content ...]

---

## Development Guidelines

### Before Starting Phase 3.4 Implementation

1. **Review Phase 3.3 Accomplishments**: Understand existing API architecture
2. **Study Integration Guide**: Review `examples/integrations/README.md`
3. **Understand Webhook Patterns**: Reference implementations in examples
4. **Check Plugin Ecosystem**: Understand companion plugin architecture
5. **Review Event System**: Plan for plugin event emission

### Phase 3.4 Implementation Strategy

1. **Design Webhook Registration API**
   - Define webhook registration endpoints
   - Plan webhook ID routing scheme
   - Design event emission system
   
2. **Implement Plugin Event System**
   - Create event emitter for webhook events
   - Define event payload structure
   - Implement plugin registration for handlers
   
3. **Build Generic Verification Framework**
   - Abstract signature verification interface
   - Allow plugins to provide verification logic
   - Implement verification middleware
   
4. **Test with Reference Implementations**
   - Convert examples to real companion plugins
   - Test GitHub webhook integration
   - Test Discord webhook integration
   - Validate event emission and handling

[... existing content ...]

---

## Known Limitations & Future Considerations

### Current Limitations
- No persistent database (planned for Phase 4) - currently in-memory with persistence cache
- No automated testing suite (manual testing complete)
- No authentication/authorization (Phase 3.5 planned)
- No webhook system (Phase 3.4 in planning)
- No rate limiting (Phase 3.5 planned)
- Limited observability (minimal metrics system)
- No automated deployment pipeline

### Future Enhancements
[... existing content ...]

---

## Success Metrics

### Phase 3.3 (API Implementation) - ✅ COMPLETE
- ✅ Type system complete and validated
- ✅ Nomenclature standardized across codebase
- ✅ Design principles documented
- ✅ API Router implemented and tested
- ✅ All 7 endpoint handlers complete
- ✅ Routes registered with Local REST API plugin
- ✅ 100% of endpoint scenarios tested manually
- ✅ Comprehensive error handling (ValidationError, NotFoundError, InternalServerError)
- ✅ API testing guide complete (800+ lines)
- ✅ Zero technical debt (no 'as any' casts)
- ✅ Multi-performer aggregation working
- ✅ Infrastructure-only architecture achieved

### Phase 4 (Database Integration)
[... existing content ...]

### Phase 5 (Production Hardening)
[... existing content ...]

---

## Document History

**Version 1.5** - 2025-01-18 (Updated)
- Marked Phase 3.3 complete
- Added API implementation accomplishments
- Updated completion criteria
- Added Phase 3 summary section
- Updated next steps to Phase 3.4
- Revised current limitations
- Updated success metrics

**Version 1.4** - 2025-01-17 (Updated)
- Added infrastructure-only refactoring details
- Documented service handler removal
- Added integration guide references

**Version 1.3** - 2025-11-16 (Updated)
- Updated Phase 3.3 status with type system completion
- Documented type refinement accomplishments
- Added design principles and decisions
- Updated completion criteria and next steps
- Clarified implementation priorities

**Version 1.3** - 2025-11-15 (Updated)
- Updated Phase 3.2 with CacheArchive completion
- Documented observability system simplification
- Added minimal observability implementation details

**Version 1.2** - 2025-11-12 (Updated)
- Updated Phase 3 status with completed refactoring work
- Documented type system improvements and service implementations
- Added session documentation references from `.warp/` directory
- Updated stub method status (8 of 12 core methods implemented)
- Clarified remaining work for Phase 3.3
- Added observability framework status

**Version 1.1** - 2025-10-17 (Updated)
- Separated database integration into dedicated Phase 4
- Bumped production hardening to Phase 5
- Added database architecture, analytics, and migration details

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