# 🎭 Observability System - Manual Testing Guide

## Overview

The Carnival Network plugin implements a minimal, single-file-friendly observability system with:
- **Metrics Endpoint**: Prometheus-style text exposition via Local REST API
- **Webhook Provider**: HMAC-SHA256 signed push notifications
- **In-Memory Metrics Registry**: Real-time performance tracking

This guide walks through manual testing of each component.

## Prerequisites

1. **Obsidian installed** with Carnival Network plugin
2. **Local REST API plugin** installed and running (required for metrics endpoint)
3. **Terminal access** for running test receivers
4. **curl or Postman** for testing webhook signatures

---

## Part 1: Metrics Endpoint Testing

### 1.1 Verify Metrics Endpoint Registration

The metrics endpoint should be registered with the Local REST API on plugin load.

**Steps:**
```bash
# 1. Check the plugin settings for observability configuration
# - Open Obsidian → Settings → Carnival Network
# - Verify "Observability Enabled" toggle is ON
# - Note: If metrics aren't showing, ensure Local REST API plugin is active

# 2. Query the metrics endpoint
curl http://localhost:27124/metrics
```

**Expected Output:**
```
# TYPE carnival_network_registry_endpoints_total counter
carnival_network_registry_endpoints_total 5

# TYPE carnival_network_acts_created_total counter
carnival_network_acts_created_total 3

# TYPE carnival_network_territories_active gauge
carnival_network_territories_active 2

# ... additional metrics follow Prometheus text format
```

### 1.2 Verify Prometheus Compatibility

If you have Prometheus installed:

**Add scrape configuration to `prometheus.yml`:**
```yaml
scrape_configs:
  - job_name: 'carnival-network'
    static_configs:
      - targets: ['localhost:27124']
    metrics_path: '/metrics'
    scrape_interval: 15s
```

**Reload Prometheus and check:**
```bash
# Visit http://localhost:9090
# Search for metric names: carnival_network_*
# You should see metrics appearing in real-time
```

### 1.3 Test Metrics Recording

Metrics are recorded as the plugin operates. Trigger events and watch the endpoint:

**Terminal 1: Watch metrics**
```bash
watch -n 1 'curl -s http://localhost:27124/metrics | grep carnival_network'
```

**Terminal 2: Trigger activity**
```bash
# In Obsidian:
# 1. Create a new Act (via ActService)
# 2. Query an Act
# 3. Update registry endpoints
# 4. Trigger sync events

# Metrics in Terminal 1 should update in real-time
```

---

## Part 2: Webhook Provider Testing

### 2.1 Set Up Test Receiver

Create a simple Node.js webhook receiver that validates HMAC signatures:

**File: `test-webhook-receiver.js`**
```javascript
const http = require('http');
const crypto = require('crypto');

const WEBHOOK_SECRET = 'your-webhook-secret'; // Must match plugin settings
const PORT = 3000;

function verifySignature(payload, signature) {
  const hash = crypto
    .createHmac('sha256', WEBHOOK_SECRET)
    .update(payload)
    .digest('hex');
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(hash)
  );
}

const server = http.createServer((req, res) => {
  if (req.method !== 'POST') {
    res.writeHead(405);
    res.end('Method not allowed');
    return;
  }

  // Get signature from header
  const signature = req.headers['x-carnival-signature'];
  if (!signature) {
    res.writeHead(400);
    res.end('Missing X-Carnival-Signature header');
    return;
  }

  // Collect body
  let body = '';
  req.on('data', chunk => {
    body += chunk;
  });

  req.on('end', () => {
    try {
      // Verify signature
      if (!verifySignature(body, signature)) {
        res.writeHead(401);
        res.end('Invalid signature');
        console.error('❌ Invalid HMAC signature');
        return;
      }

      const payload = JSON.parse(body);
      console.log('✅ Valid webhook received:');
      console.log(JSON.stringify(payload, null, 2));

      res.writeHead(200);
      res.end('OK');
    } catch (err) {
      console.error('❌ Error processing webhook:', err);
      res.writeHead(400);
      res.end('Invalid JSON');
    }
  });
});

server.listen(PORT, () => {
  console.log(`🎭 Webhook receiver listening on http://localhost:${PORT}`);
  console.log(`Using webhook secret: ${WEBHOOK_SECRET}`);
});
```

**Run receiver:**
```bash
node test-webhook-receiver.js
```

### 2.2 Configure Plugin Webhook Provider

**In Obsidian Settings:**
1. Settings → Carnival Network → Observability
2. Enable Observability
3. Provider: `webhook`
4. Webhook Endpoint: `http://localhost:3000`
5. Webhook Secret: `your-webhook-secret` (must match receiver)
6. Save settings

### 2.3 Trigger Webhook Events

Webhooks are sent when metrics are recorded. Trigger events in Obsidian:

```bash
# Terminal 1: Watch receiver logs
node test-webhook-receiver.js

# Terminal 2: Trigger plugin activity
# In Obsidian:
# 1. Click "Test Network Connection" in Carnival Network settings
# 2. Query an act or create new acts
# 3. Observe webhook events in Terminal 1
```

**Expected receiver output:**
```
🎭 Webhook receiver listening on http://localhost:3000
Using webhook secret: your-webhook-secret
✅ Valid webhook received:
{
  "timestamp": "2025-11-15T10:30:45.123Z",
  "metrics": [
    {
      "name": "carnival_network_registry_endpoints_total",
      "value": 5,
      "type": "counter"
    },
    ...
  ]
}
```

### 2.4 Test HMAC Signature Validation

Verify signature generation works correctly:

**Node script to test HMAC:**
```javascript
const crypto = require('crypto');

const payload = JSON.stringify({
  timestamp: '2025-11-15T10:30:45.123Z',
  metrics: []
});

const secret = 'your-webhook-secret';
const signature = crypto
  .createHmac('sha256', secret)
  .update(payload)
  .digest('hex');

console.log('Payload:', payload);
console.log('Secret:', secret);
console.log('Signature:', signature);

// Use with curl:
console.log(`
curl -X POST http://localhost:3000 \\
  -H 'Content-Type: application/json' \\
  -H 'X-Carnival-Signature: ${signature}' \\
  -d '${payload}'
`);
```

### 2.5 Test Invalid Signature Rejection

Send webhook with invalid signature:

```bash
# This should be rejected with 401
curl -X POST http://localhost:3000 \
  -H 'Content-Type: application/json' \
  -H 'X-Carnival-Signature: invalid-signature' \
  -d '{"test":"data"}'

# Expected: ❌ Invalid HMAC signature
```

---

## Part 3: Observability Configuration

### 3.1 Test Configuration Persistence

Changes to observability settings should persist after reload:

**Steps:**
1. Open Obsidian Settings → Carnival Network
2. Enable Observability
3. Set Webhook Endpoint to `http://localhost:3000`
4. Set Webhook Secret to `test-secret`
5. Save settings
6. Restart Obsidian
7. Verify settings are still present

### 3.2 Test Settings Validation

Try invalid configurations and verify error handling:

**Test Case 1: Invalid Webhook URL**
```
Provider: webhook
Endpoint: "not-a-valid-url"
Expected: Error message "Webhook endpoint must be a valid URL"
```

**Test Case 2: Missing Webhook Endpoint**
```
Provider: webhook
Endpoint: "" (empty)
Expected: Error message "Webhook endpoint URL is required"
```

**Test Case 3: Missing Provider**
```
Provider: (not selected)
Expected: Error message "Provider type is required"
```

### 3.3 Test Observability Disable/Enable

**Steps:**
1. Open Settings → Carnival Network
2. Toggle "Observability Enabled" OFF
3. Verify metrics endpoint still responds (gracefully)
4. Toggle "Observability Enabled" ON
5. Verify webhook provider re-initializes

---

## Part 4: Performance & Reliability

### 4.1 Test Metrics Under Load

Generate activity and verify metrics respond:

```bash
# Terminal 1: Monitor metrics
watch -n 0.5 'curl -s http://localhost:27124/metrics | wc -l'

# Terminal 2: In Obsidian, rapidly create acts / trigger syncs
# Metrics should show increasing counts without errors
```

### 4.2 Test Webhook Retry Logic

Simulate webhook receiver being unavailable:

```bash
# 1. Stop the webhook receiver (Ctrl+C)
# 2. In Obsidian, trigger activity
# 3. Check Carnival Network plugin logs for retry messages
# 4. Restart webhook receiver
# 5. Metrics should resume sending
```

### 4.3 Test Metrics Endpoint Timeout

Metrics endpoint should respond within 1-2 seconds:

```bash
time curl -s http://localhost:27124/metrics > /dev/null
# Expected: real 0m0.1XX s
```

---

## Part 5: Documentation & Integration

### 5.1 Verify Webhook Documentation

Check that documentation is accurate:

- `.github/docs/webhook-receiver.md` exists
- Examples are copy-paste ready
- HMAC verification instructions are clear

### 5.2 Test External Consumer Integration

Create a simple Prometheus scraper:

```python
#!/usr/bin/env python3
import requests
import time

URL = 'http://localhost:27124/metrics'

while True:
    try:
        response = requests.get(URL, timeout=5)
        metrics = response.text.split('\n')
        counter = sum(1 for m in metrics if not m.startswith('#') and m)
        print(f'✅ {counter} metrics retrieved')
    except Exception as e:
        print(f'❌ Error: {e}')
    time.sleep(10)
```

---

## Troubleshooting

| Issue | Diagnosis | Solution |
|-------|-----------|----------|
| Metrics endpoint returns 404 | Local REST API not active | Install/enable Local REST API plugin |
| Webhook not received | Endpoint misconfigured | Verify URL in settings, check firewall |
| HMAC validation fails | Secret mismatch | Ensure webhook secret matches in receiver |
| Metrics not updating | Observability disabled | Enable in settings, verify `applyObservabilityConfig()` called |
| High latency on metrics endpoint | Too many metrics | Check if metrics are being over-recorded |

---

## Summary Checklist

- [ ] Metrics endpoint responds with Prometheus text format
- [ ] Webhook signatures validate correctly (HMAC-SHA256)
- [ ] Webhook receiver successfully processes events
- [ ] Settings persist after restart
- [ ] Invalid configurations are rejected with clear errors
- [ ] Metrics update in real-time during activity
- [ ] Webhook retries on receiver unavailability
- [ ] Metrics endpoint responds < 1 second
- [ ] Documentation is accurate and copy-paste ready

---

## Next Steps

If all tests pass:
1. Consider adding metrics to observability dashboard
2. Plan Prometheus integration for production monitoring
3. Document metrics available via the endpoint
4. Plan webhook consumer patterns for external systems
