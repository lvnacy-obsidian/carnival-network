# 🎪 Carnival Registry Service - Refactoring Plan (Updated)

## 📋 Overview

This document outlines the plan to consolidate registry-related functionality into a clean, maintainable architecture by:
1. Enhancing `CarnivalRegistryService` as the Booking Office Coordinator
2. Slimming `HttpRegistryService` to be the Protocol Intern
3. Making `CertificateManager` a standalone service (no delegation)
4. Establishing proper coordinator/intern relationship

---

## 🎭 The Architecture Metaphor

### CarnivalRegistryService = The Booking Agent/Events Coordinator
- Knows about carnival infrastructure (Local REST API, Obsidian plugins)
- Sets up the booking office (endpoints, health monitoring)
- Coordinates operations (builds performer info, manages registrations)
- Manages API keys for registries
- **Creates and manages the intern**

### HttpRegistryService = The Intern
- Makes HTTP calls as instructed
- Follows registration protocol
- Queries registries for data
- Reports back to coordinator
- **Uses tools given by coordinator (endpoint manager, cache)**

### CertificateManager = The Security Office (Standalone)
- Independent from booking operations
- Used directly by anyone needing certificates
- No delegation through registry services

---

## 🎯 Goals

1. ✅ **Move initialization** from HttpRegistryService to CarnivalRegistryService
2. ✅ **Consolidate performer detection** into CarnivalRegistryService
3. ✅ **Consolidate API key management** into CarnivalRegistryService
4. ✅ **Make CertificateManager standalone** (remove all delegation)
5. ✅ **Slim HttpRegistryService** to protocol operations only
6. ✅ **Establish coordinator/intern relationship** via dependency injection

---

## 📁 File Changes Summary

### Files to Modify:
- ✏️ `carnival-registry-service.ts` - Add initialization, performer detection, API key management
- ✏️ `http-registry-service.ts` - Remove initialization, make it a protocol-only intern
- 🔄 `certificate-store.ts` → `certificate-manager.ts` - Rename and make standalone

### Files to Leave Unchanged:
- ✅ `http-client.ts` - Perfect as utility
- ✅ `registry-endpoint-manager.ts` - Perfect as utility
- ✅ `persistent-performer-cache.ts` - Perfect as cache

---

## 🔧 Step 1: Transform CarnivalRegistryService into the Coordinator

### Update Constructor and Add Initialization

```typescript
export class CarnivalRegistryService implements TerritoryServiceInterface {
    private registryLogger: LogContext;
    private registeredPerformers: Set<string> = new Set();
    private httpService: HttpRegistryService;
    private performerCache: PersistentPerformerCache;
    private endpointManager: RegistryEndpointManager;
    private localApiPort: number = 27123;
    private localApiKey: string = '';

    constructor(
        private plugin: CarnivalNetworkPlugin,
        private store: APIKeyStore
    ) {
        this.registryLogger = {
            context: 'Carnival Registry Service',
            path: `${plugin.app.vault.configDir}/plugins/carnival-network/src/network/carnival-registry-service`
        };

        // Initialize booking office infrastructure
        this.initializeBookingOffice();

        // Initialize performer cache
        this.performerCache = new PersistentPerformerCache(plugin.app);

        // Create the intern (pass dependencies)
        this.httpService = new HttpRegistryService(
            plugin.app,
            this.endpointManager,
            this.performerCache,
            store
        );

        // Load saved registrations
        this.loadRegistrations();

        Log.log(this.registryLogger, '🎪 Carnival Registry Service (Booking Office) initialized');
    }

    /**
     * Initialize the booking office infrastructure
     * Sets up Local REST API configuration, registry endpoints, and health monitoring
     * @private
     */
    private initializeBookingOffice(): void {
        try {
            // 1. Get Local REST API configuration
            const localAPIConfig = this.getLocalRestAPIConfig();
            this.localApiPort = localAPIConfig.port;
            this.localApiKey = localAPIConfig.apiKey;

            Log.log(
                this.registryLogger,
                `🎪 Local REST API detected: port ${this.localApiPort}`
            );

            // 2. Get registry endpoints from settings
            const configuredEndpoints = this.plugin.settings.registryEndpoints ?? [];
            
            // Add localhost as default if no endpoints configured
            const seededEndpoints = configuredEndpoints.length > 0
                ? [...configuredEndpoints]
                : [`http://localhost:${this.localApiPort}`];

            // 3. Validate and filter endpoints (HTTPS enforcement)
            const validEndpoints = seededEndpoints.filter(ep => {
                const isValid = this.validateEndpoint(ep);
                if (!isValid) {
                    Log.warn(
                        this.registryLogger,
                        `🎪 Invalid endpoint filtered out: ${ep}`
                    );
                }
                return isValid;
            });

            // 4. Create endpoint health monitor
            this.endpointManager = new RegistryEndpointManager(validEndpoints);

            Log.log(
                this.registryLogger,
                `🎪 Booking office initialized with ${validEndpoints.length} registry endpoint(s)`
            );
        } catch (error) {
            Log.error(
                this.registryLogger,
                '🎪 Failed to initialize booking office:',
                error
            );
            // Create empty endpoint manager as fallback
            this.endpointManager = new RegistryEndpointManager([]);
        }
    }

    /**
     * Get Local REST API configuration
     * @private
     */
    private getLocalRestAPIConfig(): { port: number; apiKey: string } {
        try {
            const { plugins } = (this.plugin.app as any);
            const restApiPlugin = plugins.plugins['obsidian-local-rest-api'];
            
            if (restApiPlugin?.enabled) {
                const apiSettings = restApiPlugin.settings;
                return {
                    port: apiSettings.port ?? 27123,
                    apiKey: apiSettings.apiKey ?? ''
                };
            }
        } catch (error) {
            Log.warn(
                this.registryLogger,
                'Failed to get Local REST API config:',
                error
            );
        }
        
        return { port: 27123, apiKey: '' };
    }
}
```

### Add Performer Detection Methods

Add these **private** methods to `CarnivalRegistryService`:

```typescript
/**
 * Detect performer capabilities based on installed plugins
 * @private
 */
private async detectCapabilities(): Promise<string[]> {
    const capabilities = ['http_communication', 'record_sync'];
    
    try {
        // Check for plugin-specific capabilities
        const { plugins } = (this.plugin.app as any).plugins;
        
        if (plugins['obsidian-local-rest-api']?.enabled) {
            capabilities.push('rest_api');
        }
        
        if (plugins['templater-obsidian']?.enabled) {
            capabilities.push('templating');
        }
        
        if (plugins['dataview']?.enabled) {
            capabilities.push('dataview_queries');
        }
    } catch (error) {
        Log.warn(this.registryLogger, 'Failed to detect capabilities:', error);
    }
    
    return capabilities;
}

/**
 * Detect platform from user agent
 * @private
 */
private detectPlatform(): string {
    if (typeof window !== 'undefined') {
        const userAgent = window.navigator.userAgent.toLowerCase();
        
        if (userAgent.includes('mac')) return 'macos';
        if (userAgent.includes('win')) return 'windows';
        if (userAgent.includes('linux')) return 'linux';
    }
    
    return 'unknown';
}

/**
 * Detect territory from vault path
 * @private
 */
private detectTerritory(vaultPath: string): string {
    const path = vaultPath.toLowerCase();
    
    if (path.includes('necropolis')) return 'necropolis';
    if (path.includes('backstage')) return 'backstage';
    if (path.includes('boutique')) return 'boutique';
    if (path.includes('athenaeum')) return 'athenaeum';
    if (path.includes('carnival')) return 'carnival-main';
    
    return 'unknown';
}
```

### Add Public Builder Method

```typescript
/**
 * 🎭 Build performer registration info
 * 
 * Constructs complete PerformerRegistrationInfo from current vault state.
 * Detects capabilities, platform, territory, and Local REST API configuration.
 * 
 * @param performerId - Unique performer identifier
 * @returns Complete performer registration information
 * 
 * @example
 * ```typescript
 * const info = await registryService.buildPerformerInfo('my-performer');
 * await registryService.establishTerritory('backstage', info);
 * ```
 */
async buildPerformerInfo(performerId: string): Promise<PerformerRegistrationInfo> {
    const vault = this.plugin.app.vault;
    const vaultPath = (vault.adapter as any).path;
    
    return {
        performerId,
        territoryName: this.detectTerritory(vaultPath),
        endpoint: `http://localhost:${this.localApiPort}`,
        capabilities: await this.detectCapabilities(),
        metadata: {
            apiHost: 'localhost',
            apiPort: this.localApiPort,
            useHttps: false,
            vaultPath,
            platform: this.detectPlatform(),
            version: '1.0.0'
        }
    };
}
```

### Add API Key Management Methods

```typescript
// ========================================================================
// REGISTRY API KEY MANAGEMENT
// ========================================================================

/**
 * 🔐 Store API key for registry endpoint
 * 
 * @param registryUrl - Registry endpoint URL
 * @param apiKey - API key to store
 */
async storeRegistryAPIKey(registryUrl: string, apiKey: string): Promise<void> {
    try {
        await this.store.store(`registry_${registryUrl}`, apiKey);
        Log.log(
            this.registryLogger,
            `🔐 Stored API key for registry: ${registryUrl}`
        );
    } catch (error) {
        Log.error(this.registryLogger, 'Failed to store registry API key:', error);
        throw error;
    }
}

/**
 * 🔓 Retrieve API key for registry endpoint
 * 
 * @param registryUrl - Registry endpoint URL
 * @returns API key or null if not found
 */
async getRegistryAPIKey(registryUrl: string): Promise<string | null> {
    try {
        const key = await this.store.retrieve(`registry_${registryUrl}`);
        return key || this.localApiKey || null;
    } catch (error) {
        Log.warn(this.registryLogger, 'Failed to retrieve registry API key:', error);
        return this.localApiKey || null;
    }
}

/**
 * 🗑️ Remove API key for registry endpoint
 * 
 * @param registryUrl - Registry endpoint URL
 */
async removeRegistryAPIKey(registryUrl: string): Promise<void> {
    try {
        await this.store.remove(`registry_${registryUrl}`);
        Log.log(
            this.registryLogger,
            `🗑️ Removed API key for registry: ${registryUrl}`
        );
    } catch (error) {
        Log.error(this.registryLogger, 'Failed to remove registry API key:', error);
        throw error;
    }
}
```

### Update Network Operations to Pass API Keys

Update the delegation methods to pass API keys to the intern:

```typescript
async establishTerritory(
    territory: string,
    performerInfo: PerformerRegistrationInfo
): Promise<void> {
    // Get endpoints from endpoint manager
    const endpoints = this.getEndpoints();
    
    // Build API key map for each endpoint
    const apiKeyMap = new Map<string, string>();
    for (const endpoint of endpoints) {
        const key = await this.getRegistryAPIKey(endpoint);
        if (key) {
            apiKeyMap.set(endpoint, key);
        }
    }
    
    return this.httpService.establishTerritory(territory, performerInfo, apiKeyMap);
}
```

### Remove Certificate Methods

**DELETE** these methods from `CarnivalRegistryService`:
```typescript
// ❌ REMOVE ALL CERTIFICATE METHODS
// - addTrustedCertificate()
// - revokeCertificate()
// - getTrustedCertificates()
// - getCertificateHealth()
// - exportTrustStore()
// - importTrustStore()
```

---

## 🔧 Step 2: Transform HttpRegistryService into the Intern

### Update Constructor to Accept Dependencies

```typescript
export class HttpRegistryService implements TerritoryServiceInterface {
    private app: App;
    private endpointManager: RegistryEndpointManager;
    private performerCache: PersistentPerformerCache;
    private store: APIKeyStore;
    private heartbeatIntervals: Map<string, ReturnType<typeof setInterval>> = new Map();
    private currentPerformer: Performer | null = null;

    constructor(
        app: App,
        endpointManager: RegistryEndpointManager,
        performerCache: PersistentPerformerCache,
        store: APIKeyStore
    ) {
        this.app = app;
        this.endpointManager = endpointManager;
        this.performerCache = performerCache;
        this.store = store;
        
        Log.log(httpRegistryLogger, '📋 HTTP Registry Service (Intern) ready');
    }

    // ... rest of the class
}
```

### Remove Initialization Logic

**DELETE** these from `HttpRegistryService`:

```typescript
// ❌ REMOVE THESE:
- private config: CarnivalConfig
- private registryEndpoints: string[]
- private localApiPort: number
- private localApiKey: string
- private tlsConfig?: TLSConfig
- initializeRegistry()
- getDefaultRegistryEndpoints()
```

### Update Methods to Use Endpoint Manager

Update methods that accessed `this.registryEndpoints` to use endpoint manager:

```typescript
/**
 * Get registry endpoints from endpoint manager
 * @private
 */
private getRegistryEndpoints(): string[] {
    const states = this.endpointManager.getEndpointStates();
    return Array.from(states.keys());
}

/**
 * Register current performer with network registries
 */
async establishTerritory(
    territory: string,
    performerInfo: PerformerRegistrationInfo,
    apiKeyMap: Map<string, string>
): Promise<void> {
    const performer: Performer = {
        id: performerInfo.performerId,
        name: this.app.vault.getName(),
        territory: performerInfo.territoryName,
        lastSeen: new Date().toISOString(),
        capabilities: performerInfo.capabilities,
        metadata: performerInfo.metadata ?? {}
    };
    
    const endpoints = this.getRegistryEndpoints();
    
    for (const registryUrl of endpoints) {
        try {
            const apiKey = apiKeyMap.get(registryUrl);
            await this.registerWithRegistry(registryUrl, performer, apiKey);
            Log.log(httpRegistryLogger, `📋 Registered with registry: ${registryUrl}`);
        } catch (error) {
            Log.error(httpRegistryLogger, `📋 Failed to register with ${registryUrl}:`, error);
        }
    }

    // Start periodic heartbeat
    this.startHeartbeat();
}
```

### Remove Performer Detection Methods

**DELETE** these from `HttpRegistryService`:

```typescript
// ❌ REMOVE THESE:
- detectCapabilities()
- detectPlatform()
- detectTerritory()
- getCurrentPerformerInfo() (if it builds performer info)
```

### Simplify API Request Method

Update `makeAPIRequest` to accept API key as parameter instead of looking it up:

```typescript
private async makeAPIRequest(
    baseUrl: string,
    endpoint: string,
    method: string,
    apiKey: string | null,
    data?: any
): Promise<Response> {
    const url = `${baseUrl}${endpoint}`;
    const headers: Record<string, string> = {
        'Content-Type': 'application/json'
    };

    if (apiKey) {
        headers['Authorization'] = `Bearer ${apiKey}`;
    }

    // ... rest of method
}
```

### Remove Certificate Methods

**DELETE** these from `HttpRegistryService`:

```typescript
// ❌ REMOVE ALL CERTIFICATE METHODS
// - addTrustedCertificate()
// - revokeCertificate()
// - getTrustedCertificates()
// - getCertificateHealth()
// - exportTrustStore()
// - importTrustStore()
```

### Keep Only Protocol Methods

The intern should ONLY have these public methods:
- ✅ `establishTerritory()`
- ✅ `abandonTerritory()`
- ✅ `sendHeartbeat()`
- ✅ `scoutTerritories()`
- ✅ `findPerformers()`
- ✅ `findPerformersByTerritory()`
- ✅ `getAllPerformers()`
- ✅ `broadcastPerformerUpdate()`
- ✅ `isAvailable()`
- ✅ `getRegistryHealth()` (delegates to endpoint manager)
- ✅ `getRegistryMetrics()` (delegates to endpoint manager)
- ✅ `getNetworkTopology()`
- ✅ `cleanup()`

---

## 🔧 Step 3: Make CertificateManager Standalone

### Rename File

```bash
# In src/network/
mv certificate-store.ts certificate-manager.ts
```

### Update Exports

In `certificate-manager.ts`, update the final export:

```typescript
/**
 * Certificate Manager - Standalone certificate trust store
 * 
 * Use this directly anywhere certificates are needed.
 * No delegation through registry services.
 * 
 * @example
 * ```typescript
 * import { certificateManager } from './certificate-manager';
 * 
 * await certificateManager.addTrustedCertificate(pem, endpoints);
 * const health = certificateManager.getCertificateHealth();
 * ```
 */
export class CertificateStore {
    // Keep all existing implementation
}

// Export singleton instance
export const certificateManager = new CertificateStore();
```

### Update All Imports Across Codebase

Find and replace:

```typescript
// Before:
import { certificateStore } from './certificate-store';
certificateStore.addTrustedCertificate(...);

// After:
import { certificateManager } from './certificate-manager';
certificateManager.addTrustedCertificate(...);
```

**Files to update:**
- `http-registry-service.ts` (if it uses certificates for TLS)
- `http-client.ts` (if it validates certificates)
- Any settings UI that manages certificates
- Any other files importing `certificateStore`

### Usage Examples

```typescript
// In http-client.ts
import { certificateManager } from './certificate-manager';

async function createTLSAgent(tlsConfig: TLSConfig, url: string): Promise<any> {
    // Use certificate manager directly
    const tlsOptions = certificateManager.createTLSConfig(tlsConfig);
    // ...
}
```

```typescript
// In settings-tab.ts (if you have certificate UI)
import { certificateManager } from '../network/certificate-manager';

renderCertificateTab(container: HTMLElement): void {
    // Use certificate manager directly
    const health = certificateManager.getCertificateHealth();
    const certs = certificateManager.getTrustedCertificates();
    // ... render UI
}
```

---

## 🔧 Step 4: Update main.ts Integration

### Initialize Registry Service

```typescript
export default class CarnivalNetworkPlugin extends Plugin {
    public registryService?: CarnivalRegistryService;
    
    async onload(): Promise<void> {
        await this.loadSettings();
        
        // Initialize managers
        this.observabilityManager = new ObservabilityManager(this);
        
        Log.log(this.mainLogger, '🎪 Carnival Network Plugin loaded');
        
        this.addSettingTab(new CarnivalNetworkSettingsTab(this.app, this, this.settings));
        
        this.app.workspace.onLayoutReady(async () => {
            // Verify dependencies
            verifyDependencies('obsidian-local-rest-api', this.app, this.mainLogger);
            verifyDependencies('secure-store', this.app, this.mainLogger);
            
            // Get secure store
            const secureStorePlugin = getPlugin(this.app, 'secure-store');
            if (secureStorePlugin && isSecureStorePlugin(secureStorePlugin)) {
                const storage = await secureStorePlugin.createStorage('carnival-network');
                
                // Initialize registry service (coordinator)
                this.registryService = new CarnivalRegistryService(this, storage);
            }
            
            // Apply observability config
            await this.observabilityManager.applyObservabilityConfig();
            
            // Initialize API router
            this.routeManager = initializeAPIRouter(this.app, this, this.manifest);
            
            // Initialize status monitor
            this.statusMonitor = new CarnivalStatusMonitor(this);
        });
    }
}
```

### Update joinCarnival

```typescript
joinCarnival(
    performerId: string,
    store: APIKeyStore,
    config: CarnivalConfig
): CarnivalPerformerInterface {
    // Verify dependencies
    const localRestApi = verifyDependencies('obsidian-local-rest-api', this.app, this.mainLogger);
    const secureStore = verifyDependencies('secure-store', this.app, this.mainLogger);
    
    if (!localRestApi || !secureStore) {
        throw new Error(
            '🎪 Carnival Network requires Local REST API and Secure Store plugins.'
        );
    }
    
    // Create performer
    const performer = new CarnivalPerformer(this.app, config, store, performerId);
    this.activePerformers.set(performerId, performer);
    
    // Register with registry service
    this.registryService?.registerPerformer(performerId);
    
    Log.log(this.mainLogger, `🎭 New performer joined: ${performerId}`);
    return performer;
}
```

### Update leaveCarnival

```typescript
async leaveCarnival(performerId: string): Promise<void> {
    const performer = this.activePerformers.get(performerId);
    if (performer) {
        await performer.cleanup();
        this.activePerformers.delete(performerId);
        
        // Unregister from registry service
        this.registryService?.unregisterPerformer(performerId);
        
        Log.log(this.mainLogger, `🎭 Performer left: ${performerId}`);
    }
}
```

---

## 🔧 Step 5: Update Settings Tab

### Update Registry Endpoint Management

```typescript
// In settings-tab.ts
import { certificateManager } from '../network/certificate-manager';

// For registry endpoints
await this.plugin.registryService?.updateEndpoints(newEndpoints);

// For certificates (if you have certificate UI)
const health = certificateManager.getCertificateHealth();
const certs = certificateManager.getTrustedCertificates();
```

---

## 🧪 Step 6: Testing Checklist

After completing the refactoring, test these operations:

### Coordinator (CarnivalRegistryService)
- [ ] Booking office initializes correctly
- [ ] Local REST API config detected
- [ ] Registry endpoints validated and filtered
- [ ] Endpoint manager created
- [ ] Build performer info with correct detection
- [ ] Store/retrieve/remove registry API keys

### Intern (HttpRegistryService)
- [ ] Accepts dependencies in constructor
- [ ] Establishes territory with given API keys
- [ ] Scouts territories
- [ ] Sends heartbeat
- [ ] Abandons territory
- [ ] Uses endpoint manager for health checks

### Certificate Manager (Standalone)
- [ ] Can be imported directly
- [ ] Add trusted certificate works
- [ ] Revoke certificate works
- [ ] Get certificate health works
- [ ] Export/import trust store works
- [ ] No references to certificateStore remain

### Integration
- [ ] main.ts creates registry service correctly
- [ ] joinCarnival registers performer
- [ ] leaveCarnival unregisters performer
- [ ] Settings tab uses registry service
- [ ] All certificate operations use certificateManager directly

---

## 📊 Before & After Comparison

### Before:
```
carnival-registry-service.ts (facade - 700 lines)
├─ Delegates everything
└─ Tracks registrations

http-registry-service.ts (monolith - 900 lines)
├─ Initialization
├─ Performer detection
├─ Certificate operations (delegation)
├─ API key management
└─ Network protocol

certificate-store.ts (400 lines)
└─ Accessed via delegation

Total: 3 files, 2000 lines, complex delegation chains
```

### After:
```
carnival-registry-service.ts (coordinator - 800 lines)
├─ Initializes booking office
├─ Performer detection & building
├─ Registration tracking
├─ API key management
├─ Coordinates intern
└─ No certificate methods

http-registry-service.ts (intern - 500 lines)
├─ Network protocol ONLY
├─ No initialization
├─ No detection
├─ No certificate methods
└─ Uses given dependencies

certificate-manager.ts (standalone - 400 lines)
├─ Used directly everywhere
└─ No delegation needed

Total: 3 files, 1700 lines, clear responsibilities
```

**Savings: 300 lines removed, clearer architecture** ✅

---

## 🎯 Architecture Summary

```
🎪 CarnivalRegistryService (The Booking Office Coordinator)
├─ Knows carnival infrastructure
├─ Initializes booking office
├─ Builds performer info
├─ Manages registrations
├─ Manages API keys
└─ Creates and coordinates → HttpRegistryService

📋 HttpRegistryService (The Protocol Intern)
├─ Receives dependencies from coordinator
├─ Makes HTTP calls as instructed
├─ Follows protocol
└─ Reports back to coordinator

🔒 CertificateManager (The Security Office - Standalone)
├─ Independent service
├─ Used directly by anyone
└─ No delegation

Supporting Utilities:
├─ RegistryEndpointManager (health monitoring)
├─ PersistentPerformerCache (performer caching)
└─ http-client.ts (HTTP/TLS utility)
```

---

## 🚀 Migration Order

Follow this order to minimize breaking changes:

1. ✅ **Step 3**: Rename certificate-store → certificate-manager (update imports)
2. ✅ **Step 1**: Enhance CarnivalRegistryService (add initialization & detection)
3. ✅ **Step 2**: Slim HttpRegistryService (remove initialization, update constructor)
4. ✅ **Step 1 & 2**: Remove ALL certificate methods from both services
5. ✅ **Step 4**: Update main.ts to create coordinator properly
6. ✅ **Step 5**: Update settings tab to use new architecture
7. ✅ **Step 6**: Test everything thoroughly

---

## 📝 Key Principles

### Coordinator/Intern Relationship
- **Coordinator** creates the intern and gives them tools
- **Intern** uses tools provided, doesn't initialize anything
- **Coordinator** knows about carnival infrastructure
- **Intern** knows only about HTTP protocol

### No Certificate Delegation
- **CertificateManager** is standalone
- Import and use directly: `import { certificateManager } from './certificate-manager'`
- No methods on registry services
- Clear separation of concerns

### Dependency Injection
- **Coordinator** passes dependencies to intern via constructor
- No shared state between coordinator and intern
- Testable in isolation

---

## ✅ Completion Checklist

- [ ] Step 1: Enhanced CarnivalRegistryService with initialization
- [ ] Step 1: Added performer detection to CarnivalRegistryService
- [ ] Step 1: Added API key management to CarnivalRegistryService
- [ ] Step 2: Slimmed HttpRegistryService to protocol only
- [ ] Step 2: Updated HttpRegistryService constructor (dependency injection)
- [ ] Step 3: Renamed certificate-store.ts → certificate-manager.ts
- [ ] Step 3: Updated all certificate imports
- [ ] Removed ALL certificate methods from CarnivalRegistryService
- [ ] Removed ALL certificate methods from HttpRegistryService
- [ ] Step 4: Updated main.ts initialization
- [ ] Step 5: Updated settings tab
- [ ] Step 6: Tested all functionality
- [ ] Documentation: Updated README/docs
- [ ] Git: Committed changes with descriptive message

---

**End of Refactoring Plan** 🎪✨

## 🎭 The Perfect Metaphor

```
        🎪 The Booking Office
    ┌─────────────────────────┐
    │ CarnivalRegistryService │
    │  (The Coordinator)      │
    │                         │
    │ • Sets up office        │
    │ • Builds performer info │
    │ • Manages registrations │
    │ • Manages API keys      │
    └───────────┬─────────────┘
                │ creates & coordinates
                ↓
        📋 The Intern
    ┌─────────────────────────┐
    │  HttpRegistryService    │
    │  (Protocol Worker)      │
    │                         │
    │ • Makes HTTP calls      │
    │ • Follows protocol      │
    │ • Uses given tools      │
    └─────────────────────────┘

    🔒 Security Office (Independent)
    ┌─────────────────────────┐
    │   CertificateManager    │
    │   (Standalone)          │
    │                         │
    │ • Used directly         │
    │ • No delegation         │
    └─────────────────────────┘
```