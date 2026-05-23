/**
 * ============================================================================
 * TERRITORY MANAGEMENT TYPES
 * ============================================================================
 * 
 * Types for managing custom territories and performer assignments.
 * 
 * Index of exports:
 * - DEFAULT_TERRITORY_CONFIG
 * - AssignPerformerRequest
 * - CreateTerritoryRequest
 * - PerformerTerritoryInfo
 * - TerritoryAssignment
 * - TerritoryCacheConfig
 * - TerritorySummary
 * - TerritoryWithCount
 * - UpdateTerritoryRequest
 */

import { Territory } from "./carnival-grounds-types";

export const DEFAULT_TERRITORY_CONFIG: TerritoryCacheConfig = {
	persistenceKey: 'carnival-territories',
	backgroundSaveEnabled: true,
	backgroundSaveIntervalMs: 5 * 60 * 1000, // 5 minutes
	compressionEnabled: true
};

/**
 * Performer territory assignment request
 * Used when assigning a performer to territories
 */
export interface AssignPerformerRequest {
	/** Performer ID */
	performerId: string;
	/** Territory names to assign to */
	territories: string[];
	/** Primary territory (must be in territories list) */
	primaryTerritory: string;
}

/**
 * Territory creation request
 * Used when creating a new territory
 */
export interface CreateTerritoryRequest {
	/** Territory name (unique identifier) */
	name: string;
	/** Optional description */
	description?: string;
	/** Optional metadata */
	metadata?: Record<string, unknown>;
}

/**
 * Performer's territory information
 */
export interface PerformerTerritoryInfo {
	performerId: string;
	primary: Territory;
	all: Territory[];
	territoryNames: string[];
}

/**
 * Territory assignment data structure
 */
export interface TerritoryAssignment {
	/** Performer ID */
	performerId: string;
	/** List of assigned territory names */
	territories: string[];
	/** Primary territory (first in list) */
	primaryTerritory: string;
	/** When assignment was created */
	createdAt: string;
	/** When assignment was last updated */
	updatedAt: string;
}

/**
 * Cache configuration for territory storage
 */
export interface TerritoryCacheConfig {
	/** Storage key for territories */
	persistenceKey: string;
	/** Enable background auto-save */
	backgroundSaveEnabled: boolean;
	/** Background save interval (ms) */
	backgroundSaveIntervalMs: number;
	/** Enable compression */
	compressionEnabled: boolean;
}

/**
 * Territory summary with performers
 */
export interface TerritorySummary {
	territory: Territory;
	performerIds: string[];
	performerCount: number;
}

/**
 * Territory with current performer count
 */
export interface TerritoryWithCount {
	territory: Territory;
	performerCount: number;
}

/**
 * Territory update request
 * Used when modifying an existing territory
 */
export interface UpdateTerritoryRequest {
	/** Territory name to update */
	name: string;
	/** New description (optional) */
	description?: string;
	/** New metadata (optional) */
	metadata?: Record<string, unknown>;
}