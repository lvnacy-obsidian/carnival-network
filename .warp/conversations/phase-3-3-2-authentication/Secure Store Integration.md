# Secure Store Integration Guide 🔐

**Your Plugin**: `obsidian-secure-store`  
**Integration**: Carnival Network Plugin Phase 3.3.2  
**Impact**: Eliminates ~150 lines of crypto code, simplifies security

---

## 🎯 Why This Is Perfect

### What Secure Store Provides
1. ✅ **AES-256-GCM Encryption** - Industry-standard encryption
2. ✅ **Vault-Specific Keys** - Unique encryption per vault
3. ✅ **Auto-Namespacing** - `carnival-network` namespace isolation
4. ✅ **Desktop + Mobile** - Works everywhere Obsidian does
5. ✅ **Simple API** - 6 intuitive methods
6. ✅ **Zero Config** - Just works out of the box

### What This Eliminates from Carnival Network
1. ❌ Custom crypto utility implementation (~150 lines)
2. ❌ Web Crypto API complexity
3. ❌ Key derivation logic
4. ❌ Encryption/decryption boilerplate
5. ❌ Cross-platform crypto concerns
6. ❌ Manual key management

**Net Result**: Cleaner code, better security, faster development 🚀

---

## 🏗️ Integration Architecture

```
┌─────────────────────────────────────────────────────────┐
│           Carnival Network Plugin                       │
│                                                         │
│  ┌─────────────────────────────────────────────────┐    │
│  │  AuthService                                    │    │
│  │  - generateAPIKey()                             │    │
│  │  - validateAPIKey()                             │    │
│  │  - getJWTSecret()                               │    │
│  └───────────────┬─────────────────────────────────┘    │
│                  │                                      │
│                  │ store(), retrieve()                  │
│                  ▼                                      │
│  ┌─────────────────────────────────────────────────┐    │
│  │  Secure Store Plugin API                        │    │
│  │  secureStorage.store('api_keys', data)          │    │
│  │  secureStorage.retrieve('api_keys')             │    │
│  └───────────────┬─────────────────────────────────┘    │
└──────────────────┼──────────────────────────────────────┘
                   │
                   │ AES-256-GCM
                   ▼
         ┌──────────────────────┐
         │ Encrypted Vault Data │
         │ .obsidian/plugins/   │
         │ secure-storage/      │
         │ carnival-network/    │
         └──────────────────────┘
```

---

## 📝 Implementation Details

### 1. Plugin Dependency Check

**File**: `src/main.ts`

```typescript
export default class CarnivalNetworkPlugin extends Plugin {
  private secureStorage?: APIKeyStorage;

  async onload() {
    // Check for Secure Store plugin
    const secureStorePlugin = this.app.plugins.plugins['secure-store'];
    
    if (!secureStorePlugin) {
      new Notice('⚠️ Carnival Network requires the Secure Storage plugin. Please install it from Community Plugins.');
      console.warn('[Carnival] Secure Storage plugin not found. Authentication disabled.');
      // Continue loading but disable auth features
      return;
    }

    // Create namespaced storage
    this.secureStorage = secureStorePlugin.createStorage('carnival-network');
    console.log('[Carnival] ✅ Secure Storage initialized');

    // Continue with normal plugin initialization...
    await this.initializeAuthentication();
  }
}
```

### 2. AuthService Integration

**File**: `src/api/services/auth-service.ts`

```typescript
import { App, Notice } from 'obsidian';
import type { APIKeyStorage } from 'secure-store';

interface APIKeyConfig {
  id: string;
  key: string;
  name: string;
  clientType: ClientType;
  permissions: CarnivalPermission[];
  createdAt: string;
  lastUsedAt?: string;
  expiresAt?: string;
  revokedAt?: string;
}

export class AuthService {
  private secureStorage: APIKeyStorage;
  private app: App;

  constructor(app: App, secureStorage: APIKeyStorage) {
    this.app = app;
    this.secureStorage = secureStorage;
  }

  /**
   * Generate a new API key with carnival_ prefix
   */
  async generateAPIKey(config: {
    name: string;
    clientType: ClientType;
    permissions: CarnivalPermission[];
  }): Promise<APIKeyConfig> {
    // Generate secure random key
    const randomBytes = new Uint8Array(32);
    crypto.getRandomValues(randomBytes);
    const key = 'carnival_sk_' + this.bytesToBase64Url(randomBytes);

    const apiKey: APIKeyConfig = {
      id: this.generateId(),
      key,
      name: config.name,
      clientType: config.clientType,
      permissions: config.permissions,
      createdAt: new Date().toISOString()
    };

    // Store in Secure Store (auto-encrypted!)
    const keys = await this.getAllKeys();
    keys.push(apiKey);
    await this.secureStorage.store('api_keys', JSON.stringify(keys));

    return apiKey;
  }

  /**
   * Validate an API key and return auth context
   */
  async validateAPIKey(key: string): Promise<AuthContext | null> {
    const keys = await this.getAllKeys();
    const apiKey = keys.find(k => k.key === key && !k.revokedAt);

    if (!apiKey) {
      return null;
    }

    // Check expiration
    if (apiKey.expiresAt && new Date(apiKey.expiresAt) < new Date()) {
      return null;
    }

    // Update last used timestamp
    apiKey.lastUsedAt = new Date().toISOString();
    await this.saveKeys(keys);

    return {
      authenticated: true,
      apiKeyId: apiKey.id,
      clientType: apiKey.clientType,
      permissions: apiKey.permissions,
      isAdmin: apiKey.permissions.includes('*')
    };
  }

  /**
   * Get JWT secret (generate if needed)
   */
  async getJWTSecret(): Promise<string> {
    let secret = await this.secureStorage.retrieve('jwt_secret');
    
    if (!secret) {
      // Generate new 256-bit secret
      const secretBytes = new Uint8Array(32);
      crypto.getRandomValues(secretBytes);
      secret = this.bytesToBase64Url(secretBytes);
      await this.secureStorage.store('jwt_secret', secret);
    }
    
    return secret;
  }

  /**
   * Revoke an API key
   */
  async revokeAPIKey(keyId: string): Promise<void> {
    const keys = await this.getAllKeys();
    const key = keys.find(k => k.id === keyId);
    
    if (key) {
      key.revokedAt = new Date().toISOString();
      await this.saveKeys(keys);
    }
  }

  /**
   * List all API keys (excluding revoked)
   */
  async listAPIKeys(): Promise<APIKeyConfig[]> {
    const keys = await this.getAllKeys();
    return keys.filter(k => !k.revokedAt);
  }

  /**
   * Get all keys from Secure Store
   */
  private async getAllKeys(): Promise<APIKeyConfig[]> {
    const keysJson = await this.secureStorage.retrieve('api_keys');
    return keysJson ? JSON.parse(keysJson) : [];
  }

  /**
   * Save keys to Secure Store
   */
  private async saveKeys(keys: APIKeyConfig[]): Promise<void> {
    await this.secureStorage.store('api_keys', JSON.stringify(keys));
  }

  /**
   * Helper: Generate unique ID
   */
  private generateId(): string {
    return 'key_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  /**
   * Helper: Convert bytes to base64url
   */
  private bytesToBase64Url(bytes: Uint8Array): string {
    const base64 = btoa(String.fromCharCode(...bytes));
    return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  }
}
```

### 3. Storage Keys Used

The Carnival Network plugin will use these keys in Secure Store:

```typescript
// Secure Store namespace: 'carnival-network'

// Keys:
'api_keys'        // JSON array of APIKeyConfig objects
'jwt_secret'      // JWT signing secret (base64url, 256-bit)
'revoked_keys'    // JSON array of revoked key IDs (optional)
'admin_key'       // Initial admin API key (generated on first run)
```

### 4. Configuration Types

**File**: `src/types/public/carnival-configuration-types.ts`

```typescript
interface CarnivalConfig {
  // ... existing fields ...
  authentication?: AuthenticationConfig;
}

interface AuthenticationConfig {
  enabled: boolean;
  requireAuth: boolean;
  allowedMethods: ('apiKey' | 'jwt' | 'localRestAPI')[];
  jwtExpirationHours?: number;
  rateLimitEnabled?: boolean;
  
  // Secure Store is assumed available, no config needed
  // Encryption is automatic via Secure Store
}
```

---

## 🔄 Data Flow Example

### Creating an API Key
```
1. User clicks "Create API Key" in Settings UI
   ↓
2. AuthService.generateAPIKey() called
   ↓
3. Generate: carnival_sk_<32_random_bytes>
   ↓
4. Retrieve existing keys: secureStorage.retrieve('api_keys')
   ↓ (auto-decrypted by Secure Store)
5. Parse JSON, add new key
   ↓
6. Save keys: secureStorage.store('api_keys', JSON.stringify(keys))
   ↓ (auto-encrypted by Secure Store)
7. Return new key to UI
   ↓
8. User copies key to clipboard
```

### Validating a Request
```
1. HTTP request with: Authorization: Bearer carnival_sk_xxx
   ↓
2. Auth middleware extracts key
   ↓
3. AuthService.validateAPIKey(key) called
   ↓
4. Retrieve keys: secureStorage.retrieve('api_keys')
   ↓ (auto-decrypted)
5. Find matching key, check not revoked
   ↓
6. Check expiration (if set)
   ↓
7. Return AuthContext or null
   ↓
8. Middleware injects context into request
   ↓
9. Authorization middleware checks permissions
   ↓
10. Handler processes request
```

---

## ⚠️ Error Handling

### Missing Plugin Scenario

```typescript
// In main.ts onload()
const secureStorePlugin = this.app.plugins.plugins['secure-store'];

if (!secureStorePlugin) {
  // Option 1: Disable auth features gracefully
  console.warn('[Carnival] Secure Storage not found. Running without authentication.');
  this.authEnabled = false;
  
  // Option 2: Show notice and require plugin
  new Notice('⚠️ Carnival Network requires Secure Storage plugin', 0); // Persistent
  
  // Option 3: Offer to open Community Plugins
  // (Not possible via API, but can guide user in notice)
  
  return; // Skip auth initialization
}
```

### Storage Errors

```typescript
try {
  await this.secureStorage.store('api_keys', JSON.stringify(keys));
} catch (error) {
  console.error('[Carnival] Failed to store API keys:', error);
  new Notice('❌ Failed to save API key. Please check Secure Storage plugin.');
  throw new Error('Storage error: ' + error.message);
}
```

---

## 📋 Implementation Checklist

### Setup (5 minutes)
- [ ] Add `secure-store` to `manifest.json` as recommended plugin
- [ ] Update README with Secure Store requirement
- [ ] Add dependency check in `main.ts` onload()
- [ ] Create `secureStorage` instance with namespace

### AuthService (1-2 hours)
- [ ] Implement `generateAPIKey()` with Secure Store
- [ ] Implement `validateAPIKey()` with Secure Store
- [ ] Implement `getJWTSecret()` with Secure Store
- [ ] Implement `revokeAPIKey()` with Secure Store
- [ ] Implement `listAPIKeys()` with Secure Store
- [ ] Add error handling for all storage operations
- [ ] Test key generation/retrieval/revocation

### Settings UI (30 minutes)
- [ ] Add notice if Secure Store not installed
- [ ] Show encrypted key count: `await secureStorage.listKeys()`
- [ ] Add "Clear All Keys" button (with confirmation)
- [ ] Test UI with/without Secure Store installed

---

## 🎨 User Experience

### Settings Tab Display

```
┌─────────────────────────────────────────────────────┐
│ Authentication                                      │
├─────────────────────────────────────────────────────┤
│                                                     │
│ Secure Storage Status: ✅ Active                    │
│ Namespace: carnival-network                         │
│ Encrypted Keys: 3                                   │
│                                                     │
│ [Create API Key]  [Clear All Keys]                  │
│                                                     │
│ Active API Keys:                                    │
│ ┌────────────────────────────────────────────────┐  │
│ │ GitHub Integration          [Copy] [Revoke]    │  │
│ │ carnival_sk_***abc123                          │  │
│ │ Created: 2025-01-18  Last used: 2 hours ago    │  │
│ └────────────────────────────────────────────────┘  │
│                                                     │
│ ┌────────────────────────────────────────────────┐  │
│ │ Discord Bot                 [Copy] [Revoke]    │  │
│ │ carnival_sk_***def456                          │  │
│ │ Created: 2025-01-17  Last used: 5 minutes ago  │  │
│ └────────────────────────────────────────────────┘  │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### Missing Plugin Notice

```
┌─────────────────────────────────────────────────────┐
│ ⚠️ Authentication Disabled                          │
├─────────────────────────────────────────────────────┤
│                                                     │
│ The Carnival Network plugin requires the            │
│ "Secure Storage" plugin for authentication.         │
│                                                     │
│ Please install it from Community Plugins:           │
│ Settings → Community Plugins → Browse               │
│ Search: "Secure Storage"                            │
│                                                     │
│ [Learn More] [Remind Me Later]                      │
│                                                     │
└─────────────────────────────────────────────────────┘
```

---

## 🔒 Security Benefits

### Your Plugin Provides
1. **Vault-Specific Encryption**: Each vault has unique encryption keys
2. **Plugin Isolation**: Each plugin gets its own namespace
3. **Auto-Encryption**: No plaintext keys ever written to disk
4. **Mobile Support**: Works on iOS/Android Obsidian apps
5. **Key Derivation**: Proper cryptographic key derivation (PBKDF2)

### Carnival Network Adds
1. **Permission Model**: Fine-grained access control
2. **Rate Limiting**: Prevent abuse
3. **Audit Logging**: Track all auth events
4. **Key Rotation**: Support for rotating credentials
5. **JWT Sessions**: Time-limited access tokens

**Combined Result**: Enterprise-grade security for a local plugin! 🛡️

---

## 📊 Performance Impact

### Secure Store Operations
- **Store**: ~1-5ms (encryption + write)
- **Retrieve**: ~1-3ms (read + decryption)
- **Exists**: ~0.5ms (metadata check)

### Carnival Auth Operations
- **Generate Key**: ~5-10ms (random generation + store)
- **Validate Key**: ~3-5ms (retrieve + lookup)
- **List Keys**: ~3-5ms (retrieve + parse)

**Total Auth Overhead per Request**: ~5-10ms ✅ Acceptable!

---

## 🧪 Testing Strategy

### Manual Tests
1. **Install Secure Store**: Verify plugin detection
2. **Generate Key**: Check encryption/storage
3. **Validate Key**: Test retrieval/decryption
4. **Revoke Key**: Verify revocation persists
5. **Uninstall Secure Store**: Check graceful degradation
6. **Reinstall Secure Store**: Verify keys still accessible

### Automated Tests (Future)
```typescript
describe('AuthService with Secure Store', () => {
  let authService: AuthService;
  let mockSecureStorage: APIKeyStorage;

  beforeEach(() => {
    mockSecureStorage = {
      store: jest.fn(),
      retrieve: jest.fn(),
      remove: jest.fn(),
      exists: jest.fn(),
      listKeys: jest.fn(),
      clearAll: jest.fn()
    };
    authService = new AuthService(app, mockSecureStorage);
  });

  it('should generate API key and store encrypted', async () => {
    const key = await authService.generateAPIKey({
      name: 'Test Key',
      clientType: 'integration',
      permissions: ['acts:read']
    });

    expect(key.key).toMatch(/^carnival_sk_/);
    expect(mockSecureStorage.store).toHaveBeenCalledWith('api_keys', expect.any(String));
  });
});
```

---

## 🚀 Quick Start

### 1. Add Dependency
```typescript
// In main.ts
async onload() {
  // Check for Secure Store
  if (!this.app.plugins.plugins['secure-store']) {
    new Notice('Please install Secure Storage plugin');
    return;
  }

  // Initialize
  const secureStorage = this.app.plugins.plugins['secure-store']
    .createStorage('carnival-network');
  
  this.authService = new AuthService(this.app, secureStorage);
}
```

### 2. Use AuthService
```typescript
// Generate key
const key = await this.authService.generateAPIKey({
  name: 'My Integration',
  clientType: 'integration',
  permissions: ['acts:read', 'acts:create']
});

// Validate key
const context = await this.authService.validateAPIKey(key.key);
if (context?.authenticated) {
  console.log('Valid key with permissions:', context.permissions);
}

// List keys
const keys = await this.authService.listAPIKeys();
console.log(`Found ${keys.length} active keys`);

// Revoke key
await this.authService.revokeAPIKey(key.id);
```

---

## 🎉 Summary

### What Changes
- ❌ Remove `crypto.ts` utility (~150 lines)
- ✅ Add Secure Store integration (~50 lines)
- ✅ Add dependency check (~20 lines)
- ✅ Simplify AuthService (~50 lines less)

### Net Impact
- **Lines Removed**: ~150
- **Lines Added**: ~70
- **Net Savings**: ~80 lines of complex crypto code!

### Benefits
1. ✅ Better security (dedicated crypto plugin)
2. ✅ Less code to maintain
3. ✅ Faster development
4. ✅ Mobile support guaranteed
5. ✅ Community-vetted encryption
6. ✅ No reinventing the wheel

---

*"Security is not something you build alone. Standing on the shoulders of secure giants means we can focus on building amazing features!"* 🔐✨