# 📊 Carnival Network - Complete Observability Setup Guide

## Overview

The Carnival Network observability system provides production-ready monitoring with:
- ✅ **5 provider implementations** (Prometheus, Datadog, Sentry, Elasticsearch, Custom HTTP)
- ✅ **Automatic retry with exponential backoff**
- ✅ **Circuit breaker protection**
- ✅ **Dead letter queue for failed metrics**
- ✅ **Configuration validation and connection testing**
- ✅ **Graceful degradation on provider failures**

---

## Quick Start

### 1. Basic Configuration

```typescript
const observabilityConfig: ObservabilityConfig = {
  enabled: true,
  provider: 'prometheus',
  endpoint: 'http://localhost:9091',
  flushIntervalMs: 30000,      // Flush every 30 seconds
  batchSize: 100,               // Send 100 metrics at a time
  maxBufferSize: 10000,         // Buffer up to 10k metrics
  maxRetries: 3,                // Retry failed requests
  testConnectionOnInit: true    // Test connectivity on startup
};
```

### 2. Initialize Provider

```typescript
import { ObservabilityProviderFactory } from './observability/provider-factory';

// Create and initialize with validation and connection testing
const provider = await ObservabilityProviderFactory.createAndInitialize(
  observabilityConfig,
  {
    validateConfig: true,
    testConnection: true,
    throwOnValidationError: true
  }
);

// Or use graceful fallback (returns null on failure)
const provider = await ObservabilityProviderFactory.createWithFallback(
  observabilityConfig
);
```

### 3. Send Metrics

```typescript
const metrics: MetricDataPoint[] = [
  {
    name: 'carnival.requests.total',
    value: 1,
    type: 'counter',
    timestamp: new Date().toISOString(),
    tags: {
      endpoint: '/api/acts',
      status: 'success'
    }
  }
];

await provider.sendMetrics(metrics);
```

---

## Provider-Specific Setup

### Prometheus

**Use Case**: Time-series metrics and alerting

**Requirements**:
- Prometheus Pushgateway running
- Default port: 9091

**Configuration**:
```typescript
{
  enabled: true,
  provider: 'prometheus',
  endpoint: 'http://localhost:9091',
  flushIntervalMs: 10000  // Push every 10 seconds
}
```

**Setup Pushgateway**:
```bash
# Using Docker
docker run -d -p 9091:9091 prom/pushgateway

# Using Homebrew (macOS)
brew install pushgateway
pushgateway
```

**Verify**:
```bash
curl http://localhost:9091/metrics
```

**Prometheus Scrape Config**:
```yaml
scrape_configs:
  - job_name: 'pushgateway'
    honor_labels: true
    static_configs:
      - targets: ['localhost:9091']
```

---

### Datadog

**Use Case**: Cloud-native monitoring and APM

**Requirements**:
- Datadog account and API key
- API endpoint (default: `https://api.datadoghq.com`)

**Configuration**:
```typescript
{
  enabled: true,
  provider: 'datadog',
  endpoint: 'https://api.datadoghq.com',  // Use datadoghq.eu for EU
  apiKey: 'YOUR_DATADOG_API_KEY',
  flushIntervalMs: 60000  // Flush every minute
}
```

**Get API Key**:
1. Go to Datadog → Organization Settings → API Keys
2. Create new key or copy existing
3. Store securely (use environment variables)

**Verify**:
```bash
curl -X POST "https://api.datadoghq.com/api/v1/validate" \
  -H "DD-API-KEY: ${DD_API_KEY}"
```

**View Metrics**:
- Navigate to Metrics Explorer
- Search for `carnival.*` metrics
- Create dashboards and monitors

---

### Sentry

**Use Case**: Error tracking and performance monitoring

**Requirements**:
- Sentry project and DSN
- `@sentry/browser` or `@sentry/node` installed

**Installation**:
```bash
# For browser environments
npm install @sentry/browser

# For Node.js environments
npm install @sentry/node
```

**Configuration**:
```typescript
{
  enabled: true,
  provider: 'sentry',
  endpoint: 'https://YOUR_KEY@YOUR_ORG.ingest.sentry.io/PROJECT_ID',
  environment: 'production',
  sampleRate: 1.0  // Sample 100% of transactions
}
```

**Get DSN**:
1. Go to Sentry → Settings → Projects → [Your Project]
2. Copy DSN from Client Keys (DSN)
3. Use entire DSN URL as endpoint

**Verify**:
```typescript
// Sentry will capture test events
import * as Sentry from "@sentry/browser";
Sentry.captureMessage("Test message from Carnival Network");
```

**View Data**:
- Navigate to Performance
- Check custom measurements
- View breadcrumbs and tags

---

### Elasticsearch

**Use Case**: Log aggregation and time-series data storage

**Requirements**:
- Elasticsearch cluster (local or cloud)
- API key (for Elastic Cloud) or basic auth

**Configuration**:
```typescript
{
  enabled: true,
  provider: 'elasticsearch',
  endpoint: 'http://localhost:9200',  // Or Elastic Cloud URL
  apiKey: 'YOUR_ELASTIC_API_KEY',     // Optional for local
  indexPrefix: 'carnival-metrics',
  flushIntervalMs: 30000
}
```

**Setup Local Elasticsearch**:
```bash
# Using Docker
docker run -d \
  -p 9200:9200 \
  -e "discovery.type=single-node" \
  -e "xpack.security.enabled=false" \
  docker.elastic.co/elasticsearch/elasticsearch:8.11.0
```

**Setup Elastic Cloud**:
1. Create deployment at cloud.elastic.co
2. Get Cloud ID and create API key
3. Use deployment URL as endpoint

**Verify**:
```bash
curl http://localhost:9200/_cluster/health
```

**Query Metrics**:
```bash
# Get today's metrics
curl "http://localhost:9200/carnival-metrics-$(date +%Y-%m-%d)/_search?pretty"
```

**Kibana Visualization**:
- Create index pattern: `carnival-metrics-*`
- Build dashboards with metric visualizations
- Set up alerts based on metric thresholds

---

### Custom HTTP

**Use Case**: Send metrics to any HTTP endpoint

**Configuration**:
```typescript
{
  enabled: true,
  provider: 'custom',
  endpoint: 'https://your-api.com/metrics',
  method: 'POST',
  customHeaders: {
    'Authorization': 'Bearer YOUR_TOKEN',
    'X-Custom-Header': 'value'
  },
  flushIntervalMs: 60000
}
```

**Payload Format**:
```json
{
  "metrics": [
    {
      "name": "carnival.requests.total",
      "value": 42,
      "timestamp": "2025-01-15T10:30:00Z",
      "type": "counter",
      "tags": {
        "endpoint": "/api/acts"
      }
    }
  ],
  "timestamp": "2025-01-15T10:30:00Z",
  "source": "carnival-network"
}
```

**Example Receiver** (Express.js):
```javascript
app.post('/metrics', (req, res) => {
  const { metrics, timestamp, source } = req.body;
  
  // Store metrics in your database
  metrics.forEach(metric => {
    db.insert('metrics', {
      name: metric.name,
      value: metric.value,
      timestamp: metric.timestamp,
      tags: JSON.stringify(metric.tags)
    });
  });
  
  res.json({ success: true, received: metrics.length });
});
```

---

## Advanced Configuration

### Retry & Circuit Breaker

```typescript
{
  enabled: true,
  provider: 'prometheus',
  endpoint: 'http://localhost:9091',
  
  // Retry configuration
  maxRetries: 3,
  retryBaseDelayMs: 1000,        // Start with 1s delay
  retryMaxDelayMs: 30000,        // Max 30s delay
  retryBackoffMultiplier: 2,     // Exponential backoff
  
  // Circuit breaker
  circuitBreakerEnabled: true,
  circuitBreakerThreshold: 5,    // Open after 5 failures
  circuitBreakerTimeout: 60000,  // 1 minute timeout
  circuitBreakerResetTimeout: 30000  // Try again after 30s
}
```

### Connection Testing

```typescript
// Test before creating provider
const validation = ObservabilityProviderFactory.validateConfiguration(config);

if (!validation.valid) {
  console.error('Configuration errors:', validation.errors);
  console.warn('Configuration warnings:', validation.warnings);
}

// Test actual connectivity
const connectionTest = await ProviderConfigValidator.testConnection(config);

if (connectionTest.success) {
  console.log(`✅ Connected in ${connectionTest.latency}ms`);
} else {
  console.error(`❌ Connection failed: ${connectionTest.message}`);
}
```

### Dead Letter Queue Management

```typescript
// Check dead letter queue status
const dlqStats = provider.getDeadLetterStats?.();
console.log(`Dead letter queue: ${dlqStats?.metricsInQueue} metrics pending`);

// Process failed metrics
const result = await provider.processDeadLetterQueue?.();
console.log(`Processed: ${result?.processed}, Failed: ${result?.failed}`);

// Monitor provider health
const metrics = provider.getProviderMetrics?.();
console.log(`Success rate: ${metrics?.successRate}%`);
console.log(`Circuit state: ${metrics?.circuitState}`);
```

---

## Validation & Error Handling

### Configuration Validation

The system automatically validates:
- ✅ Required fields (endpoint, API keys)
- ✅ URL format and reachability
- ✅ Provider-specific requirements
- ✅ Value ranges (sample rates, intervals)

**Example Errors**:
```typescript
// Missing required field
ProviderConfigurationError: [datadog] API key is required for Datadog

// Invalid URL
ProviderConfigurationError: [prometheus] Invalid pushgateway endpoint URL

// Invalid Sentry DSN
ProviderConfigurationError: [sentry] Invalid Sentry DSN format
```

### Error Classification

The circuit breaker intelligently classifies errors:

**Trips Circuit** (provider failure):
- Network timeouts
- Connection refused
- 5xx server errors
- Authentication failures

**Doesn't Trip Circuit** (client error):
- Validation errors
- Rate limit errors
- Quota exceeded
- 4xx client errors

---

## Monitoring & Observability

### Provider Health Checks

```typescript
// Check if provider is healthy
const isHealthy = await provider.isHealthy();

// Get detailed health status
const health = {
  healthy: await provider.isHealthy(),
  circuitState: provider.getProviderMetrics?.()?.circuitState,
  deadLetterQueue: provider.getDeadLetterStats?.()
};
```

### Metrics Export

Each provider automatically tracks:
- **Succeeded**: Metrics successfully sent
- **Failed**: Metrics that failed to send
- **In Dead Letter**: Metrics queued for retry
- **Success Rate**: Percentage of successful sends
- **Circuit State**: Current circuit breaker state

```typescript
const metrics = provider.getProviderMetrics?.();

console.log(`
📊 Provider Metrics:
  ✅ Succeeded: ${metrics?.succeeded}
  ❌ Failed: ${metrics?.failed}
  📮 Dead Letter: ${metrics?.inDeadLetter}
  📈 Success Rate: ${metrics?.successRate}%
  🔌 Circuit: ${metrics?.circuitState}
`);
```

---

## Production Deployment

### Best Practices

1. **Use Environment Variables**
```typescript
const config: ObservabilityConfig = {
  enabled: process.env.OBSERVABILITY_ENABLED === 'true',
  provider: process.env.OBSERVABILITY_PROVIDER as any,
  endpoint: process.env.OBSERVABILITY_ENDPOINT,
  apiKey: process.env.OBSERVABILITY_API_KEY
};
```

2. **Test Connections on Startup**
```typescript
const provider = await ObservabilityProviderFactory.createAndInitialize(
  config,
  {
    validateConfig: true,
    testConnection: true,
    throwOnValidationError: false  // Don't fail startup on observability issues
  }
);
```

3. **Handle Provider Failures Gracefully**
```typescript
let provider: ObservabilityProvider | null = null;

try {
  provider = await ObservabilityProviderFactory.createAndInitialize(config);
} catch (error) {
  console.error('Failed to initialize observability, continuing without metrics:', error);
  // Application continues to work without observability
}

// Later in code
if (provider) {
  await provider.sendMetrics(metrics);
}
```

4. **Monitor Dead Letter Queue**
```typescript
// Periodically check and process dead letter queue
setInterval(async () => {
  const stats = provider?.getDeadLetterStats?.();
  
  if (stats && stats.metricsInQueue > 0) {
    console.warn(`⚠️ ${stats.metricsInQueue} metrics in dead letter queue`);
    await provider?.processDeadLetterQueue?.();
  }
}, 5 * 60 * 1000); // Every 5 minutes
```

5. **Reset Metrics Periodically**
```typescript
// Reset metrics daily to prevent overflow
setInterval(() => {
  provider?.resetMetrics?.();
}, 24 * 60 * 60 * 1000); // Every 24 hours
```

### Security

- Store API keys in environment variables or secrets management
- Use HTTPS endpoints in production
- Validate TLS certificates
- Implement rate limiting on custom endpoints
- Use API key rotation for long-running services

---

## Troubleshooting

### Connection Issues

**Problem**: `Cannot reach Prometheus: ECONNREFUSED`
- ✅ Verify Pushgateway is running: `curl http://localhost:9091/metrics`
- ✅ Check firewall rules
- ✅ Verify endpoint URL in configuration

**Problem**: `Datadog API returned 403`
- ✅ Verify API key is correct
- ✅ Check API key has proper permissions
- ✅ Verify endpoint matches your region (US/EU)

**Problem**: `Sentry SDK not found`
- ✅ Install Sentry SDK: `npm install @sentry/browser`
- ✅ Restart application after installation

### Performance Issues

**Problem**: High memory usage
- ✅ Reduce `maxBufferSize` in configuration
- ✅ Decrease `flushIntervalMs` to flush more frequently
- ✅ Process dead letter queue more often

**Problem**: Circuit breaker constantly open
- ✅ Check provider endpoint is reachable
- ✅ Increase `circuitBreakerThreshold`
- ✅ Verify API keys and credentials
- ✅ Check provider's rate limits

### Metric Issues

**Problem**: Metrics not appearing in provider
- ✅ Verify `enabled: true` in configuration
- ✅ Check provider initialization succeeded
- ✅ Confirm metrics are being sent: check logs
- ✅ Verify provider health: `await provider.isHealthy()`

**Problem**: Dead letter queue growing
- ✅ Check circuit breaker state
- ✅ Verify provider connectivity
- ✅ Manually process queue: `await provider.processDeadLetterQueue()`
- ✅ Check for validation errors in logs

---

## Migration Guide

### From Simple Logging

**Before**:
```typescript
console.log(`Request completed: ${duration}ms`);
```

**After**:
```typescript
await provider.sendMetrics([{
  name: 'carnival.request.duration',
  value: duration,
  type: 'histogram',
  timestamp: new Date().toISOString(),
  tags: { endpoint: '/api/acts' }
}]);
```

### Adding Multiple Providers

You can run multiple providers simultaneously:

```typescript
const providers = await Promise.all([
  ObservabilityProviderFactory.createWithFallback({
    enabled: true,
    provider: 'prometheus',
    endpoint: 'http://localhost:9091'
  }),
  ObservabilityProviderFactory.createWithFallback({
    enabled: true,
    provider: 'datadog',
    endpoint: 'https://api.datadoghq.com',
    apiKey: process.env.DD_API_KEY
  })
]);

// Send to all providers
for (const provider of providers.filter(p => p !== null)) {
  await provider.sendMetrics(metrics);
}
```

---

## Support & Resources

- **Provider Documentation**:
  - Prometheus: https://prometheus.io/docs/instrumenting/pushing/
  - Datadog: https://docs.datadoghq.com/api/latest/metrics/
  - Sentry: https://docs.sentry.io/platforms/
  - Elasticsearch: https://www.elastic.co/guide/en/elasticsearch/reference/current/

- **Carnival Network Docs**: See `.github/docs/` directory
- **Issue Tracker**: File issues with `[observability]` tag

---

**The show must go on — even the monitoring!** 🎭📊✨