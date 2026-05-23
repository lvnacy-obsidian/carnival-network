/**
 * ============================================================================
 * 🎟️ PERFORMANCE TICKET MANAGER 🎪
 * ============================================================================
 * 
 * The carnival's ticket booth! This service manages all performance ticket
 * (JWT) operations - issuing, verifying, and refreshing session tokens! 🎭
 * 
 * Key Features:
 * - 🎟️ Issue performance tickets (JWT) from backstage passes
 * - ✅ Verify JWT tokens and return credential context
 * - 🔄 Refresh tickets with refresh tokens
 * - 🔒 HS256 (HMAC-SHA256) signing
 * - 📱 Desktop + mobile support
 * - 🎯 Scope inheritance from backstage pass
 * - ⏰ Configurable expiration
 * 
 * Architecture:
 * This manager handles all JWT operations, working with BackstagePassManager
 * to issue tickets based on valid passes. The JWT secret is stored securely
 * in Secure Store! 🎪✨
 * 
 * @module performance-ticket-manager
 * @category API/Services
 * @carnival-themed 🎪
 */

import { App } from 'obsidian';
import type { SecureStoreManager } from '../../utils/secure-store-manager';
import type { BackstagePassManager } from './backstage-pass-manager';
import { Log } from '../../utils/logger';
import {
	CARNIVAL_AUTH_CONSTANTS,
	type CredentialContext,
	DEFAULT_TICKET_TIERS,
	type LogContext,
	type PerformanceTicket,
	type RefreshToken
} from '../../types/public';

const ticketManagerLogger: LogContext = {
	context: 'Performance Ticket Manager',
	path: '.obsidian/plugins/carnival-network/src/api/services/performance-ticket-manager.ts'
};

/**
 * 🎪 PerformanceTicketManager - The ticket booth! 🎟️
 * 
 * Carnival metaphor: The booth where you exchange your backstage pass
 * for a paper ticket good for today's performances! Return tomorrow
 * for a fresh ticket! 🎭✨
 * 
 * Responsibilities:
 * - Issue JWT tokens from valid backstage passes
 * - Verify incoming JWT tokens
 * - Generate and validate refresh tokens
 * - Manage JWT secret (auto-generate if needed)
 * - Track ticket expiration
 * - Revoke tokens when needed
 */
export class PerformanceTicketManager {
	private app: App;
	private secureStore: SecureStoreManager;
	private backstagePassManager: BackstagePassManager;
	private jwtSecret: string | null = null;
	
	/**
	 * 🎪 Create a new Performance Ticket Manager
	 * 
	 * @param app - Obsidian App instance
	 * @param secureStore - Secure Store Manager
	 * @param backstagePassManager - Backstage Pass Manager
	 */
	constructor(
		app: App,
		secureStore: SecureStoreManager,
		backstagePassManager: BackstagePassManager
	) {
		this.app = app;
		this.secureStore = secureStore;
		this.backstagePassManager = backstagePassManager;
	}
	
	/**
	 * 🔑 Initialize the JWT secret
	 * 
	 * This method retrieves the JWT secret from Secure Store, or generates
	 * a new one if it doesn't exist! 🎪🔒
	 * 
	 * @returns Promise<string> - JWT secret
	 */
	async initializeJWTSecret(): Promise<string> {
		if (this.jwtSecret) {
			return this.jwtSecret;
		}
		
		// 🔍 Try to retrieve existing secret
		let secret = await this.secureStore.retrieveJWTSecret();
		
		if (!secret) {
			// ✨ Generate new 256-bit secret
			Log.log(ticketManagerLogger, '🎪🔑 [Carnival] Generating new JWT secret...');
			const bytes = new Uint8Array(32);
			crypto.getRandomValues(bytes);
			secret = this.bytesToBase64Url(bytes);
			
			// 💾 Store in Secure Store
			await this.secureStore.storeJWTSecret(secret);
			Log.log(ticketManagerLogger, '🎪✅ [Carnival] JWT secret generated and stored');
		}
		
		this.jwtSecret = secret;
		return secret;
	}
	
	/**
	 * 🎟️ Issue a performance ticket (JWT) from a backstage pass
	 * 
	 * This method creates a JWT token based on a backstage pass's permissions
	 * and optionally issues a refresh token for session extension! 🎪✨
	 * 
	 * Carnival metaphor: You show your backstage pass at the ticket booth,
	 * and the attendant gives you a paper ticket for today's show! 🎭
	 * 
	 * @param backstagePassId - ID of the backstage pass
	 * @param options - Token options
	 * @returns JWT token and optional refresh token
	 * @throws Error if pass not found or invalid
	 */
	async issuePerformanceTicket(
		backstagePassId: string,
		options?: {
			expiresInHours?: number;
			enableRefresh?: boolean;
		}
	): Promise<{
		performanceTicket: string;
		refreshToken?: string;
		expiresIn: number;
	}> {
		Log.log(ticketManagerLogger, `🎪🎟️ [Carnival] Issuing performance ticket for: ${backstagePassId}`);
		
		// 🔍 Get backstage pass
		const pass = await this.backstagePassManager.getBackstagePass(backstagePassId);
		
		if (!pass) {
			throw new Error(`🎪❌ Backstage pass not found: ${backstagePassId}`);
		}
		
		if (pass.revokedAt) {
			throw new Error(`🎪❌ Backstage pass revoked: ${backstagePassId}`);
		}
		
		if (pass.expiresAt && new Date(pass.expiresAt) < new Date()) {
			throw new Error(`🎪❌ Backstage pass expired: ${backstagePassId}`);
		}
		
		// ⏰ Calculate expiration
		const expiresInHours = options?.expiresInHours ?? 
													CARNIVAL_AUTH_CONSTANTS.DEFAULT_JWT_EXPIRATION_HOURS;
		const expiresIn = expiresInHours * 60 * 60; // seconds
		const iat = Math.floor(Date.now() / 1000);
		const exp = iat + expiresIn;
		
		// 🎫 Create JWT payload
		const payload: PerformanceTicket = {
			sub: backstagePassId,
			iat,
			exp,
			backstageAccess: pass.backstageAccess,
			performerTitle: pass.performerTitle,
			scope: pass.scope,
			jti: this.generateJTI()
		};
		
		// 🔑 Get JWT secret
		const secret = await this.initializeJWTSecret();
		
		// 🎟️ Generate JWT token
		const jwt = await this.generateJWT(payload, secret);
		
		// 🔄 Generate refresh token if requested
		let refreshToken: string | undefined;
		if (options?.enableRefresh) {
			refreshToken = await this.generateRefreshToken(backstagePassId);
		}
		
		Log.log(ticketManagerLogger, `🎪✅ [Carnival] Performance ticket issued: ${payload.jti}`);
		
		return {
			performanceTicket: jwt,
			refreshToken,
			expiresIn
		};
	}
	
	/**
	 * ✅ Verify a performance ticket (JWT) and return credential context
	 * 
	 * This method validates the JWT signature, checks expiration, and
	 * builds a CredentialContext for the request! 🎪
	 * 
	 * Carnival metaphor: The usher at the entrance checks your ticket,
	 * verifies it's valid for today, and shows you to your seat! 🎭✨
	 * 
	 * @param jwt - JWT token string
	 * @returns CredentialContext if valid, null if invalid
	 */
	async verifyPerformanceTicket(jwt: string): Promise<CredentialContext | null> {
		try {
			// 🔑 Get JWT secret
			const secret = await this.initializeJWTSecret();
			
			// 🔓 Decode and verify JWT
			const payload = await this.verifyJWT(jwt, secret);
			
			if (!payload) {
				console.warn('🎪❌ [Carnival] Invalid performance ticket');
				return null;
			}
			
			// ⏰ Check expiration (should already be checked by verifyJWT, but double-check)
			const now = Math.floor(Date.now() / 1000);
			if (payload.exp < now) {
				console.warn('🎪❌ [Carnival] Performance ticket expired');
				return null;
			}
			
			// 🎯 Check if scope expired
			if (payload.scope?.expiresAt && new Date(payload.scope.expiresAt) < new Date()) {
				console.warn('🎪❌ [Carnival] Ticket scope expired');
				return null;
			}
			
			// ✨ Build credential context
			const context: CredentialContext = {
				authenticated: true,
				credentialId: payload.jti ?? payload.sub,
				performerTitle: payload.performerTitle,
				backstageAccess: payload.backstageAccess,
				isImpresario: payload.backstageAccess.includes('impresario:all') ||
										payload.performerTitle === 'impresario',
				scope: payload.scope,
				ticketTier: DEFAULT_TICKET_TIERS[payload.performerTitle]
			};
			
			Log.log(ticketManagerLogger, `🎪✅ [Carnival] Performance ticket verified: ${context.credentialId}`);
			
			return context;
		} catch (error) {
			Log.error(ticketManagerLogger, '🎪❌ [Carnival] Error verifying performance ticket:', error);
			return null;
		}
	}
	
	/**
	 * 🔄 Refresh a performance ticket using a refresh token
	 * 
	 * This method validates the refresh token and issues a new performance
	 * ticket without requiring the backstage pass again! 🎪✨
	 * 
	 * Carnival metaphor: You show your special "season pass" stub at the
	 * ticket booth and get a fresh ticket for today without showing your
	 * backstage pass again! 🎭
	 * 
	 * @param refreshTokenString - Refresh token (carnival_rt_...)
	 * @returns New performance ticket
	 * @throws Error if refresh token invalid or expired
	 */
	async refreshPerformanceTicket(
		refreshTokenString: string
	): Promise<{
		performanceTicket: string;
		expiresIn: number;
	}> {
		Log.log(ticketManagerLogger, '🎪🔄 [Carnival] Refreshing performance ticket...');
		
		// 🔍 Validate refresh token format
		if (!refreshTokenString.startsWith(CARNIVAL_AUTH_CONSTANTS.REFRESH_TOKEN_PREFIX)) {
			throw new Error('🎪❌ Invalid refresh token format');
		}
		
		// 📋 Retrieve refresh token data
		const refreshToken = await this.getRefreshToken(refreshTokenString);
		
		if (!refreshToken) {
			throw new Error('🎪❌ Refresh token not found');
		}
		
		// ❌ Check if revoked
		if (refreshToken.revokedAt) {
			throw new Error('🎪❌ Refresh token revoked');
		}
		
		// ⏰ Check if expired
		if (new Date(refreshToken.expiresAt) < new Date()) {
			throw new Error('🎪❌ Refresh token expired');
		}
		
		// 🔢 Check uses remaining
		if (refreshToken.usesRemaining !== undefined && refreshToken.usesRemaining <= 0) {
			throw new Error('🎪❌ Refresh token exhausted');
		}
		
		// 🎟️ Issue new performance ticket
		const result = await this.issuePerformanceTicket(
			refreshToken.backstagePassId,
			{ expiresInHours: CARNIVAL_AUTH_CONSTANTS.DEFAULT_JWT_EXPIRATION_HOURS }
		);
		
		// 🔢 Decrement uses remaining
		if (refreshToken.usesRemaining !== undefined) {
			refreshToken.usesRemaining--;
			await this.saveRefreshToken(refreshToken);
		}
		
		Log.log(ticketManagerLogger, '🎪✅ [Carnival] Performance ticket refreshed');
		
		return {
			performanceTicket: result.performanceTicket,
			expiresIn: result.expiresIn
		};
	}
	
	// ============================================================================
	// 🔧 PRIVATE HELPER METHODS - JWT Operations
	// ============================================================================
	
	/**
	 * 🎟️ Generate JWT token (simple HMAC-SHA256 implementation)
	 * 
	 * NOTE: This is a simplified JWT implementation for Obsidian plugins!
	 * For production web apps, use a proper JWT library.
	 */
	private async generateJWT(payload: PerformanceTicket, secret: string): Promise<string> {
		// 🎭 Create JWT header
		const header = {
			alg: 'HS256',
			typ: 'JWT'
		};
		
		// 🔄 Encode header and payload
		const headerB64 = this.base64UrlEncode(JSON.stringify(header));
		const payloadB64 = this.base64UrlEncode(JSON.stringify(payload));
		
		// 🔐 Create signature
		const signatureInput = `${headerB64}.${payloadB64}`;
		const signature = await this.hmacSHA256(signatureInput, secret);
		
		// 🎟️ Combine into JWT
		return `${headerB64}.${payloadB64}.${signature}`;
	}
	
	/**
	 * 🔓 Verify JWT token and extract payload
	 */
	private async verifyJWT(jwt: string, secret: string): Promise<PerformanceTicket | null> {
		try {
			// 🔪 Split JWT parts
			const parts = jwt.split('.');
			if (parts.length !== 3) {
				return null;
			}
			
			const [headerB64, payloadB64, signatureB64] = parts;
			
			// 🔐 Verify signature
			const signatureInput = `${headerB64}.${payloadB64}`;
			const expectedSignature = await this.hmacSHA256(signatureInput, secret);
			
			if (signatureB64 !== expectedSignature) {
				console.warn('🎪❌ [Carnival] JWT signature mismatch');
				return null;
			}
			
			// 🔓 Decode payload
			const payload = JSON.parse(this.base64UrlDecode(payloadB64));
			
			// ⏰ Check expiration
			const now = Math.floor(Date.now() / 1000);
			if (payload.exp < now) {
				console.warn('🎪❌ [Carnival] JWT expired');
				return null;
			}
			
			return payload as PerformanceTicket;
		} catch (error) {
			console.error('🎪❌ [Carnival] JWT verification error:', error);
			return null;
		}
	}
	
	/**
	 * 🔐 HMAC-SHA256 signature generation
	 */
	private async hmacSHA256(data: string, secret: string): Promise<string> {
		// Convert strings to Uint8Arrays
		const encoder = new TextEncoder();
		const keyData = encoder.encode(secret);
		const messageData = encoder.encode(data);
		
		// Import key
		const key = await crypto.subtle.importKey(
			'raw',
			keyData,
			{ name: 'HMAC', hash: 'SHA-256' },
			false,
			['sign']
		);
		
		// Sign
		const signature = await crypto.subtle.sign('HMAC', key, messageData);
		
		// Convert to base64url
		return this.bytesToBase64Url(new Uint8Array(signature));
	}
	
	// ============================================================================
	// 🔧 PRIVATE HELPER METHODS - Refresh Tokens
	// ============================================================================
	
	/**
	 * 🔄 Generate a refresh token
	 */
	private async generateRefreshToken(backstagePassId: string): Promise<string> {
		// Generate token string
		const bytes = new Uint8Array(32);
		crypto.getRandomValues(bytes);
		const tokenString = CARNIVAL_AUTH_CONSTANTS.REFRESH_TOKEN_PREFIX + 
											this.bytesToBase64Url(bytes);
		
		// Calculate expiration (30 days default)
		const ttlDays = CARNIVAL_AUTH_CONSTANTS.DEFAULT_REFRESH_TOKEN_TTL_DAYS;
		const expiresAt = new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000).toISOString();
		
		// Create refresh token object
		const refreshToken: RefreshToken = {
			token: tokenString,
			backstagePassId,
			issuedAt: new Date().toISOString(),
			expiresAt
			// usesRemaining: undefined = unlimited
		};
		
		// Store in Secure Store
		await this.saveRefreshToken(refreshToken);
		
		return tokenString;
	}
	
	/**
	 * 📋 Get refresh token by token string
	 */
	private async getRefreshToken(tokenString: string): Promise<RefreshToken | null> {
		const tokens = await this.getAllRefreshTokens();
		return tokens.find(t => t.token === tokenString) ?? null;
	}
	
	/**
	 * 💾 Save refresh token
	 */
	private async saveRefreshToken(token: RefreshToken): Promise<void> {
		const tokens = await this.getAllRefreshTokens();
		const existingIndex = tokens.findIndex(t => t.token === token.token);
		
		if (existingIndex >= 0) {
			tokens[existingIndex] = token;
		} else {
			tokens.push(token);
		}
		
		await this.secureStore.storeJSON(
			CARNIVAL_AUTH_CONSTANTS.SECURE_STORE_KEYS.REFRESH_TOKENS,
			tokens
		);
	}
	
	/**
	 * 📋 Get all refresh tokens
	 */
	private async getAllRefreshTokens(): Promise<RefreshToken[]> {
		const tokens = await this.secureStore.retrieveJSON<RefreshToken[]>(
			CARNIVAL_AUTH_CONSTANTS.SECURE_STORE_KEYS.REFRESH_TOKENS
		);
		return tokens ?? [];
	}
	
	// ============================================================================
	// 🔧 PRIVATE HELPER METHODS - Utilities
	// ============================================================================
	
	/**
	 * 🎲 Generate JWT ID
	 */
	private generateJTI(): string {
		return `ticket_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
	}
	
	/**
	 * 🔄 Convert bytes to base64url
	 */
	private bytesToBase64Url(bytes: Uint8Array): string {
		const base64 = btoa(String.fromCharCode(...bytes));
		return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
	}
	
	/**
	 * 📝 Base64 URL encode
	 */
	private base64UrlEncode(str: string): string {
		const base64 = btoa(unescape(encodeURIComponent(str)));
		return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
	}
	
	/**
	 * 🔓 Base64 URL decode
	 */
	private base64UrlDecode(str: string): string {
		// Add padding
		let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
		while (base64.length % 4) {
			base64 += '=';
		}
		return decodeURIComponent(escape(atob(base64)));
	}
}

/**
 * 🎪 Export for easy access in other modules
 */
export default PerformanceTicketManager;