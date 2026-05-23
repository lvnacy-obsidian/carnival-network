# Webhook Receiver — Carnival Observability

This document describes a minimal webhook receiver (Node.js + Express) you can use to accept metrics pushed by the Carnival plugin's Webhook provider and verify HMAC signatures.

Headers sent by the Carnival plugin (when a webhook secret is configured):

- `X-Carnival-Ts`: Unix timestamp in milliseconds when the payload was signed.
- `X-Carnival-Signature`: HMAC-SHA256 signature of the string `<ts>.<payload>` encoded as `sha256=<hex>`.

The plugin constructs the signature as:

1. Let `payload` be the raw JSON string that will be POSTed.
2. Let `ts` be the current Unix epoch milliseconds as a string.
3. Compute `hmac = HMAC_SHA256(secret, `${ts}.${payload}`)` and hex-encode it.
4. Set `X-Carnival-Signature: sha256=${hmac}` and `X-Carnival-Ts: ${ts}`.

Minimal Express receiver example (Node.js 18+, using built-in `crypto`):

```js
const express = require('express');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;
const SECRET = process.env.CARNIVAL_WEBHOOK_SECRET || 'replace-with-your-secret';

// We need raw body for HMAC verification. Use express.raw for application/json.
app.post('/webhook', express.raw({ type: 'application/json' }), (req, res) => {
  const ts = req.header('X-Carnival-Ts');
  const sigHeader = req.header('X-Carnival-Signature');

  if (!ts || !sigHeader) {
    return res.status(400).send('Missing signature headers');
  }

  const payload = req.body.toString('utf8');
  const expected = crypto
    .createHmac('sha256', SECRET)
    .update(`${ts}.${payload}`)
    .digest('hex');

  const expectedHeader = `sha256=${expected}`;

  // Use timing-safe compare
  const valid = crypto.timingSafeEqual(Buffer.from(sigHeader), Buffer.from(expectedHeader));

  if (!valid) {
    return res.status(401).send('Invalid signature');
  }

  try {
    const data = JSON.parse(payload);
    console.log('Received metrics payload:', data);
    // process the data as you need
    res.status(204).end();
  } catch (err) {
    console.error('Failed to parse JSON payload', err);
    res.status(400).send('Invalid JSON');
  }
});

app.listen(PORT, () => console.log(`Webhook receiver listening on ${PORT}`));
```

Notes and best practices:

- Always use `express.raw({ type: 'application/json' })` (or equivalent) so you can compute the HMAC over the exact bytes sent.
- Reject requests with missing or out-of-range timestamps; you may enforce a short TTL (for example 5 minutes) to mitigate replay attacks.
- Use `crypto.timingSafeEqual` for signature comparison to avoid timing attacks.
- Rotate secrets occasionally and support multiple valid secrets during rotation windows if needed.

Example verification logic in other languages should follow the same pattern: compute `HMAC(secret, ts + '.' + rawPayload)` and compare to the received signature.
