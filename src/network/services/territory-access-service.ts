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