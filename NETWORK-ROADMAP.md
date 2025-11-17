# Carnival Records - Network Development Roadmap

**Last Updated**: 2025-11-16  
**Status**: Phase 3.3/5 In Progress (External API Type System Complete)  
**Next Priority**: Phase 3.3 Implementation (API Router + Service Handlers)

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

### Phase 3: Advanced API & External Integration (🔄 In Progress)
**Timeline**: Current development cycle (Nov 2025)  
**Dependencies**: Phase 2 complete ✅, functional network data available ✅  
**Recent Work**: Type system complete ✅, API implementation in progress ⏳

#### 3.1 Type System & Service Architecture (✅ Complete - Nov 2025)
**Scope**: Establish proper type hierarchies and service interfaces

[... existing Phase 3.1 content ...]

#### 3.2 Archive Abstraction Layer (✅ Complete - Nov 2025)
**Scope**: Prepare architecture for Phase 4 database integration with carnival-themed storage abstraction

[... existing Phase 3.2 content ...]

---

#### 3.3 External API Service Implementation (⏳ In Progress - Nov 2025)
**Scope**: Create RESTful API endpoints for external clients

**Current Status** (as of 2025-11-16):
- ✅ Type system complete and validated
- ✅ Nomenclature standardized (Acts, Carnival, Performers)
- ✅ Response wrapper patterns established
- ✅ Request/response types organized
- ⏳ API Router implementation pending
- ⏳ Service handler implementation in progress
- ⏳ Route registration pending
- ⏳ Authentication & authorization (Phase 3.3.2) planned

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

**Implementation Deliverables** (⏳ Pending)
- [ ] **API Router** (`src/network/api-router.ts`)
  - Route registration with Local REST API plugin
  - HTTP method mapping (GET, POST, PUT, DELETE)
  - Error response formatting
  - Request validation middleware
- [ ] **External API Service** (`src/network/external-api-service.ts`)
  - Complete all endpoint handlers
  - Integrate with ActService and CarnivalQueryService
  - Request validation and sanitization
  - Comprehensive error handling
- [ ] **Plugin Integration** (Update `src/main.ts`)
  - Initialize API router on plugin load
  - Register routes with Local REST API plugin
  - Cleanup routes on plugin unload
  - Service dependency injection
- [ ] **Testing & Validation**
  - Create API testing guide (`.github/docs/api-testing-phase-3-3.md`)
  - Manual endpoint testing with curl/Postman
  - Validate request/response formats
  - Test error scenarios
  - Verify type safety end-to-end

**Core API Endpoints to Implement**
```
GET    /api/acts                 - Query acts with filtering/pagination
POST   /api/acts                 - Create new act
GET    /api/acts/:id             - Get specific act by ID
POST   /api/search               - Cross-vault search
GET    /api/carnival/status      - Carnival health and status
GET    /api/territories          - List available territories
GET    /api/analytics            - Network analytics
POST   /api/webhooks/github      - GitHub event processing (Phase 3.3.2)
POST   /api/webhooks/newsletter  - Newsletter event processing (Phase 3.3.2)
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
- [ ] `verifyGitHubSignature()` - NOT YET IMPLEMENTED (Phase 3.3.2)
- [ ] `verifyNewsletterSignature()` - NOT YET IMPLEMENTED (Phase 3.3.2)
- [ ] `handleGitHubWebhook()` - PARTIAL (Phase 3.3.2)
- [ ] `handleNewsletterWebhook()` - PARTIAL (Phase 3.3.2)

**Type System Accomplishments** (2025-11-16)
- ✅ Eliminated 3 redundant interfaces (RecordsQueryData, ActCreateBody, NetworkStatusData)
- ✅ Created 1 new type module (api-response-types.ts)
- ✅ Relocated 5 interfaces to appropriate modules
- ✅ Renamed 2 major types (CarnivalRecord → CarnivalAct, RecordMetadata → ActMetadata)
- ✅ Renamed 4 methods for consistency
- ✅ Established design principles for API type organization
- ✅ Documented Territory summary vs full object pattern
- ✅ Validated explicit inline fields approach

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
- [ ] Unit tests for API Router route registration
- [ ] Unit tests for ExternalAPIService handlers
- [ ] Integration tests with ActService and CarnivalQueryService
- [ ] Type hierarchy compatibility tests
- [ ] Request validation tests
- [ ] Error handling and edge case coverage
- [ ] Manual API endpoint testing (curl/Postman)
- [ ] Response format validation

**Phase 3.3 Completion Criteria**
- ✅ Type system complete and organized
- ✅ Nomenclature standardized across API layer
- ✅ Design principles documented
- [ ] API Router implemented and tested
- [ ] ExternalAPIService handlers complete
- [ ] Routes registered with Local REST API plugin
- [ ] All API endpoints tested manually
- [ ] Error handling comprehensive
- [ ] Documentation complete (API testing guide)
- [ ] Zero critical API issues

**Next Steps (Immediate)**
1. **Implement API Router** (`src/network/api-router.ts`)
   - Route registration pattern
   - HTTP method mapping
   - Error response formatting
   - Integration with Local REST API plugin

2. **Complete ExternalAPIService Handlers**
   - Implement all endpoint handlers
   - Add comprehensive validation
   - Integrate with service layer
   - Handle all error cases

3. **Plugin Integration**
   - Update `src/main.ts` with API router initialization
   - Register routes on plugin load
   - Cleanup routes on plugin unload
   - Add service dependency injection

4. **Testing & Documentation**
   - Create comprehensive API testing guide
   - Manual testing with curl/Postman
   - Validate all request/response formats
   - Document error scenarios

**Authentication & Authorization (Phase 3.3.2)** - Planned for next sub-phase
- [ ] API key management and validation
- [ ] Session token generation and lifecycle
- [ ] Permission-based access control
- [ ] Client type categorization
- [ ] Rate limiting implementation
- [ ] Webhook signature verification
- [ ] GitHub webhook signature verification
- [ ] Newsletter webhook signature verification

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

### Before Starting Phase 3.3 Implementation

1. **Review Type System**: Familiarize yourself with new API response types
2. **Check Design Decisions**: Review design principles for type organization
3. **Understand Nomenclature**: All "Records" are now "Acts", all "Network" is "Carnival"
4. **Review Existing Services**: ActService and CarnivalQueryService provide all business logic
5. **Check Local REST API Plugin**: Ensure understanding of route registration pattern

### Phase 3.3 Implementation Strategy

1. **Start with API Router**
   - Define route registration patterns
   - Implement error response formatting
   - Add request validation middleware
   
2. **Complete Service Handlers**
   - Implement all endpoint handlers in ExternalAPIService
   - Add comprehensive validation
   - Integrate with ActService and CarnivalQueryService
   
3. **Test Incrementally**
   - Test each endpoint as implemented
   - Validate request/response formats
   - Test error scenarios
   
4. **Document as You Go**
   - Update API testing guide
   - Add example requests/responses
   - Document error codes and messages

[... existing content ...]

---

## Known Limitations & Future Considerations

### Current Limitations
- External REST API implementation in progress (types complete, implementation pending)
- No persistent database (planned for Phase 4) - currently in-memory with persistence cache
- No authentication beyond basic API keys (Phase 3.3.2 planned)
- No webhook signature verification (Phase 3.3.2 planned)
- No rate limiting (Phase 3.3.2 planned)
- Limited observability (minimal system implemented)

### Future Enhancements
[... existing content ...]

---

## Success Metrics

### Phase 3.3 (API Implementation)
- ✅ Type system complete and validated
- ✅ Nomenclature standardized across codebase
- ✅ Design principles documented
- [ ] API Router implemented and tested
- [ ] All endpoint handlers complete
- [ ] Routes registered with Local REST API plugin
- [ ] 100% of endpoint scenarios tested
- [ ] Zero unhandled exceptions in production logs
- [ ] API response times < 500ms (p95)
- [ ] Comprehensive error handling
- [ ] API testing guide complete

### Phase 4 (Database Integration)
[... existing content ...]

### Phase 5 (Production Hardening)
[... existing content ...]

---

## Document History

**Version 1.4** - 2025-11-16 (Updated)
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