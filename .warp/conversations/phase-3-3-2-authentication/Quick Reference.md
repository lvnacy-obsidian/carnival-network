# Phase 3.3.2 Quick Reference 🔐

**Status**: 📋 Ready to Implement  
**Estimated Duration**: 2-3 Sessions (6-9 hours)  
**Complexity**: Medium-High

---

## 🎯 What We're Building

A secure, flexible authentication and authorization system with:
- **3 auth methods**: API keys, JWT tokens, Local REST API passthrough
- **5 client types**: Internal, Integration, External, Webhook, Admin
- **9 permissions**: Fine-grained access control
- **Rate limiting**: Token bucket algorithm with burst allowance
- **Audit logging**: Complete auth event tracking

---

## 📦 New Files (7 Total - Down from 8!)

### Types (1)
- `src/types/public/authentication-types.ts` (200+ lines)

### Services (2)
- `src/api/services/auth-service.ts` (350+ lines - simplified with Secure Store!)
- `src/api/services/authorization-service.ts` (300+ lines)

### Middleware (2)
- `src/api/middleware/auth-middleware.ts` (150+ lines)
- `src/api/middleware/authz-middleware.ts` (200+ lines)

### Handlers (1)
- `src/api/handlers/auth-handlers.ts` (350+ lines)

### UI (1)
- `src/ui/components/api-key-manager.ts` (300+ lines)

### Utils (1)
- `src/utils/rate-limiter.ts` (200+ lines)

### ✅ REMOVED (Thanks to Secure Store!)
- ~~`src/utils/crypto.ts`~~ ❌ (150 lines eliminated!)

**Total New Code**: ~2,100 lines (down from ~2,250)

---

## 🎉 MAJOR WIN: Secure Store Integration

### What Your Plugin Provides ✅
- AES-256 encryption/decryption (automatic!)
- Vault-specific encryption keys
- Per-plugin namespacing (`carnival-network`)
- Desktop + mobile support
- Simple storage API

### What This Eliminates ❌
- ~150 lines of crypto utility code
- Web Crypto API complexity
- Key derivation implementation
- Encryption/decryption boilerplate
- Cross-platform crypto concerns

### Integration Pattern
```typescript
// In auth-service.ts
const secureStorePlugin = app.plugins.plugins['secure-store'];
const storage = secureStorePlugin.createStorage('carnival-network');

// Store encrypted API keys
await storage.store('api_keys', JSON.stringify(keys));

// Retrieve (auto-decrypted)
const keys = JSON.parse(await storage.retrieve('api_keys'));
```

---

## 🔑 Key Design Decisions

### 1. Three-Layer Auth Strategy
```
API Keys (Long-lived) ────────┐
                               ├──> AuthContext ──> Handler
JWT Tokens (24hr session) ────┤
                               │
Local REST API (Passthrough) ─┘
```

### 2. Permission Model
```typescript
// Carnival-themed permissions
'acts:read'           // Query acts
'acts:create'         // Create acts
'acts:broadcast'      // Broadcast to network
'search:execute'      // Perform searches
'carnival:status'     // View network status
'territories:list'    // List territories
'analytics:read'      // View analytics
'webhooks:receive'    // Receive webhook calls
'admin:manage'        // Manage API keys
'*'                   // Full access (admin only)
```

### 3. Rate Limit Tiers
| Client Type | Requests/Min | Requests/Hour | Burst | Block Duration |
|-------------|--------------|---------------|-------|----------------|
| Internal    | 1,000        | 60,000        | 100   | No blocking    |
| Integration | 60           | 3,600         | 20    | 60s            |
| External    | 30           | 1,000         | 10    | 5min           |
| Webhook     | 10           | 600           | 5     | 10min          |
| Admin       | 1,000        | 60,000        | 100   | No blocking    |

### 4. API Key Format
```
carnival_sk_<32_random_bytes_base64url>
Example: carnival_sk_k7L9mN3pQ5rT8vW2xY4zA6bC1dE9fG
```

---

## 🎬 Implementation Sequence

### Session 1: Core Auth (3-4 hours)
1. Create `authentication-types.ts` with all types
2. Create `crypto.ts` utility
3. Create `auth-service.ts` with key management
4. Update configuration types
5. Test key generation/validation

**Commit**: "Phase 3.3.2: Core authentication infrastructure"

### Session 2: Authorization (2-3 hours)
1. Create `authorization-service.ts`
2. Create `rate-limiter.ts`
3. Create both middleware files
4. Update `api-router.ts` with middleware
5. Test rate limiting

**Commit**: "Phase 3.3.2: Authorization and rate limiting"

### Session 3: Management (2-3 hours)
1. Create `auth-handlers.ts` endpoints
2. Create `api-key-manager.ts` UI component
3. Update `settings-tab.ts`
4. End-to-end testing
5. Update documentation

**Commit**: "Phase 3.3.2: Auth management UI and endpoints"

---

## 🔐 Security Highlights

✅ **API Keys**: AES-256-GCM encryption (via Secure Store Plugin)  
✅ **JWT Tokens**: HS256 with random 256-bit secret (stored in Secure Store)  
✅ **Storage**: Secure Store Plugin (vault-specific, namespaced)  
✅ **Audit Log**: All auth events tracked  
✅ **Rate Limiting**: Token bucket with burst protection  
✅ **No Crypto Implementation**: Secure Store handles all encryption! 🎉  

---

## 🎯 New API Endpoints (6)

```
POST   /api/auth/keys              - Create API key (admin)
GET    /api/auth/keys              - List API keys (admin)
DELETE /api/auth/keys/:id          - Revoke API key (admin)
POST   /api/auth/login             - Generate JWT token
POST   /api/auth/refresh           - Refresh JWT token
GET    /api/auth/verify            - Verify current credentials
```

---

## 📊 Modified Files (4)

1. `src/api/api-router.ts` - Add middleware to routes
2. `src/api/external-api-service.ts` - Use AuthContext
3. `src/types/public/carnival-configuration-types.ts` - Add auth config
4. `src/ui/settings-tab.ts` - Add auth settings section

---

## 🎭 Example Usage

### Creating an API Key (Admin)
```bash
curl -X POST http://localhost:27124/api/auth/keys \
  -H "Authorization: Bearer <admin_key>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "GitHub Integration",
    "clientType": "integration",
    "permissions": ["acts:create", "webhooks:receive"]
  }'
```

**Response**:
```json
{
  "success": true,
  "data": {
    "id": "key_abc123",
    "key": "carnival_sk_k7L9mN3pQ5rT8vW2xY4zA6bC1dE9fG",
    "name": "GitHub Integration",
    "clientType": "integration",
    "permissions": ["acts:create", "webhooks:receive"],
    "createdAt": "2025-01-18T10:00:00Z"
  }
}
```

### Using the API Key
```bash
curl -X GET http://localhost:27124/api/acts \
  -H "Authorization: Bearer carnival_sk_k7L9mN3pQ5rT8vW2xY4zA6bC1dE9fG"
```

### Rate Limited Response
```json
{
  "success": false,
  "error": {
    "message": "Rate limit exceeded. Try again in 60 seconds.",
    "code": "RATE_LIMIT_EXCEEDED",
    "retryAfter": 60
  }
}
```

---

## ✅ Success Criteria

### Must Have
- [x] API keys can be generated with custom permissions
- [x] All endpoints protected with middleware
- [x] Rate limits enforced per client type
- [x] Settings UI for key management
- [x] Audit logging of auth events
- [x] Zero new external dependencies

### Nice to Have (Future)
- [ ] OAuth2.0 flow for third-party apps
- [ ] Scoped API keys per territory
- [ ] Multi-factor auth for admin
- [ ] Client certificate support (mTLS)
- [ ] Webhook signature validation

---

## 🚀 Ready to Start?

### Pre-Implementation Checklist
1. ✅ Phase 3.3 complete (all API endpoints working)
2. ✅ Planning document reviewed and approved
3. ⏳ Create feature branch: `feature/phase-3-3-2-authentication`
4. ⏳ Set up project tracking (GitHub issues/project board)
5. ⏳ Review security best practices (OWASP API Security)

### First Implementation Step
```bash
# Create feature branch
git checkout -b feature/phase-3-3-2-authentication

# Create type module
touch src/types/public/authentication-types.ts

# Start implementation
# 1. Define APIKeyConfig interface
# 2. Define JWTPayload interface
# 3. Define AuthContext interface
# 4. Export all types
```

---

## 📚 Documentation Deliverables

### New Documentation
1. `.github/docs/authentication-guide.md` (500+ lines)
   - Authentication methods explained
   - Permission model documentation
   - Rate limiting details
   - API key management workflows
   - Security best practices

2. Update `.github/docs/api-testing-phase-3-3.md`
   - Add authenticated request examples
   - Add permission error scenarios
   - Add rate limit testing examples

3. Update `README.md`
   - Add authentication section
   - Add API key generation instructions
   - Add security considerations

---

## 🎪 Carnival Metaphor Alignment

**Authentication = Performer Badges**
- API keys are performer badges granting carnival access
- Different badge colors (client types) = different privileges
- Revoked badges go on the "banned performers" list

**Authorization = Ticket Validation**
- Each act (endpoint) requires specific tickets (permissions)
- Rate limits are like ride capacity limits
- Admin badges are backstage passes with full access

**Error Messages Use Metaphor**:
- 401: "Your performer badge is not recognized."
- 403: "Your ticket doesn't grant access to this act."
- 429: "You've exceeded the performance limit. Slow down!"

---

*"The carnival welcomes all performers with proper credentials. Show your badge at the gate and enjoy the show!"* 🎪🔐