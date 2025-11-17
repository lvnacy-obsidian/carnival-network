/**
 * ============================================================================
 * TERRITORY ACCESS SERVICE - Read-Only Performer Cache Access
 * ============================================================================
 * 
 * Provides centralized, read-only access to the performer cache with convenient
 * query methods. Acts as a façade over PersistentPerformerCache, offering
 * filtering, aggregation, and transformation operations without exposing cache
 * mutation methods to services that only need to read performer data.
 * 
 * Core Responsibilities:
 * - Read-only performer queries
 * - Territory-based filtering
 * - Capability-based filtering
 * - Performer counting and aggregation
 * - Cache availability checking
 * - Performer → RegistryEntry transformation
 * 
 * Architecture:
 * - Wraps PersistentPerformerCache (no direct cache access for consumers)
 * - Provides query-oriented API (no set/delete/update methods)
 * - Transforms Performer (full) → RegistryEntry (lightweight) for network operations
 * - Used by services that need performer discovery (ActService, CarnivalQueryService)
 * 
 * Exports:
 * - TerritoryAccessService (class) - Read-only cache access facade
 * 
 * Public API Methods:
 * 
 * Query Methods:
 * - getAllPerformers(): RegistryEntry[]
 *   Returns all cached performers as lightweight RegistryEntry objects
 *   Filters: None (returns all)
 *   Transformation: Performer → RegistryEntry
 *   Use: Broadcasting, topology mapping, analytics
 * 
 * - getAllTerritories(): string[]
 *   Returns unique list of all territories
 *   Deduplicates performer territories
 *   Returns: Array of territory names
 *   Use: Territory enumeration, dropdown lists
 * 
 * - getPerformer(performerId: string): RegistryEntry | null
 *   Fetch single performer by ID
 *   Returns: RegistryEntry or null if not found
 *   Use: Targeted performer lookups, status checks
 * 
 * - getPerformersByTerritory(territory: string): RegistryEntry[]
 *   Filter performers by specific territory
 *   Returns: Array of performers in that territory
 *   Use: Territory-specific broadcasting, analytics
 * 
 * - getPerformersByCapability(capability: string): RegistryEntry[]
 *   Filter performers with specific capability
 *   Returns: Array of performers with that capability
 *   Use: Capability-based routing, feature discovery
 * 
 * Counting & Aggregation:
 * - getPerformerCount(): number
 *   Total count of cached performers
 *   Returns: Integer count (0 if error)
 *   Use: Metrics, topology info
 * 
 * - getPerformerCountByTerritory(): Record<string, number>
 *   Performer counts grouped by territory
 *   Returns: Map of territory → count
 *   Use: Territory analytics, load distribution
 * 
 * Utility Methods:
 * - isAvailable(): boolean
 *   Check if cache has data
 *   Returns: true if cache.size() > 0
 *   Use: Validation before operations requiring performer data
 * 
 * - clearCache(): void
 *   Clear all cached data
 *   Delegates to PersistentPerformerCache.clear()
 *   Use: Manual cache reset, testing
 * 
 * Implementation Details:
 * - Used by: ActService, CarnivalQueryService, HttpRegistryService
 * - Created in: CarnivalPerformer constructor (passed to services)
 * - No interface: Concrete implementation (not part of public API contract)
 * - Immutable: All methods return copies/new arrays (doesn't expose cache internals)
 * 
 * Dependencies:
 * - PersistentPerformerCache - Underlying cache storage
 * - Log - Error logging
 * 
 * Transformation: Performer → RegistryEntry
 * The service transforms full Performer objects (with status, plugin version, etc.)
 * into lightweight RegistryEntry objects suitable for network operations:
 * 
 * Performer (internal cache format):
 * - id, name, territory, path, status, lastSeen, capabilities, pluginVersion, metadata
 * 
 * RegistryEntry (network format):
 * - performerId, territoryName, endpoint, capabilities, lastSeen, metadata
 * 
 * Transformation logic in performerToRegistryEntry():
 * - Extracts apiHost, apiPort from metadata
 * - Constructs endpoint URL: `http://{apiHost}:{apiPort}`
 * - Maps id → performerId, territory → territoryName
 * - Preserves: capabilities, lastSeen, metadata
 * 
 * Error Handling:
 * - All methods catch and log errors
 * - Query methods return empty arrays on error
 * - Count methods return 0 on error
 * - isAvailable() returns false on error
 * - Graceful degradation (never throws)
 * 
 * Performance Characteristics:
 * - All operations are in-memory (fast)
 * - Filtering creates new arrays (O(n) operations)
 * - No I/O or network calls
 * - Suitable for frequent queries
 * - Cache lookups are O(1) (Map-based)
 * 
 * Use Cases:
 * 
 * 1. Broadcasting (ActService):
 *    getAllPerformers() → filter by targetTerritories → POST to each endpoint
 * 
 * 2. Analytics (CarnivalQueryService):
 *    getAllPerformers() → aggregate by territory/capability → generate metrics
 * 
 * 3. Territory Discovery (CarnivalPerformer):
 *    getPerformersByTerritory(territory) → list active performers
 * 
 * 4. Capability Routing:
 *    getPerformersByCapability('webhook_notifications') → send to capable performers
 * 
 * 5. Health Checks:
 *    isAvailable() → validate cache before operations
 * 
 * @see persistent-performer-cache.ts - Underlying cache implementation
 * @see carnival-grounds-types.ts - RegistryEntry type definition
 * @see carnival-performers-types.ts - Performer type definition
 * @see act-service.ts - Primary consumer (broadcasting)
 * @see carnival-query-service.ts - Primary consumer (analytics)
 */

import { Log } from '../../utils/logger';
import { PersistentPerformerCache } from '../persistent-performer-cache';
import type {
	LogContext,
	RegistryEntry
} from '../../types/public';

const territoryLogger: LogContext = {
	context: 'Territory Access Service',
	path: '/.obsidian/plugins/carnival-network/services/territory-access-service'
};

/**
 * 🎪 Provides centralized access to performer data from the cache
 * 
 * This service wraps the performer cache and provides convenient
 * query methods for accessing performer data by various criteria.
 */
export class TerritoryAccessService {
	constructor(private readonly performerCache: PersistentPerformerCache) {}

	/**
	 * Clear cached data
	 */
	clearCache(): void {
		try {
			this.performerCache.clear();
			Log.log(territoryLogger, '🎪 Cache cleared');
		} catch (error) {
			Log.error(territoryLogger, '🎪 Failed to clear cache:', error);
		}
	}

	/**
	 * Get all performers from cache as registry entries
	 */
	getAllPerformers(): RegistryEntry[] {
		try {
			const performers = this.performerCache.values();
			return performers.map(p => this.performerToRegistryEntry(p));
		} catch (error) {
			Log.error(territoryLogger, '🎪 Failed to get all performers:', error);
			return [];
		}
	}

	/**
	 * Get all unique territories
	 */
	getAllTerritories(): string[] {
		try {
			const performers = this.performerCache.values();
			const territories = new Set(performers.map(p => p.territory));
			return Array.from(territories);
		} catch (error) {
			Log.error(territoryLogger, '🎪 Failed to get territories:', error);
			return [];
		}
	}

	/**
	 * Get a specific performer by ID
	 */
	getPerformer(performerId: string): RegistryEntry | null {
		try {
			const performer = this.performerCache.get(performerId);
			return performer ? this.performerToRegistryEntry(performer) : null;
		} catch (error) {
			Log.error(territoryLogger, `🎪 Failed to get performer ${performerId}:`, error);
			return null;
		}
	}

	/**
	 * Get count of all performers
	 */
	getPerformerCount(): number {
		try {
			return this.performerCache.size();
		} catch (error) {
			Log.error(territoryLogger, '🎪 Failed to get performer count:', error);
			return 0;
		}
	}

	/**
	 * Get performers count by territory
	 */
	getPerformerCountByTerritory(): Record<string, number> {
		try {
			const performers = this.performerCache.values();
			const counts: Record<string, number> = {};
			
			for (const performer of performers) {
				counts[performer.territory] = (counts[performer.territory] || 0) + 1;
			}
			
			return counts;
		} catch (error) {
			Log.error(territoryLogger, '🎪 Failed to get performer counts by territory:', error);
			return {};
		}
	}

	/**
	 * Get performers filtered by capability
	 */
	getPerformersByCapability(capability: string): RegistryEntry[] {
		try {
			const allPerformers = this.performerCache.values();
			return allPerformers
				.filter(performer => performer.capabilities.includes(capability))
				.map(p => this.performerToRegistryEntry(p));
		} catch (error) {
			Log.error(territoryLogger, `🎪 Failed to get performers with capability ${capability}:`, error);
			return [];
		}
	}

	/**
	 * Get performers filtered by territory
	 */
	getPerformersByTerritory(territory: string): RegistryEntry[] {
		try {
			const allPerformers = this.performerCache.values();
			return allPerformers
				.filter(performer => performer.territory === territory)
				.map(p => this.performerToRegistryEntry(p));
		} catch (error) {
			Log.error(territoryLogger, `🎪 Failed to get performers for territory ${territory}:`, error);
			return [];
		}
	}

	/**
	 * Check if service is available (cache has data)
	 */
	isAvailable(): boolean {
		try {
			return this.performerCache.size() > 0;
		} catch (error) {
			Log.error(territoryLogger, '🎪 Failed to check availability:', error);
			return false;
		}
	}

	/**
	 * Convert Performer to RegistryEntry (lightweight format)
	 */
	private performerToRegistryEntry(performer: import('../../types/public').Performer): RegistryEntry {
		return {
			performerId: performer.id,
			territoryName: performer.territory,
			endpoint: `http://${performer.metadata.apiHost ?? 'localhost'}:${performer.metadata.apiPort ?? 27123}`,
			capabilities: performer.capabilities,
			lastSeen: performer.lastSeen,
			metadata: performer.metadata
		};
	}
}