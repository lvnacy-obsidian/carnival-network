# Problem Statement
The settings\-tab\.ts contains 6 `as any` type casts when calling `applyObservabilityConfig()`\. Additionally, the Status tab references several methods and properties that don't exist on the plugin:
* Missing methods: `refreshNetworkStatus()`, `startAutoRefresh()`, `stopAutoRefresh()`, `flushCache()`, `clearCache()`, `disconnectNetwork()`
* Missing properties: `networkStatus`, `circuitBreakerStatus`, `registryMetrics`, `certificateHealth`, `cacheStats`, `networkTopology`
# Current State
## Exists in carnival\-troupe\-manager\.ts
* `applyObservabilityConfig()` \- ✅ exported function
* `setRegistryEndpoints()` \- ✅ exported function
* `initializeAPIRouter()` \- ✅ exported function
* `joinCarnival()` \- ✅ exported function
* `leaveCarnival()` \- ✅ exported function
* `getPerformers()` \- ✅ exported function
* `hasPerformer()` \- ✅ exported function
## Exists in main\.ts
* `applyObservabilityConfig()` \- ✅ properly delegates to troupe manager
* `joinCarnival()` \- ✅ properly delegates to troupe manager
* `leaveCarnival()` \- ✅ properly delegates to troupe manager
* All Status tab methods/properties \- ❌ missing
## Current settings\-tab\.ts Issues
* Lines 799, 818, 830, 845, 858, 871: use `const typedPlugin = this.plugin as any;` before calling `applyObservabilityConfig()`
* Lines 937\-1278: already use `const typedPlugin = this.plugin;` \(no cast\) with optional chaining for missing methods
# Proposed Changes
## 1\. Create Status Service Module
Create `src/network/services/status-service.ts` to centralize status tracking logic:
* Export functions for all missing methods
* Maintain status state that can be queried
* Use `this` context bound to CarnivalNetworkPlugin
## 2\. Add Type Definitions
Create `src/types/status-types.ts` for status\-related interfaces:
* `NetworkStatus` \- status, territories, uptimeMs, errorRate
* `CircuitBreakerStatus` \- endpoint states map
* `RegistryMetrics` \- totalRequests, successes, failures, successRate
* `CertificateHealth` \- total, healthy, expiring, expired, revoked
* `CacheStats` \- size, hits, misses, memoryUsage
* `NetworkTopology` \- territories\[\], capabilities\[\]
## 3\. Update main\.ts
Add to CarnivalNetworkPlugin class:
* Import all status functions from status\-service\.ts
* Add delegating methods for all 6 missing methods
* Add getter properties for all 6 missing properties
* Add required instance variables: `autoRefreshInterval`, `startTime`
## 4\. Update settings\-tab\.ts
Remove all 6 `as any` casts:
* Lines 799, 818, 830, 845, 858, 871
* Change from `const typedPlugin = this.plugin as any;` to `const typedPlugin = this.plugin;`
* No other changes needed \(Status tab already uses proper optional chaining\)
# Implementation Details
## status\-service\.ts Functions
### getNetworkStatus\(\): NetworkStatus
* Aggregate status from activePerformers map
* Calculate uptime from plugin startTime
* Return computed status object
### refreshNetworkStatus\(\): Promise<void>
* Query each active performer for status updates
* Update cached status data
* Called by UI refresh button
### startAutoRefresh\(\): void
* Start 30\-second interval for status refresh
* Store interval ID on plugin instance
* Use optional chaining when calling refresh
### stopAutoRefresh\(\): void
* Clear the auto\-refresh interval
* Set interval ID to undefined
### flushCache\(\): Promise<void>
* Stub implementation for now
* TODO: Implement cache flush logic when cache exists
### clearCache\(\): Promise<void>
* Stub implementation for now
* TODO: Implement cache clear logic when cache exists
### disconnectNetwork\(\): Promise<void>
* Iterate over all active performers
* Call leaveCarnival\(\) for each performer
* Clear all connections
### Getter functions for properties
Each returns current state or empty defaults:
* `getCircuitBreakerStatus()` \- return empty object \(TODO\)
* `getRegistryMetrics()` \- return empty object \(TODO\)
* `getCertificateHealth()` \- return empty object \(TODO\)
* `getCacheStats()` \- return empty object \(TODO\)
* `getNetworkTopology()` \- return empty object \(TODO\)
# Architectural Principle
**main\.ts IS FOR PLUGIN LIFECYCLE ONLY**
* main\.ts should only contain: onload\(\), onunload\(\), loadSettings\(\), saveSettings\(\)
* All business logic lives in separate modules \(troupe\-manager, status\-service, etc\.\)
* main\.ts delegates to these modules using function binding pattern
* This keeps the plugin class clean and maintains separation of concerns
