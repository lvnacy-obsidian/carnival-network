/**
 * ============================================================================
 * CARNIVAL NETWORK CLIENT INTERFACE
 * ============================================================================
 * 
 * Index of exports:
 * - CarnivalNetworkClientInterface - Main interface for consuming plugins to interact 
 *      with the Carnival Network
 */

import {
    CarnivalConfiguration,
} from './carnival-configuration-types';
import {
    PerformanceStatus,
    TerritoryNode
} from './carnival-grounds-types';
import {
    ActServiceInterface,
    QueryServiceInterface,
    TerritoryServiceInterface
} from './carnival-service-types';
import {
    ActCountOptions,
    ActQueryOptions,
    CarnivalRecord,
} from './records-types';
import {
    SearchOptions,
    SearchResult
} from './search-types';

/**
 * Main interface for consuming plugins to interact with the Carnival Network
 */
export interface CarnivalNetworkClientInterface {
    // Lifecycle - The Show Must Go On!
    enterRing(): Promise<void>; // Initialize
    leaveRing(): Promise<void>; // Cleanup
    isPerforming(): boolean; // Check if initialized

    // Territory Management - Setting Up Tents
    establishTerritory(territory: string): Promise<void>;
    scoutTerritories(territory: string): Promise<TerritoryNode[]>;
    updatePerformanceStatus(status: Partial<PerformanceStatus>): Promise<void>;

    // Record Operations - The Acts
    broadcastAct(record: CarnivalRecord): Promise<void>;
    queryActs(options: ActQueryOptions): CarnivalRecord[];
    countActs(options: ActCountOptions): number;
    searchCarnival(options: SearchOptions): SearchResult[];

    // Service access (backstage access for advanced performers)
    getTerritoryService(): TerritoryServiceInterface;
    getQueryService(): QueryServiceInterface;
    getActService(): ActServiceInterface;

    // Configuration - Show Settings
    getShowConfiguration(): CarnivalConfiguration;
    updateShowConfiguration(config: Partial<CarnivalConfiguration>): void;
}