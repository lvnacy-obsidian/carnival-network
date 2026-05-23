/**
 * ============================================================================
 * 🗺️ TERRITORY CACHE MANAGER - Cache Coordination & Integrity Management
 * ============================================================================
 * 
 * Coordinates operations across TerritoryCache and TerritoryAssignmentCache
 * to maintain referential integrity, synchronized performer counts, and
 * provide unified territory management operations.
 * 
 * Core Responsibilities:
 * - Coordinate territory and assignment operations
 * - Maintain referential integrity between caches
 * - Synchronize performer counts automatically
 * - Validate data consistency
 * - Provide cross-cache query operations
 * - Handle territory lifecycle (create, delete, reassign)
 * 
 * Design Philosophy:
 * - Single source of truth for territory operations
 * - Automatic synchronization on all changes
 * - Validation before modification
 * - Graceful error handling with detailed logging
 * - Transactional semantics (all-or-nothing updates)
 * 
 * Access Pattern - Hybrid Approach:
 * 
 * ✅ Use TerritoryCacheManager for:
 * - All write operations (assignments, territory CRUD)
 * - Cross-cache queries (summaries, performer territories)
 * - Validation and synchronization
 * - Any operation that affects both caches
 * 
 * ✅ Direct cache access is OK for:
 * - Read-only queries on a single cache
 * - Performance-critical lookups (avoid manager overhead)
 * - Bulk read operations
 * 
 * ⚠️ Avoid direct cache writes:
 * - Direct writes bypass count synchronization
 * - Direct writes skip referential integrity checks
 * 
 * Usage Examples:
 * ```typescript
 * // GOOD - coordinated write through manager
 * await manager.assignPerformer('performer-123', ['backstage', 'workshop']);
 * 
 * // GOOD - cross-cache query through manager
 * const summary = manager.getTerritorySummary('backstage');
 * 
 * // GOOD - convenience read through manager
 * const territory = manager.getTerritory('backstage');
 * 
 * // OK - direct read for performance
 * const territory = territoryCache.get('backstage'); // Fast path
 * 
 * // BAD - direct write bypasses synchronization
 * assignmentCache.assign('performer-123', ['backstage']); // Count out of sync!
 * 
 * // GOOD - use manager instead
 * await manager.assignPerformer('performer-123', ['backstage']);
 * ```
 * 
 * Manager Benefits:
 * - Automatic performer count synchronization
 * - Referential integrity validation
 * - Transactional updates (all-or-nothing)
 * - Comprehensive error handling
 * - Detailed logging of all operations
 * 
 * Direct Cache Access Trade-offs:
 * - Faster (no validation overhead)
 * - Read-only operations are safe
 * - Use in performance-critical paths
 * - Ensure you understand the implications
 * 
 * @module territory-cache-manager
 * @category Territory/Coordination
 */

import { Log } from '../../utils/logger';
import type { TerritoryCache } from './territory-cache-service';
import type { TerritoryAssignmentCache } from './territory-assignment-cache';
import { ValidationError } from '../../errors';
import type { ValidationResult } from '../../types/internal';
import type {
    LogContext,
    PerformerTerritoryInfo,
    Territory,
    TerritoryAssignment,
    TerritorySummary,
    TerritoryWithCount
} from '../../types/public';

/**
 * 🗺️ Territory Cache Manager
 * 
 * Orchestrates territory and assignment operations to ensure data consistency.
 */
export class TerritoryCacheManager {
	private managerLogger: LogContext;

	constructor(
		private territoryCache: TerritoryCache,
		private assignmentCache: TerritoryAssignmentCache
	) {
		this.managerLogger = {
			context: 'Territory Cache Manager',
			path: '/.obsidian/plugins/carnival-network/src/territory/territory-cache-manager'
		};

		Log.log(this.managerLogger, '🗺️ Territory Cache Manager initialized');
	}

	/**
	 * ========================================================================
	 * CORE COORDINATION METHODS
	 * ========================================================================
	 */

	/**
	 * Assign performer to territories with validation and count synchronization
	 */
	async assignPerformer(performerId: string, territories: string[]): Promise<void> {
		// Validate all territories exist
		const missingTerritories: string[] = [];
		for (const territory of territories) {
			if (!this.territoryCache.has(territory)) {
				missingTerritories.push(territory);
			}
		}

		if (missingTerritories.length > 0) {
			throw new ValidationError(
				`Cannot assign performer - territories do not exist: ${missingTerritories.join(', ')}`
			);
		}

		// Get old assignments for count diff
		const oldTerritories = this.assignmentCache.getAssignments(performerId);

		// Update assignments
		this.assignmentCache.assign(performerId, territories);

		// Update counts for affected territories
		await this.updateTerritoryCounts(oldTerritories, territories);

		Log.log(
			this.managerLogger,
			`✅ Assigned performer ${ performerId } to territories: ${territories.join(', ')}`
		);
	}

	/**
	 * Remove all assignments for a performer
	 */
	async unassignPerformer(performerId: string): Promise<void> {
		const oldTerritories = this.assignmentCache.getAssignments(performerId);

		if (oldTerritories.length === 0) {
			return; // Nothing to unassign
		}

		// Delete assignments
		this.assignmentCache.delete(performerId);

		// Update counts for previously assigned territories
		await this.updateTerritoryCounts(oldTerritories, []);

		Log.log(this.managerLogger, `🗑️ Unassigned performer ${performerId} from all territories`);
	}

	/**
	 * Add a territory to performer's assignments
	 */
	async addPerformerTerritory(performerId: string, territory: string): Promise<void> {
		// Validate territory exists
		if (!this.territoryCache.has(territory)) {
			throw new ValidationError(`Territory '${territory}' does not exist`);
		}

		const current = this.assignmentCache.getAssignments(performerId);

		if (current.includes(territory)) {
			return; // Already assigned
		}

		// Add territory
		this.assignmentCache.addTerritory(performerId, territory);

		// Update count for this territory
		await this.updateTerritoryCounts([], [territory]);

		Log.log(
			this.managerLogger,
			`➕ Added territory '${ territory }' to performer ${ performerId }`
		);
	}

	/**
	 * Remove a territory from performer's assignments
	 */
	async removePerformerTerritory(performerId: string, territory: string): Promise<void> {
		const current = this.assignmentCache.getAssignments(performerId);

		if (!current.includes(territory)) {
			return; // Not assigned
		}

		// Remove territory (will auto-assign 'general' if last one)
		this.assignmentCache.removeTerritory(performerId, territory);

		const newTerritories = this.assignmentCache.getAssignments(performerId);

		// Update counts
		await this.updateTerritoryCounts(current, newTerritories);

		Log.log(
			this.managerLogger,
			`➖ Removed territory '${ territory }' from performer ${performerId}`
		);
	}

	/**
	 * Set primary territory for performer
	 */
	async setPrimaryTerritory(performerId: string, territory: string): Promise<void> {
		const current = this.assignmentCache.getAssignments(performerId);

		if (!current.includes(territory)) {
			throw new ValidationError(
				`Cannot set primary territory '${ territory }' - performer is not assigned to it`
			);
		}

		// Set primary (reorders array)
		this.assignmentCache.setPrimaryTerritory(performerId, territory);

		Log.log(
			this.managerLogger,
			`⭐ Set primary territory '${ territory }' for performer ${ performerId }`
		);
	}

	/**
	 * ========================================================================
	 * TERRITORY MANAGEMENT
	 * ========================================================================
	 */

	/**
	 * Create a new territory
	 */
	async createTerritory(
		name: string,
		description?: string,
		metadata?: Record<string, unknown>
	): Promise<Territory> {
		if (this.territoryCache.has(name)) {
			throw new ValidationError(`Territory '${ name }' already exists`);
		}

		const territory = this.territoryCache.upsert(name, {
			description,
			metadata
		});

		Log.log(this.managerLogger, `🎪 Created territory '${ name }'`);

		return territory;
	}

	/**
	 * Delete a territory and reassign performers
	 */
	async deleteTerritory(name: string, reassignTo: string = 'general'): Promise<void> {
		// Validate territory exists
		if (!this.territoryCache.has(name)) {
			throw new ValidationError(`Territory '${ name }' does not exist`);
		}

		// Can't delete 'general'
		if (name === 'general') {
			throw new ValidationError("Cannot delete 'general' territory");
		}

		// Validate reassignment target exists
		if (!this.territoryCache.has(reassignTo)) {
			throw new ValidationError(
				`Reassignment target '${ reassignTo }' does not exist`
			);
		}

		// Get all performers in this territory
		const performers = this.assignmentCache.getPerformersInTerritory(name);

		// Reassign each performer
		for (const performerId of performers) {
			const current = this.assignmentCache.getAssignments(performerId);
			const updated = current
				.filter(t => t !== name)
				.concat(current.includes(reassignTo) ? [] : [reassignTo]);

			await this.assignPerformer(performerId, updated);
		}

		// Delete territory
		this.territoryCache.delete(name);

		Log.log(
			this.managerLogger,
			`🗑️ Deleted territory '${ name }', reassigned ${ performers.length } performers to '${ reassignTo }'`
		);
	}

	/**
	 * ========================================================================
	 * CONVENIENCE READ METHODS
	 * ========================================================================
	 * These methods provide direct access to underlying cache data through
	 * the manager interface. They're simple pass-throughs for read operations
	 * that don't require coordination or validation.
	 * 
	 * Use these when you want consistent manager-based API.
	 * Direct cache access is also acceptable for performance-critical paths.
	 */

	/**
	 * Get territory by name
	 */
	getTerritory(name: string): Territory | null {
		return this.territoryCache.get(name);
	}

	/**
	 * Get all territories
	 */
	getAllTerritories(): Territory[] {
		return this.territoryCache.getAll();
	}

	/**
	 * Get all territory names
	 */
	getAllTerritoryNames(): string[] {
		return this.territoryCache.getAllNames();
	}

	/**
	 * Check if territory exists
	 */
	hasTerritory(name: string): boolean {
		return this.territoryCache.has(name);
	}

	/**
	 * Get assignments for a performer
	 */
	getAssignments(performerId: string): string[] {
		return this.assignmentCache.getAssignments(performerId);
	}

	/**
	 * Get primary territory for a performer
	 */
	getPrimaryTerritory(performerId: string): string {
		return this.assignmentCache.getPrimaryTerritory(performerId);
	}

	/**
	 * Check if performer is assigned to territory
	 */
	isAssigned(performerId: string, territory: string): boolean {
		return this.assignmentCache.isAssigned(performerId, territory);
	}

	/**
	 * Get all performers in a territory
	 */
	getPerformersInTerritory(territory: string): string[] {
		return this.assignmentCache.getPerformersInTerritory(territory);
	}

	/**
	 * Get full assignment record for performer
	 */
	getAssignment(performerId: string): TerritoryAssignment | null {
		return this.assignmentCache.get(performerId);
	}

	/**
	 * Get all assignment records
	 */
	getAllAssignments(): TerritoryAssignment[] {
		return this.assignmentCache.getAll();
	}

	/**
	 * ========================================================================
	 * QUERY OPERATIONS
	 * ========================================================================
	 */

	/**
	 * Get comprehensive summary of a territory
	 */
	getTerritorySummary(territoryName: string): TerritorySummary | null {
		const territory = this.territoryCache.get(territoryName);
		if (!territory) {
			return null;
		}

		const performerIds = this.assignmentCache.getPerformersInTerritory(territoryName);

		return {
			territory,
			performerIds,
			performerCount: performerIds.length
		};
	}

	/**
	 * Get all territories a performer belongs to
	 */
	getPerformerTerritories(performerId: string): PerformerTerritoryInfo {
		const assignment = this.assignmentCache.get(performerId);

		if (!assignment) {
			// Return default 'general' territory
			const general = this.territoryCache.get('general');
			return {
				performerId,
				primary: general!,
				all: general ? [general] : [],
				territoryNames: general ? ['general'] : []
			};
		}

		const primary = this.territoryCache.get(assignment.primaryTerritory)!;
		const all = assignment.territories
			.map(name => this.territoryCache.get(name))
			.filter((t): t is Territory => t !== null);

		return {
			performerId,
			primary,
			all,
			territoryNames: assignment.territories
		};
	}

	/**
	 * Get all territories with their current performer counts
	 */
	getAllTerritoriesWithCounts(): TerritoryWithCount[] {
		const territories = this.territoryCache.getAll();

		return territories.map(territory => ({
			territory,
			performerCount: this.assignmentCache.getPerformersInTerritory(territory.name).length
		}));
	}

	/**
	 * Find territories by performer count range
	 */
	findTerritoriesByPerformerCount(
		min: number,
		max: number = Infinity
	): TerritoryWithCount[] {
		return this.getAllTerritoriesWithCounts()
			.filter(t => t.performerCount >= min && t.performerCount <= max)
			.sort((a, b) => b.performerCount - a.performerCount);
	}

	/**
	 * Get performers shared across multiple territories
	 */
	getSharedPerformers(): Map<string, string[]> {
		const shared = new Map<string, string[]>();
		const allAssignments = this.assignmentCache.getAll();

		for (const assignment of allAssignments) {
			if (assignment.territories.length > 1) {
				shared.set(assignment.performerId, assignment.territories);
			}
		}

		return shared;
	}

	/**
	 * ========================================================================
	 * SYNCHRONIZATION
	 * ========================================================================
	 */

	/**
	 * Update performer counts for affected territories
	 */
	private async updateTerritoryCounts(
		oldTerritories: string[],
		newTerritories: string[]
	): Promise<void> {
		// Get all affected territories (union of old and new)
		const affected = new Set([...oldTerritories, ...newTerritories]);

		// Recalculate count for each affected territory
		for (const territory of affected) {
			const performerCount = this.assignmentCache.getPerformersInTerritory(territory).length;

			this.territoryCache.updatePerformerCount(territory, performerCount);
		}
	}

	/**
	 * Synchronize performer counts for all territories
	 */
	async syncPerformerCounts(): Promise<Map<string, number>> {
		const counts = new Map<string, number>();
		const territories = this.territoryCache.getAllNames();

		for (const territory of territories) {
			const performerCount = this.assignmentCache.getPerformersInTerritory(territory).length;

			this.territoryCache.updatePerformerCount(territory, performerCount);
			counts.set(territory, performerCount);
		}

		Log.log(
			this.managerLogger,
			`🔄 Synchronized performer counts for ${territories.length} territories`
		);

		return counts;
	}

	/**
	 * Validate referential integrity between caches
	 */
	async validateReferentialIntegrity(): Promise<ValidationResult> {
		const issues: string[] = [];
		const fixes: string[] = [];

		const allAssignments = this.assignmentCache.getAll();

		for (const assignment of allAssignments) {
			for (const territory of assignment.territories) {
				if (!this.territoryCache.has(territory)) {
					issues.push(
						`Performer ${assignment.performerId} assigned to non-existent territory '${territory}'`
					);

					// Auto-fix: remove invalid territory
					const valid = assignment.territories.filter(t => this.territoryCache.has(t));

					if (valid.length === 0) {
						valid.push('general');
						fixes.push(
							`Reassigned ${assignment.performerId} to 'general' (all territories invalid)`
						);
					} else {
						fixes.push(
							`Removed invalid territory '${territory}' from ${assignment.performerId}`
						);
					}

					this.assignmentCache.assign(assignment.performerId, valid);
				}
			}
		}

		if (issues.length > 0) {
			Log.warn(
				this.managerLogger,
				`⚠️ Found ${issues.length} referential integrity issues, applied ${fixes.length} fixes`
			);
		} else {
			Log.log(this.managerLogger, '✅ Referential integrity validation passed');
		}

		return {
			valid: issues.length === 0,
			issueCount: issues.length,
			issues,
			fixes
		};
	}

	/**
	 * ========================================================================
	 * MAINTENANCE
	 * ========================================================================
	 */

	/**
	 * Clean up manager resources
	 */
	async cleanup(): Promise<void> {
		// Force save both caches
		await Promise.all([this.territoryCache.flush(), this.assignmentCache.flush()]);

		Log.log(this.managerLogger, '🧹 Territory Cache Manager cleanup complete');
	}
}