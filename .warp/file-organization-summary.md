# 🎪 Carnival Network - Complete File Organization

## ✅ Core Files (Complete & Separated)

### Plugin Entry Point
- **`src/main.ts`** ✅ COMPLETE
  - Main plugin class `CarnivalNetworkPlugin`
  - Public API: `joinCarnival()`, `getPerformers()`, `leaveCarnival()`
  - Manages active troupes (client instances)
  - Verifies dependencies

### Type Definitions
- **`src/types/index.ts`** ✅ COMPLETE
  - Public API types with carnival terminology
  - `CarnivalPerformerInterface` interface
  - `CarnivalConfig`, `CarnivalAct`, `RegistryEntry`
  - Service interfaces: `TerritoryServiceInterface`, `QueryServiceInterface`, `ActServiceInterface`
  
- **`src/types/internal.ts`** ✅ COMPLETE
  - Internal implementation types
  - Circuit breaker, HTTP client, rate limiter types
  - Not exposed to consuming plugins

### Network Client
- **`src/network/carnival-network-client.ts`** ✅ COMPLETE
  - Main client implementation
  - Lifecycle: `enterRing()`, `leaveRing()`, `isPerforming()`
  - Territory management: `establishTerritory()`, `scoutTerritories()`
  - Act operations: `broadcastAct()`, `queryActs()`, `searchCarnival()`
  - Backstage access to services
  - Complete with all helper methods

### Files to Remove
- ❌ **`src/network/network-client.ts`** - DELETE (generic wrapper not needed)

## 🚧 Files That Need Refactoring

### Services (Rename & Update Imports)
These files exist but need carnival theme applied:

1. **`src/network/services/record-service.ts`** → **`act-service.ts`**
   - Rename class: `RecordService` → `ActService`
   - Update method names: `createRecord()` → `createAct()`, etc.
   - Update type imports: `CrossVaultRecord` → `CarnivalAct`

2. **`src/network/services/registry-access-service.ts`** → **`territory-access-service.ts`**
   - Rename class: `RegistryAccessService` → `PerformerAccessService`
   - Update type imports: `RegistryNode` → `RegistryEntry`

3. **`src/network/services/network-query-service.ts`** → **`carnival-query-service.ts`**
   - Rename class: `NetworkQueryService` → `CarnivalQueryService`
   - Update method terminology

4. **`src/network/services/rate-limiter.ts`** ✅ (probably fine as-is)

5. **`src/network/services/webhook-verifier.ts`** ✅ (probably fine as-is)

### Core Network Files (Update Imports)
These files probably work but need type import updates:

1. **`src/network/http-registry-service.ts`**
   - Update imports from `../types`
   - Change `RegistryNode` → `RegistryEntry` references

2. **`src/network/http-client.ts`**
   - Update type imports

3. **`src/network/http-network-protocol.ts`**
   - Update type imports

4. **`src/network/circuit-breaker.ts`**
   - Update imports from `../types/internal`

5. **`src/network/persistent-performer-cache.ts`**
   - Update type imports

6. **`src/network/registry-endpoint-manager.ts`**
   - Update type imports

7. **`src/network/certificate-store.ts`**
   - Update type imports

8. **`src/network/validation.ts`**
   - Update type imports

9. **`src/network/settings-validation.ts`**
   - Update type imports

### Utilities
1. **`src/network/utils/certificates.ts`** - Update imports
2. **`src/network/utils/client-authentication.ts`** - Update imports

### Handlers (White-Label)
Need to genericize and add carnival theme:

1. **`src/network/handlers/webhook-handlers.ts`**
   - Create base `IWebhookHandler` interface
   - Add carnival-themed logging

2. **`src/network/handlers/discord-handlers.ts`** → **`discord-webhook-handler.ts`**
   - Implement `IWebhookHandler`
   - Rename: `DiscordHandlers` → `DiscordWebhookHandler`
   - Update to work with `CarnivalAct`

3. **`src/network/handlers/auth-handlers.ts`**
   - Update type imports
   - Add carnival logging

4. **`src/network/handlers/search-handlers.ts`**
   - Update type imports
   - Add carnival logging

5. **`src/network/handlers/error-handler.ts`**
   - Update type imports
   - Add carnival-themed error messages

## 🎨 UI Files (Need Creation)

1. **`src/ui/settings-tab.ts`** - NEEDS CREATION
   - Display registered performers
   - Show network statistics
   - Configuration options

## 🛠️ Utility Files

1. **`src/utils/logger.ts`** - Probably exists, verify it works with carnival theme

## 📄 Configuration Files

These should already exist from the GitHub repo:
- ✅ `manifest.json`
- ✅ `package.json`
- ✅ `tsconfig.json`
- ✅ `esbuild.config.mjs`
- ✅ `eslint.config.js`

## 🎯 Next Steps Priority

1. **Delete** `src/network/network-client.ts` (generic wrapper)
2. **Rename services** (record → act, registry → territory, etc.)
3. **Update all imports** in existing files to use `../types`
4. **Add carnival logging** throughout (🎪 🎭 🎉 emojis)
5. **Create settings tab UI**
6. **Test compilation**
7. **Test with Carnival Records**

## 📝 File Structure Summary

```
carnival-network/
├── src/
│   ├── main.ts                    ✅ COMPLETE
│   ├── types/
│   │   ├── index.ts               ✅ COMPLETE
│   │   └── internal.ts            ✅ COMPLETE
│   ├── network/
│   │   ├── carnival-network-client.ts  ✅ COMPLETE
│   │   ├── http-registry-service.ts    🚧 UPDATE IMPORTS
│   │   ├── http-client.ts              🚧 UPDATE IMPORTS
│   │   ├── http-network-protocol.ts    🚧 UPDATE IMPORTS
│   │   ├── circuit-breaker.ts          🚧 UPDATE IMPORTS
│   │   ├── persistent-performer-cache.ts    🚧 UPDATE IMPORTS
│   │   ├── registry-endpoint-manager.ts 🚧 UPDATE IMPORTS
│   │   ├── certificate-store.ts        🚧 UPDATE IMPORTS
│   │   ├── validation.ts               🚧 UPDATE IMPORTS
│   │   ├── settings-validation.ts      🚧 UPDATE IMPORTS
│   │   ├── utils/
│   │   │   ├── certificates.ts         🚧 UPDATE IMPORTS
│   │   │   └── client-authentication.ts 🚧 UPDATE IMPORTS
│   │   ├── services/
│   │   │   ├── act-service.ts          🔄 RENAME & UPDATE
│   │   │   ├── territory-access-service.ts 🔄 RENAME & UPDATE
│   │   │   ├── carnival-query-service.ts 🔄 RENAME & UPDATE
│   │   │   ├── rate-limiter.ts         🚧 UPDATE IMPORTS
│   │   │   └── webhook-verifier.ts     🚧 UPDATE IMPORTS
│   │   └── handlers/
│   │       ├── webhook-handlers.ts     🔄 REFACTOR
│   │       ├── discord-webhook-handler.ts 🔄 RENAME & REFACTOR
│   │       ├── auth-handlers.ts        🚧 UPDATE IMPORTS
│   │       ├── search-handlers.ts      🚧 UPDATE IMPORTS
│   │       └── error-handler.ts        🚧 UPDATE IMPORTS
│   ├── ui/
│   │   └── settings-tab.ts             ❌ CREATE
│   └── utils/
│       └── logger.ts                    ✅ (verify exists)
├── manifest.json                       ✅
├── package.json                        ✅
├── tsconfig.json                       ✅
├── esbuild.config.mjs                  ✅
└── README.md                           ❌ CREATE

Legend:
✅ Complete & ready
🚧 Exists but needs import updates
🔄 Needs rename & refactor
❌ Needs creation
```