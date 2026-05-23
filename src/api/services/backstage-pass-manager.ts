/**
 * ============================================================================
 * 🎫 BACKSTAGE PASS MANAGER 🎪
 * ============================================================================
 * 
 * The carnival's credential desk! This service manages all backstage pass
 * (API key) operations - issuing, verifying, revoking, and tracking usage! 🎭
 * 
 * Key Features:
 * - 🎫 Issue backstage passes with custom permissions
 * - ✅ Verify passes and return credential context
 * - ❌ Revoke passes when no longer needed
 * - 📋 List all active passes
 * - 🕐 Track last used timestamps
 * - 🎯 Support token scoping
 * - 🔒 All data encrypted via Secure Store
 * - 📱 Desktop + mobile support
 * 
 * Architecture:
 * This manager is the single source of truth for all backstage pass
 * operations. It integrates with SecureStoreManager for encrypted storage
 * and provides a clean API for authentication middleware! 🎪✨
 * 
 * @module backstage-pass-manager
 * @category API/Services
 * @carnival-themed 🎪
 */

import { App } from 'obsidian';
import { Log } from '../../utils/logger';
import type { SecureStoreManager } from '../../utils/secure-store-manager';
import {
	type BackstagePass,
	CARNIVAL_AUTH_CONSTANTS,
	type CreateBackstagePassConfig,
	type CredentialContext,
	DEFAULT_TICKET_TIERS,
	isBackstagePassKey,
	type LogContext,
	type PerformerTitle
} from '../../types/public';

const backstagePassMgrLogger: LogContext = {
	context: 'Backstage Pass Manager',
	path: '.obsidian/plugins/carnival-network/src/api/services/backstage-pass-manager.ts'
};

/**
 * 🎪 BackstagePassManager - The credential desk! 🎫
 * 
 * Carnival metaphor: The desk at the carnival entrance where performers
 * pick up their laminated backstage passes. Each pass shows your name,
 * role, and what areas you can access! 🎭
 * 
 * Responsibilities:
 * - Issue new backstage passes with carnival_sk_* format
 * - Verify incoming passes and build credential contexts
 * - Revoke passes that are no longer valid
 * - Track usage statistics (last used, access counts)
 * - Enforce scope restrictions
 * - Manage pass lifecycle (creation → active → expired/revoked)
 */
export class BackstagePassManager {
	private app: App;
	private secureStore: SecureStoreManager;
	
	/**
	 * 🎪 Create a new Backstage Pass Manager
	 * 
	 * @param app - Obsidian App instance
	 * @param secureStore - Secure Store Manager for encrypted storage
	 */
	constructor(app: App, secureStore: SecureStoreManager) {
		this.app = app;
		this.secureStore = secureStore;
	}
	
	/**
	 * 🎫 Issue a new backstage pass (API key)
	 * 
	 * This method generates a new carnival_sk_* key, creates the backstage
	 * pass configuration, and stores it securely! 🎪✨
	 * 
	 * Carnival metaphor: Filling out the application form and receiving
	 * your laminated backstage pass from the credential desk! 📋✨
	 * 
	 * @param config - Backstage pass configuration
	 * @returns Newly issued backstage pass (key shown only once!)
	 * @throws Error if validation fails or storage error
	 */
	async issueBackstagePass(
		config: CreateBackstagePassConfig
	): Promise<BackstagePass> {
		Log.log(backstagePassMgrLogger, `🎪🎫 [Carnival] Issuing backstage pass: ${ config.name }`);
		
		// 🔍 Validate configuration
		this.validatePassConfig(config);
		
		// ✨ Generate unique pass ID and secure key
		const passId = this.generatePassId();
		const passKey = this.generatePassKey();
		
		// 📅 Calculate expiration if specified
		const expiresAt = config.expiresInHours
			? new Date(Date.now() + config.expiresInHours * 60 * 60 * 1000).toISOString()
			: undefined;
		
		// 🎫 Create backstage pass object
		const pass: BackstagePass = {
			id: passId,
			key: passKey,
			name: config.name,
			performerTitle: config.performerTitle,
			backstageAccess: config.backstageAccess,
			scope: config.scope,
			createdAt: new Date().toISOString(),
			expiresAt,
			metadata: config.metadata
		};
		
		// 💾 Store in secure vault
		await this.saveBackstagePass(pass);
		
		Log.log(backstagePassMgrLogger, `🎪✅ [Carnival] Backstage pass issued: ${passId} (${ config.performerTitle })`);
		
		return pass;
	}
	
	/**
	 * ✅ Verify a backstage pass and return credential context
	 * 
	 * This method validates the pass key, checks expiration and revocation,
	 * and builds a CredentialContext for the request! 🎪
	 * 
	 * Carnival metaphor: The security guard at the gate checks your pass,
	 * verifies it's valid, and lets you through with a smile! 🎭✨
	 * 
	 * @param key - Backstage pass key (carnival_sk_...)
	 * @returns CredentialContext if valid, null if invalid
	 */
	async verifyBackstagePass(key: string): Promise<CredentialContext | null> {
		// 🔍 Validate key format
		if (!isBackstagePassKey(key)) {
			console.warn('🎪❌ [Carnival] Invalid backstage pass format');
			return null;
		}
		
		// 📋 Retrieve all passes
		const passes = await this.getAllPasses();
		
		// 🔎 Find matching pass
		const pass = passes.find(p => p.key === key);
		
		if (!pass) {
			console.warn('🎪❌ [Carnival] Backstage pass not recognized');
			return null;
		}
		
		// ❌ Check if revoked
		if (pass.revokedAt) {
			console.warn(`🎪❌ [Carnival] Backstage pass revoked: ${pass.id}`);
			return null;
		}
		
		// ⏰ Check if expired
		if (pass.expiresAt && new Date(pass.expiresAt) < new Date()) {
			console.warn(`🎪❌ [Carnival] Backstage pass expired: ${pass.id}`);
			return null;
		}
		
		// 🎯 Check if scope expired
		if (pass.scope?.expiresAt && new Date(pass.scope.expiresAt) < new Date()) {
			console.warn(`🎪❌ [Carnival] Pass scope expired: ${pass.id}`);
			return null;
		}
		
		// 🕐 Update last used timestamp
		pass.lastUsedAt = new Date().toISOString();
		await this.updateBackstagePass(pass);
		
		// ✨ Build credential context
		const context: CredentialContext = {
			authenticated: true,
			credentialId: pass.id,
			performerTitle: pass.performerTitle,
			backstageAccess: pass.backstageAccess,
			isImpresario: pass.backstageAccess.includes('impresario:all') || 
							pass.performerTitle === 'impresario',
			scope: pass.scope,
			metadata: pass.metadata,
			ticketTier: DEFAULT_TICKET_TIERS[pass.performerTitle]
		};
		
		Log.log(backstagePassMgrLogger, `🎪✅ [Carnival] Backstage pass verified: ${ pass.id } (${ pass.performerTitle })`);
		
		return context;
	}
	
	/**
	 * ❌ Revoke a backstage pass
	 * 
	 * This method marks a pass as revoked, preventing future use while
	 * keeping it in the records for audit purposes! 🎪
	 * 
	 * Carnival metaphor: The security guard punches a hole in your pass
	 * and adds it to the "no longer valid" list! 🎭
	 * 
	 * @param passId - Backstage pass ID to revoke
	 * @returns True if revoked, false if not found
	 */
	async revokeBackstagePass(passId: string): Promise<boolean> {
		Log.log(backstagePassMgrLogger, `🎪❌ [Carnival] Revoking backstage pass: ${passId}`);
		
		const passes = await this.getAllPasses();
		const pass = passes.find(p => p.id === passId);
		
		if (!pass) {
			Log.warn(backstagePassMgrLogger, `🎪⚠️ [Carnival] Pass not found: ${passId}`);
			return false;
		}
		
		if (pass.revokedAt) {
			Log.warn(backstagePassMgrLogger, `🎪⚠️ [Carnival] Pass already revoked: ${passId}`);
			return false;
		}
		
		// Mark as revoked
		pass.revokedAt = new Date().toISOString();
		await this.updateBackstagePass(pass);
		
		Log.log(backstagePassMgrLogger, `🎪✅ [Carnival] Backstage pass revoked: ${passId}`);
		
		return true;
	}
	
	/**
	 * 📋 List all backstage passes
	 * 
	 * @param includeRevoked - Include revoked passes (default: false)
	 * @returns Array of backstage passes
	 */
	async listBackstagePasses(includeRevoked: boolean = false): Promise<BackstagePass[]> {
		const passes = await this.getAllPasses();
		
		if (includeRevoked) {
			return passes;
		}
		
		// Filter out revoked passes
		return passes.filter(p => !p.revokedAt);
	}
	
	/**
	 * 🔍 Get a specific backstage pass by ID
	 * 
	 * @param passId - Backstage pass ID
	 * @returns Backstage pass or null if not found
	 */
	async getBackstagePass(passId: string): Promise<BackstagePass | null> {
		const passes = await this.getAllPasses();
		return passes.find(p => p.id === passId) ?? null;
	}
	
	/**
	 * 🧹 Clean up expired passes (housekeeping)
	 * 
	 * This method removes expired passes from storage to keep things tidy! 🎪
	 * 
	 * @returns Number of passes cleaned up
	 */
	async cleanupExpiredPasses(): Promise<number> {
		Log.log(backstagePassMgrLogger, '🎪🧹 [Carnival] Cleaning up expired passes...');
		
		const passes = await this.getAllPasses();
		const now = new Date();
		
		// Find expired passes (revoked or past expiration date)
		const expired = passes.filter(p => {
			if (p.revokedAt) {
				return true;
			}
			if (p.expiresAt && new Date(p.expiresAt) < now) {
				return true;
			}
			return false;
		});
		
		if (expired.length === 0) {
			Log.log(backstagePassMgrLogger, '🎪✅ [Carnival] No expired passes to clean up');
			return 0;
		}
		
		// Remove expired passes
		const remaining = passes.filter(p => !expired.includes(p));
		await this.saveAllPasses(remaining);
		
		Log.log(backstagePassMgrLogger, `🎪✅ [Carnival] Cleaned up ${expired.length} expired passes`);
		
		return expired.length;
	}
	
	/**
	 * 📊 Get pass usage statistics
	 * 
	 * @returns Statistics about backstage passes
	 */
	async getPassStatistics(): Promise<{
		total: number;
		active: number;
		revoked: number;
		expired: number;
		byPerformerTitle: Record<PerformerTitle, number>;
	}> {
		const passes = await this.getAllPasses();
		const now = new Date();
		
		const stats = {
			total: passes.length,
			active: 0,
			revoked: 0,
			expired: 0,
			byPerformerTitle: {
				headliner: 0,
				trouper: 0,
				spectator: 0,
				announcer: 0,
				impresario: 0
			} as Record<PerformerTitle, number>
		};
		
		passes.forEach(pass => {
			// Count by performer type
			stats.byPerformerTitle[pass.performerTitle]++;
		
			// Count by status
			if (pass.revokedAt) {
				stats.revoked++;
			} else if (pass.expiresAt && new Date(pass.expiresAt) < now) {
				stats.expired++;
			} else {
				stats.active++;
			}
		});
		
		return stats;
	}
	
	// ============================================================================
	// 🔧 PRIVATE HELPER METHODS
	// ============================================================================
	
	/**
	 * 🔍 Validate pass configuration
	 */
	private validatePassConfig(config: CreateBackstagePassConfig): void {
		if (!config.name || config.name.length < 3) {
			throw new Error('🎪❌ Backstage pass name must be at least 3 characters');
		}
		
		if (config.name.length > 100) {
			throw new Error('🎪❌ Backstage pass name must be less than 100 characters');
		}
		
		if (!config.performerTitle) {
			throw new Error('🎪❌ Performer type is required');
		}
		
		if (!config.backstageAccess || config.backstageAccess.length === 0) {
			throw new Error('🎪❌ At least one backstage access permission is required');
		}
		
		if (config.expiresInHours && config.expiresInHours <= 0) {
			throw new Error('🎪❌ Expiration must be positive number of hours');
		}
	}
	
	/**
	 * 🎲 Generate unique pass ID
	 */
	private generatePassId(): string {
		const timestamp = Date.now();
		const random = Math.random().toString(36).substring(2, 11);
		return `pass_${timestamp}_${random}`;
	}
	
	/**
	 * 🔑 Generate secure pass key (carnival_sk_*)
	 */
	private generatePassKey(): string {
		// Generate 32 random bytes (256 bits)
		const bytes = new Uint8Array(32);
		crypto.getRandomValues(bytes);
		
		// Convert to base64url (43 characters)
		const base64url = this.bytesToBase64Url(bytes);
		
		return CARNIVAL_AUTH_CONSTANTS.BACKSTAGE_PASS_PREFIX + base64url;
	}
	
	/**
	 * 🔄 Convert bytes to base64url encoding
	 */
	private bytesToBase64Url(bytes: Uint8Array): string {
		const base64 = btoa(String.fromCharCode(...bytes));
		return base64
			.replace(/\+/g, '-')
			.replace(/\//g, '_')
			.replace(/=/g, '');
	}
	
	/**
	 * 💾 Save a single backstage pass
	 */
	private async saveBackstagePass(pass: BackstagePass): Promise<void> {
		const passes = await this.getAllPasses();
		const existingIndex = passes.findIndex(p => p.id === pass.id);
		
		if (existingIndex >= 0) {
			passes[existingIndex] = pass;
		} else {
			passes.push(pass);
		}
		
		await this.saveAllPasses(passes);
	}
	
	/**
	 * 🔄 Update an existing backstage pass
	 */
	private async updateBackstagePass(pass: BackstagePass): Promise<void> {
		await this.saveBackstagePass(pass);
	}
	
	/**
	 * 📋 Get all passes from secure storage
	 */
	private async getAllPasses(): Promise<BackstagePass[]> {
		const passes = await this.secureStore.retrieveBackstagePasses();
		return passes ?? [];
	}
	
	/**
	 * 💾 Save all passes to secure storage
	 */
	private async saveAllPasses(passes: BackstagePass[]): Promise<void> {
		await this.secureStore.storeBackstagePasses(passes);
	}
}

/**
 * 🎪 Export for easy access in other modules
 */
export default BackstagePassManager;