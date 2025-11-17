/**
 * ============================================================================
 * CARNIVAL PERFORMER INTERFACE
 * ============================================================================
 * 
 * This is the Network Client Interface
 * 'Client' → 'Performer'
 * These are, in essence, the nodes of the network, the performers of the 
 * troupe. 
 * `CarnivalPerformer` implements the `CarnivalPerformerInterface`
 * 
 * Index of exports:
 * - CarnivalPerformerInterface - Main interface for consuming plugins to interact 
 *      with the Carnival Network
 * - GuestPerformer - Structure representing an external client
 */

import {
	CarnivalConfig,
} from './carnival-configuration-types';
import {
	RegistryEntry
} from './carnival-grounds-types';
import { PerformanceStatus } from './carnival-performers-types';
import {
	ActServiceInterface,
	QueryServiceInterface,
	TerritoryServiceInterface
} from './carnival-service-types';
import {
	ActCountOptions,
	ActQueryOptions,
	CarnivalAct,
} from './acts-types';
import {
	SearchOptions,
	SearchResult
} from './search-types';

/**
 * Main interface for consuming plugins to interact with the Carnival Network
 */
export interface CarnivalPerformerInterface {
	// Lifecycle - The Show Must Go On!
	enterRing(): Promise<void>; // Initialize
	leaveRing(): Promise<void>; // Cleanup
	isPerforming(): boolean; // Check if initialized

	// Territory Management - Setting Up Tents
	establishTerritory(territory: string): Promise<void>;
	scoutTerritories(territory: string): Promise<RegistryEntry[]>;
	updatePerformanceStatus(status: Partial<PerformanceStatus>): Promise<void>;

	// Record Operations - The Acts
	broadcastAct(act: CarnivalAct): Promise<void>;
	queryActs(options: ActQueryOptions): Promise<CarnivalAct[]>;
	countActs(options: ActCountOptions): Promise<number>;
	searchCarnival(options: SearchOptions): Promise<SearchResult[]>;

	// Service access (backstage access for advanced performers)
	getTerritoryService(): TerritoryServiceInterface;
	getQueryService(): QueryServiceInterface;
	getActService(): ActServiceInterface;

	// Configuration - Show Settings
	getShowConfiguration(): CarnivalConfig;
	updateShowConfiguration(config: Partial<CarnivalConfig>): void;
}

export interface GuestPerformer {
	id: string;
	type: string;  // Integration type (e.g., 'discord', 'webhook', 'github', etc.)
	permissions: string[];
	expiresAt: string;
	rateLimits: { [operation: string]: number };
	metadata?: {
		apiKey?: string;  // Hashed
		authenticatedAt?: string;
		lastUsed?: string;
	};
};
