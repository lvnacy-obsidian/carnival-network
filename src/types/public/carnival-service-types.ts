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
	RegistryEntry,
	PerformerRegistrationInfo
} from './carnival-grounds-types';
import { PerformanceStatus } from './carnival-performers-types';
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
	getPerformerStatus(performerId: string): Promise<PerformanceStatus | null>;
}

/**
 * Territory service interface - handles territory communication
 */
export interface TerritoryServiceInterface {
	establishTerritory(territory: string, performerInfo: PerformerRegistrationInfo): Promise<void>;
	scoutTerritories(territory: string): Promise<RegistryEntry[]>;
	sendHeartbeat(performerId: string): Promise<void>;
	abandonTerritory(performerId: string): Promise<void>;
	isAvailable(): boolean;
	getAllPerformers(): RegistryEntry[];
}