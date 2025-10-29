/**
 * ============================================================================
 * SERVICE INTERFACES
 * ============================================================================
 * 
 * Index of exports:
 * - ActService - handles act (record) operations
 * - QueryService - handles cross-territory queries
 * - TerritoryService - handles territory communication
 */

import {
    PerformanceStatus,
    TerritoryNode,
    TerritoryNodeInfo
} from './carnival-grounds-types';
import {
    CarnivalQuery,
    QueryResult
} from './query-types';
import {
    ActCountOptions,
    ActQueryOptions,
    CarnivalRecord,
    CreateActParams,
} from './records-types';
import {
    SearchOptions,
    SearchResult
} from './search-types';

/**
 * Act service interface - handles act (record) operations
 */
export interface ActServiceInterface {
    createAct(params: CreateActParams): CarnivalRecord;
    broadcastAct(record: CarnivalRecord): Promise<void>;
    queryActs(options: ActQueryOptions): CarnivalRecord[];
    countActs(options: ActCountOptions): number;
    performSearch(options: SearchOptions): SearchResult[];
    generateActId(): string;
    generateSummary(record: CarnivalRecord): string;
}

/**
 * Query service interface - handles cross-territory queries
 */
export interface QueryServiceInterface {
    queryTerritory(territory: string, query: CarnivalQuery): Promise<QueryResult>;
    queryAllTerritories(query: CarnivalQuery): Promise<QueryResult[]>;
    getNodeStatus(nodeId: string): Promise<PerformanceStatus | null>;
}

/**
 * Territory service interface - handles territory communication
 */
export interface TerritoryServiceInterface {
    establishTerritory(territory: string, nodeInfo: TerritoryNodeInfo): Promise<void>;
    scoutTerritories(territory: string): Promise<TerritoryNode[]>;
    sendHeartbeat(nodeId: string): Promise<void>;
    abandonTerritory(nodeId: string): Promise<void>;
    isAvailable(): boolean;
    getAllNodes(): TerritoryNode[];
}