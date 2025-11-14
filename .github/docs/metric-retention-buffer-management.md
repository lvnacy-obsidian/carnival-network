# 📦 Metric Retention & Buffer Management Guide

## Overview

The Carnival Network observability system includes sophisticated buffer management to ensure metrics are reliably collected without consuming excessive memory or dropping important data.

---

## Buffer Architecture

### Components

```
┌─────────────────────────────────────────────────────────┐
│                  Application Layer                       │
│              (Calls recordMetric())                      │
└────────────────────────┬────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│              MetricBufferManager                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │ Buffer (Array of BufferedMetric)                │   │
│  │ - metric: MetricDataPoint                       │   │
│  │ - addedAt: timestamp                            │   │
│  │ - flushAttempts: number                         │   │
│  └─────────────────────────────────────────────────┘   │
│                                                          │
│  ┌─────────────────────────────────────────────────┐   │
│  │ Statistics                                       │   │
│  │ - totalAdded, totalDropped, totalFlushed        │   │
│  │ - droppedByAge, droppedByOverflow               │   │
│  └─────────────────────────────────────────────────┘   │
│                                                          │
│  ┌─────────────────────────────────────────────────┐   │
│  │ Policies                                         │   │
│  │ - maxSize: 10,000 metrics                       │   │
│  │ - maxAge: 5 minutes                             │   │
│  │ - overflowStrategy: drop-oldest                 │   │
│  │ - warningThreshold: 80%                         │   │
│  └─────────────────────────────────────────────────┘   │
└────────────────────────┬────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│           ObservabilityProvider                          │
│     (Flushes metrics to external system)                │
└─────────────────────────────────────────────────────────┘
```

---

## Configuration

### Buffer Configuration Options

```typescript
interface BufferConfig {
  // Maximum number of metrics to buffer
  maxSize: number;                    // Default: 10,000
  
  // Maximum age of metrics before they expire
  maxAgeMs: number;                   // Default: 5 minutes (300,000ms)
  
  // Strategy for handling overflow
  overflowStrategy: 'drop-oldest' | 'drop-newest' | 'drop-random';
  
  // Enable internal metrics about buffer performance
  enableMetrics: boolean;             // Default: true
  
  // Trigger warnings when buffer reaches this % of maxSize
  warningThreshold: number;           // Default: 80 (%)
}
```

### Example Configuration

```typescript
const config: ObservabilityConfig = {
  enabled: true,
  provider: 'prometheus',
  endpoint: 'http://localhost:9091',
  
  // Buffer settings
  maxBufferSize: 10000,              // Max 10k metrics
  flushIntervalMs: 30000,            // Flush every 30 seconds
  batchSize: 100,                    // Send 100 at a time
  
  // Retention settings
  maxRetries: 3,                     // Retry failed flushes
  retryBaseDelayMs: 1000,           // Start with 1s delay
  retryMaxDelayMs: 30000            // Max 30s delay
};
```

---

## Overflow Strategies

### 1. Drop Oldest (Recommended)

**When to use**: Default strategy. Good for time-series data where recent metrics are more valuable.

**Behavior**:
- When buffer is full, removes oldest 10% of metrics
- Preserves recent metrics
- Maintains temporal ordering

**Example**:
```typescript
{
  overflowStrategy: 'drop-oldest'  // Default
}
```

### 2. Drop Newest

**When to use**: Historical analysis where older metrics are critical.

**Behavior**:
- When buffer is full, removes newest 10% of metrics
- Preserves historical data
- May lose recent spikes/events

**Example**:
```typescript
{
  overflowStrategy: 'drop-newest'
}
```

### 3. Drop Random

**When to use**: When no temporal bias is acceptable and you want fair sampling.

**Behavior**:
- When buffer is full, removes random 10% of metrics
- Provides unbiased sampling
- Less predictable

**Example**:
```typescript
{
  overflowStrategy: 'drop-random'
}
```

---

## Metric Lifecycle

### 1. Addition

```typescript
// Add single metric
service.recordMetric({
  name: 'carnival.requests.total',
  value: 1,
  type: 'counter',
  timestamp: new Date().toISOString()
});

// Add multiple metrics
service.recordMetrics([
  { name: 'metric1', value: 1, type: 'counter', timestamp: now },
  { name: 'metric2', value: 2, type: 'gauge', timestamp: now }
]);
```

**What happens**:
1. ✅ Check if buffer has space
2. ✅ If full, apply overflow strategy
3. ✅ Add metric with metadata (timestamp, retry count)
4. ✅ Check warning threshold
5. ✅ Log warnings if threshold exceeded

### 2. Expiration

**Automatic Cleanup**:
- Runs every 30 seconds
- Removes metrics older than `maxAgeMs`
- Updates statistics

**Manual Cleanup**:
```typescript
// Get buffer stats
const stats = service.getBufferStats();
console.log(`Metrics to expire: ${stats.droppedByAge}`);
```

### 3. Flushing

**Automatic Flushing**:
```typescript
// Happens every flushIntervalMs
// 1. Get batch (up to batchSize)
// 2. Send to provider
// 3. Mark as flushed on success
// 4. Mark as failed on error (will retry)
```

**Manual Flushing**:
```typescript
// Force flush immediately
const result = await service.flushMetrics();
console.log(`Flushed: ${result.flushed}, Failed: ${result.failed}`);
```

### 4. Retry on Failure

**Behavior**:
- Failed flushes increment `flushAttempts` counter
- Metrics stay in buffer for retry
- After 3 failed attempts (default), metrics are dropped
- Exponential backoff between retries

**Configuration**:
```typescript
{
  maxRetries: 3,                // Drop after 3 failures
  retryBaseDelayMs: 1000,      // 1s, 2s, 4s, 8s...
  retryMaxDelayMs: 30000       // Max 30s between retries
}
```

---

## Monitoring Buffer Health

### Get Buffer Statistics

```typescript
const stats = service.getBufferStats();

console.log(`
Buffer Statistics:
  Current Size: ${stats.currentSize}/${stats.maxSize}
  Utilization: ${stats.utilizationPercent.toFixed(1)}%
  
  Total Added: ${stats.totalAdded}
  Total Flushed: ${stats.totalFlushed}
  Total Dropped: ${stats.totalDropped}
  
  Dropped by Age: ${stats.droppedByAge}
  Dropped by Overflow: ${stats.droppedByOverflow}
  
  Oldest Metric: ${stats.oldestMetricAge}ms ago
  Newest Metric: ${stats.newestMetricAge}ms ago
`);
```

### Observability Dashboard

```typescript
import { ObservabilityDashboardBuilder } from './observability/dashboard';

// Build dashboard
const dashboard = ObservabilityDashboardBuilder.buildDashboard({
  bufferStats: service.getBufferStats(),
  providerName: 'prometheus',
  providerMetrics: provider.getProviderMetrics(),
  isProviderHealthy: await provider.isHealthy()
});

// Display in console
console.log(ObservabilityDashboardBuilder.formatForConsole(dashboard));

// Or get JSON
const json = ObservabilityDashboardBuilder.formatForJSON(dashboard);
```

### Health Checks

```typescript
// Check overall health
if (dashboard.health.status === 'healthy') {
  console.log('✅ All systems operational');
} else if (dashboard.health.status === 'degraded') {
  console.warn(`⚠️ System degraded: ${dashboard.health.message}`);
} else {
  console.error(`❌ System down: ${dashboard.health.message}`);
}

// Check specific components
const bufferHealth = dashboard.buffer.healthStatus;
if (bufferHealth === 'critical') {
  console.error(`🚨 Buffer critical: ${dashboard.buffer.recommendation}`);
}
```

---

## Common Scenarios

### Scenario 1: High Throughput Application

**Problem**: Generating 1000+ metrics per second

**Solution**:
```typescript
{
  maxBufferSize: 50000,         // Larger buffer
  flushIntervalMs: 10000,       // Flush more frequently (10s)
  batchSize: 500,               // Larger batches
  overflowStrategy: 'drop-oldest'
}
```

### Scenario 2: Intermittent Connectivity

**Problem**: Provider endpoint frequently unavailable

**Solution**:
```typescript
{
  maxBufferSize: 20000,         // Buffer more metrics
  flushIntervalMs: 60000,       // Less frequent flushes
  maxRetries: 5,                // More retries
  retryMaxDelayMs: 120000,      // Longer backoff (2 min)
  circuitBreakerEnabled: true   // Enable circuit breaker
}
```

### Scenario 3: Memory Constrained Environment

**Problem**: Limited memory available

**Solution**:
```typescript
{
  maxBufferSize: 1000,          // Smaller buffer
  flushIntervalMs: 5000,        // Flush frequently
  batchSize: 50,                // Smaller batches
  maxAgeMs: 60000,              // Shorter retention (1 min)
  overflowStrategy: 'drop-oldest'
}
```

### Scenario 4: Critical Metrics Only

**Problem**: Only want to keep critical metrics, discard the rest

**Solution**:
```typescript
// Use selective recording
function recordIfImportant(metric: MetricDataPoint) {
  const criticalMetrics = [
    'carnival.errors',
    'carnival.requests.failed',
    'carnival.circuit_breaker.open'
  ];
  
  if (criticalMetrics.includes(metric.name)) {
    service.recordMetric(metric);
  }
  // Others are silently discarded
}
```

---

## Troubleshooting

### Problem: Metrics Being Dropped

**Symptoms**:
```
⚠️ Dropped 150 metrics: Buffer full, overflow strategy failed
```

**Diagnosis**:
```typescript
const stats = service.getBufferStats();
console.log(`
Utilization: ${stats.utilizationPercent}%
Drop Rate: ${(stats.totalDropped / stats.totalAdded * 100).toFixed(1)}%
`);
```

**Solutions**:
1. **Increase buffer size**:
   ```typescript
   { maxBufferSize: 20000 }  // Was 10000
   ```

2. **Flush more frequently**:
   ```typescript
   { flushIntervalMs: 15000 }  // Was 30000
   ```

3. **Check provider connectivity**:
   ```typescript
   const healthy = await provider.isHealthy();
   const circuitState = provider.getProviderMetrics()?.circuitState;
   ```

### Problem: High Memory Usage

**Symptoms**: Application memory growing over time

**Diagnosis**:
```typescript
const stats = service.getBufferStats();
console.log(`Buffer size: ${stats.currentSize}`);
console.log(`Oldest metric: ${stats.oldestMetricAge}ms`);
```

**Solutions**:
1. **Reduce buffer size**:
   ```typescript
   { maxBufferSize: 5000 }  // Was 10000
   ```

2. **Reduce max age**:
   ```typescript
   { maxAgeMs: 120000 }  // 2 minutes (was 5)
   ```

3. **Force flush**:
   ```typescript
   // Manual flush to empty buffer
   await service.flushMetrics();
   ```

### Problem: Metrics Not Appearing in Provider

**Symptoms**: Metrics recorded but not showing up in Prometheus/Datadog/etc.

**Diagnosis**:
```typescript
const result = await service.flushMetrics();
console.log(`
Flushed: ${result.flushed}
Failed: ${result.failed}
Dropped: ${result.dropped}
`);

const providerMetrics = provider.getProviderMetrics();
console.log(`Success rate: ${providerMetrics.successRate}%`);
```

**Solutions**:
1. **Check provider health**:
   ```typescript
   const healthy = await provider.isHealthy();
   if (!healthy) {
     // Provider is down or misconfigured
   }
   ```

2. **Check circuit breaker**:
   ```typescript
   if (providerMetrics.circuitState === 'OPEN') {
     // Provider is failing, circuit is open
     // Wait for reset timeout
   }
   ```

3. **Process dead letter queue**:
   ```typescript
   const dlqResult = await provider.processDeadLetterQueue();
   console.log(`Recovered ${dlqResult.processed} metrics`);
   ```

### Problem: Oldest Metrics Getting Stale

**Symptoms**:
```
⚠️ Oldest metric is 8 minutes old
```

**Diagnosis**:
```typescript
const stats = service.getBufferStats();
if (stats.oldestMetricAge > 5 * 60 * 1000) {
  // Metrics older than 5 minutes
  console.log('Metrics not being flushed!');
}
```

**Solutions**:
1. **Force flush**:
   ```typescript
   await service.flushMetrics();
   ```

2. **Check flush interval**:
   ```typescript
   // Ensure automatic flushing is enabled
   // and interval is reasonable
   ```

3. **Check for flush errors**:
   ```typescript
   // Look for flush failure logs
   const providerMetrics = provider.getProviderMetrics();
   if (providerMetrics.failed > 0) {
     // Flushes are failing
   }
   ```

---

## Best Practices

### 1. Size Your Buffer Appropriately

**Rule of Thumb**:
```
bufferSize = metricsPerSecond × flushIntervalSeconds × safetyFactor
```

**Example**:
- 100 metrics/second
- 30 second flush interval
- 2x safety factor
- Buffer size: 100 × 30 × 2 = **6,000 metrics**

### 2. Monitor Drop Rate

```typescript
// Alert if drop rate exceeds 1%
const stats = service.getBufferStats();
const dropRate = stats.totalAdded > 0 
  ? (stats.totalDropped / stats.totalAdded) * 100 
  : 0;

if (dropRate > 1) {
  console.warn(`⚠️ Drop rate: ${dropRate.toFixed(2)}%`);
  // Investigate provider health and buffer size
}
```

### 3. Use Dashboard for Visibility

```typescript
// Periodically log dashboard
setInterval(() => {
  const dashboard = ObservabilityDashboardBuilder.buildDashboard({
    bufferStats: service.getBufferStats(),
    // ... other data
  });
  
  if (dashboard.alerts.length > 0) {
    console.log(ObservabilityDashboardBuilder.formatForConsole(dashboard));
  }
}, 60000); // Every minute
```

### 4. Handle Cleanup Gracefully

```typescript
// On shutdown
process.on('SIGTERM', async () => {
  console.log('Flushing remaining metrics...');
  
  // Flush buffer
  await service.flushMetrics();
  
  // Process dead letter queue
  await provider.processDeadLetterQueue();
  
  // Cleanup
  await service.cleanup();
  
  process.exit(0);
});
```

### 5. Test Your Configuration

```typescript
// Simulate load to test configuration
async function testBuffer() {
  const startTime = Date.now();
  const metricsToGenerate = 10000;
  
  // Generate metrics rapidly
  for (let i = 0; i < metricsToGenerate; i++) {
    service.recordMetric({
      name: 'test.metric',
      value: Math.random(),
      type: 'gauge',
      timestamp: new Date().toISOString()
    });
  }
  
  // Check results
  const stats = service.getBufferStats();
  const duration = Date.now() - startTime;
  
  console.log(`
Load Test Results:
  Duration: ${duration}ms
  Generated: ${metricsToGenerate}
  Buffered: ${stats.currentSize}
  Dropped: ${stats.totalDropped}
  Drop Rate: ${(stats.totalDropped / metricsToGenerate * 100).toFixed(2)}%
  `);
}
```

---

## API Reference

### MetricBufferManager

```typescript
class MetricBufferManager {
  constructor(config: Partial<BufferConfig>);
  
  // Add metrics
  add(metrics: MetricDataPoint[]): { added: number; dropped: number; reason?: string };
  
  // Get metrics for flushing
  getFlushBatch(batchSize: number): MetricDataPoint[];
  
  // Mark metrics as flushed/failed
  markFlushed(count: number): void;
  markFlushFailed(count: number, maxRetries?: number): number;
  
  // Statistics
  getStats(): BufferStats;
  resetStats(): void;
  
  // Inspection
  inspect(filter?: FilterOptions): MetricDataPoint[];
  
  // Management
  clear(): number;
  updateConfig(config: Partial<BufferConfig>): void;
  cleanup(): void;
  
  // Persistence
  exportState(): BufferState;
  importState(state: BufferState): void;
}
```

### ObservabilityDashboardBuilder

```typescript
class ObservabilityDashboardBuilder {
  static buildDashboard(data: DashboardData): ObservabilityDashboard;
  static formatForConsole(dashboard: ObservabilityDashboard): string;
  static formatForJSON(dashboard: ObservabilityDashboard): string;
}
```

---

**The metrics never stop flowing!** 📊🎭✨