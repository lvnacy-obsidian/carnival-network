# 🎭 Carnival Query Service - Concerns & Considerations Checklist

**Date**: 2025-11-11  
**Status**: In Progress

---

## High Priority Concerns

### ✅ 1. Missing Type Exports (COMPLETE)
- [x] Export analytics types from `src/types/public/index.ts`
- [x] Verify all new types are accessible

### ✅ 2. QueryService Integration with ActService (COMPLETE)
- [x] Inject `ActService` into constructor
- [x] Implement actual act querying
- [x] Support filtering and pagination
- [x] Establish proper type hierarchy (ActQueryParams → ActQueryOptions → ExtendedActQueryOptions)

### 🚧 3. Observability Provider Implementation
**Status**: Framework complete, providers pending

#### Supported Providers:
- [ ] **Prometheus** - POST to pushgateway
- [ ] **Datadog** - Use datadog-metrics library or HTTP API
- [ ] **Sentry** - Error tracking and performance monitoring
- [ ] **Elasticsearch** - Log aggregation and metrics storage
- [ ] **Custom** - Generic HTTP endpoint

#### Implementation Tasks:
- [ ] Create provider interface/abstract class
- [ ] Implement Prometheus formatter and exporter
- [ ] Implement Datadog integration
- [ ] Implement Sentry integration
- [ ] Implement Elasticsearch bulk API integration
- [ ] Implement custom HTTP endpoint handler
- [ ] Add provider-specific configuration validation
- [ ] Document provider setup and configuration
- [ ] Add provider-specific error handling

#### Provider-Specific Details:

**Prometheus**:
```typescript
- [ ] Format metrics in Prometheus text format
- [ ] Implement pushgateway POST endpoint
- [ ] Handle metric types (counter, gauge, histogram)
- [ ] Add job and instance labels
```

**Datadog**:
```typescript
- [ ] Use datadog-metrics library or HTTP API
- [ ] Implement metric batching
- [ ] Add proper tagging format
- [ ] Handle API key authentication
```

**Sentry**:
```typescript
- [ ] Initialize Sentry SDK
- [ ] Capture performance transactions
- [ ] Set up custom measurements
- [ ] Configure error boundaries for metric failures
```

**Elasticsearch**:
```typescript
- [ ] Format metrics for bulk API
- [ ] Implement index rotation strategy
- [ ] Add timestamp formatting
- [ ] Handle bulk API errors and retries
```

**Custom**:
```typescript
- [ ] Define generic JSON format
- [ ] Support custom headers (API keys, auth tokens)
- [ ] Allow configurable HTTP method (POST/PUT)
- [ ] Handle various response formats
```

---

## Medium Priority Concerns

### 🔧 4. Metric Retention and Cleanup
- [ ] Add max buffer size check (e.g., 10,000 metrics)
- [ ] Implement buffer overflow handling
- [ ] Drop oldest metrics when buffer is full
- [ ] Log when metrics are dropped
- [ ] Add metric for dropped metrics count
- [ ] Consider configurable buffer size

**Implementation**:
```typescript
private recordMetric(...) {
  const MAX_BUFFER_SIZE = this.observabilityConfig?.maxBufferSize ?? 10000;
  if (this.metricsBuffer.length >= MAX_BUFFER_SIZE) {
    const dropped = this.metricsBuffer.length - Math.floor(MAX_BUFFER_SIZE / 2);
    Log.warn(queryLogger, `Metric buffer full, dropping ${dropped} oldest metrics`);
    this.metricsBuffer = this.metricsBuffer.slice(-Math.floor(MAX_BUFFER_SIZE / 2));
  }
  // ... rest of code
}
```

### ⚡ 5. Performance Impact of Metric Recording
- [ ] Profile `recordMetric()` in hot paths
- [ ] Implement sampling for high-frequency metrics
- [ ] Add async metric recording option
- [ ] Implement metric aggregation before flush
- [ ] Add configuration for sample rates
- [ ] Document performance overhead

**Sampling Strategy**:
```typescript
- [ ] Add sample rate configuration per metric type
- [ ] Implement deterministic sampling (e.g., every Nth call)
- [ ] Implement probabilistic sampling (e.g., 10% chance)
- [ ] Document when to use sampling
```

### 🛡️ 6. Error Handling in Query Methods
**Current**: Errors return empty/null results with logging

- [ ] Review error handling strategy
- [ ] Document which errors should propagate vs. be caught
- [ ] Decide on critical vs. non-critical errors
- [ ] Add error classification system
- [ ] Consider retry logic for transient errors
- [ ] Update documentation on error handling approach

**Decision Points**:
```typescript
- [ ] Database connection errors - propagate or catch?
- [ ] Invalid query parameters - propagate or catch?
- [ ] Timeout errors - propagate or catch?
- [ ] Authorization errors - propagate or catch?
```

---

## Low Priority Concerns

### 📈 7. Analytics Calculation Efficiency
- [ ] Implement topology calculation caching (TTL: 1 minute)
- [ ] Add incremental activity tracking
- [ ] Pre-compute expensive aggregations
- [ ] Profile analytics methods for bottlenecks
- [ ] Add cache hit/miss metrics
- [ ] Document cache invalidation strategy

**Caching Strategy**:
```typescript
- [ ] Implement LRU cache for topology
- [ ] Add TTL-based expiration
- [ ] Invalidate cache on data changes
- [ ] Add cache configuration options
```

### 🔒 8. Type Safety in Analytics
**Issue**: Some analytics use estimated values

- [ ] Replace estimated percentages with actual counts from ActService
- [ ] Update `generateRecordAnalytics()` to use real data
- [ ] Add validation for analytics calculations
- [ ] Document any remaining estimations
- [ ] Add tests for analytics accuracy

**Current Code to Fix**:
```typescript
byType: {
  changelog: Math.ceil(performers.length * 0.6),  // ❌ Estimation
  conversation: Math.ceil(performers.length * 0.4) // ❌ Estimation
}

// Should be:
byType: {
  changelog: actService.countActs({ type: 'changelog' }),     // ✅ Actual
  conversation: actService.countActs({ type: 'conversation' }) // ✅ Actual
}
```

---

## Testing Checklist

### Unit Tests
- [ ] Interface implementation tests (queryTerritory, queryAllTerritories, getPerformerStatus)
- [ ] Observability framework tests (buffering, flushing, graceful failures)
- [ ] Analytics generation tests (topology, activity, performance)
- [ ] Metric recording tests (counter, gauge, histogram)
- [ ] Provider-specific formatter tests

### Integration Tests
- [ ] TerritoryAccessService integration
- [ ] ActService integration
- [ ] Error handling scenarios
- [ ] Invalid query type handling
- [ ] Provider integration tests (mock external services)

### Manual Testing
- [ ] Create query service with observability enabled
- [ ] Create query service with observability disabled
- [ ] Query existing territory
- [ ] Query non-existent territory
- [ ] Query all territories
- [ ] Get performer status (existing)
- [ ] Get performer status (non-existent)
- [ ] Generate full analytics
- [ ] Generate partial analytics
- [ ] Verify metrics are buffered
- [ ] Verify metrics flush periodically
- [ ] Test cleanup method
- [ ] Test each provider implementation

---

## Documentation Tasks

- [ ] Document all public methods
- [ ] Provide usage examples for each provider
- [ ] Explain observability configuration
- [ ] Update `.github/docs/territory-services-architecture.md`
- [ ] Document observability framework architecture
- [ ] Explain provider architecture and extension
- [ ] Create provider setup guides (per provider)
- [ ] Document metric naming conventions
- [ ] Add troubleshooting section
- [ ] Update CHANGELOG.md

---

## Summary Statistics

**Total Items**: 64  
**Completed**: 2 (3%)  
**In Progress**: 1 (2%)  
**Pending**: 61 (95%)

**By Priority**:
- High: 2 complete, 1 in progress (33% of high priority)
- Medium: 0 complete, 3 pending
- Low: 0 complete, 2 pending

---

**Next Action**: Start with High Priority #3 - Observability Provider Implementation

**The show must go on!** 🎭✨