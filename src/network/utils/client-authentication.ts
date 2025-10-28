import {
	AuthenticationError,
	ConflictError,
	NotFoundError
} from '../../errors';
import { Log } from '../../utils/logger';
import type {
	ApiRequest,
	CarnivalNetworkSettings,
	ExternalClient
} from '../../types';
import type { RateLimiterService } from '../services/rate-limiter';

const authLogger = {
	context: 'Client Authentication',
	path: '/.obsidian/plugins/carnival-records/utils/authentication'
};

/**
 * Manages authentication for external API clients
 * Handles token generation, validation, refresh, and revocation
 */
export class ClientAuthenticationManager {
	private authenticatedClients: Map<string, ExternalClient> = new Map();
	private rateLimiterService?: RateLimiterService;

	constructor(
		private readonly settings: CarnivalNetworkSettings
	) {}

	/**
	 * Set the rate limiter service (injected after construction)
	 */
	setRateLimiterService(rateLimiterService: RateLimiterService): void {
		this.rateLimiterService = rateLimiterService;
	}

	/**
	 * Authenticate external client and generate session token
	 * 
	 * @param apiKey - API key from client
	 * @param clientType - Type of client (discord, webhook, external)
	 * @returns Client ID if successful, null if authentication fails
	 */
	authenticate(
		apiKey: string,
		clientType: 'discord' | 'webhook' | 'external'
	): string | null {
		try {
			// Validate API key against settings
			const validApiKeys = this.settings.externalApiKeys ?? {};
			const clientConfig = validApiKeys[apiKey];

			if (!clientConfig) {
				Log.warn(authLogger, `Authentication failed: API key not found`);
				return null;
			}
			
			if (!clientConfig.enabled) {
				Log.warn(authLogger, `Authentication failed: Client disabled`);
				return null;
			}

			// Check if client type is allowed
			if (clientConfig.allowedClientTypes && !clientConfig.allowedClientTypes.includes(clientType)) {
				Log.warn(authLogger, `Authentication failed: Client type ${clientType} not allowed for this API key`);
				return null;
			}

			// Generate session token
			const clientId = this.generateClientId();
			const expiresAt = new Date();
			const sessionDuration = clientConfig.sessionDuration ?? 24; // hours
			expiresAt.setHours(expiresAt.getHours() + sessionDuration);

			const client: ExternalClient = {
				id: clientId,
				type: clientType,
				permissions: clientConfig.permissions ?? ['read'],
				expiresAt: expiresAt.toISOString(),
				rateLimits: clientConfig.rateLimits ?? this.getDefaultRateLimits(),
				metadata: {
					apiKey: this.hashApiKey(apiKey), // Store hash, not actual key
					authenticatedAt: new Date().toISOString(),
					lastUsed: new Date().toISOString()
				}
			};

			this.authenticatedClients.set(clientId, client);
			
			Log.log(authLogger, `🔑 Authenticated ${clientType} client: ${clientId}`);
			return clientId;

		} catch (error) {
			Log.error(authLogger, 'Client authentication failed:', error);
			return null;
		}
	}

	/**
	 * Verify if client ID is valid and not expired
	 */
	isAuthenticated(clientId: string): boolean {
		const client = this.authenticatedClients.get(clientId);
		
		if (!client) {
			return false;
		}
		
		const isValid = new Date() < new Date(client.expiresAt);
		
		if (isValid) {
			this.updateClientLastUsed(clientId);
		}
		
		return isValid;
	}

	/**
	 * Get authenticated client details
	 */
	getClient(clientId: string): ExternalClient | undefined {
		return this.authenticatedClients.get(clientId);
	}

	/**
	 * Refresh authentication token
	 * 
	 * @param clientId - Current client ID
	 * @returns New expiration details
	 * @throws {AuthenticationError} if client not found
	 * @throws {ConflictError} if token doesn't need refresh yet
	 */
	refreshToken(clientId: string): {
		clientId: string;
		expiresAt: string;
		expiresIn: number;
	} {
		const client = this.authenticatedClients.get(clientId);
		
		if (!client) {
			throw new AuthenticationError('Invalid client ID');
		}
		
		// Check if token is expired or about to expire
		const expiresAt = new Date(client.expiresAt);
		const now = new Date();
		const timeUntilExpiry = expiresAt.getTime() - now.getTime();
		const oneHour = 60 * 60 * 1000;
		
		// Only allow refresh if token expires within 1 hour or is already expired
		if (timeUntilExpiry > oneHour) {
			throw new ConflictError(
				'Token refresh not needed yet',
				{ 
					expiresAt: client.expiresAt,
					expiresIn: Math.floor(timeUntilExpiry / 1000)
				}
			);
		}
		
		// Generate new expiration time
		const newExpiresAt = new Date();
		newExpiresAt.setHours(newExpiresAt.getHours() + 24); // Default 24 hours
		
		// Update client
		client.expiresAt = newExpiresAt.toISOString();
		if (client.metadata) {
			client.metadata.lastUsed = new Date().toISOString();
		}
		this.authenticatedClients.set(clientId, client);
		
		Log.log(authLogger, `🔄 Token refreshed for client: ${clientId}`);
		
		return {
			clientId,
			expiresAt: client.expiresAt,
			expiresIn: Math.floor((newExpiresAt.getTime() - Date.now()) / 1000)
		};
	}

	/**
	 * Revoke authentication token
	 * 
	 * @param clientId - Client ID to revoke
	 * @throws {NotFoundError} if client not found
	 */
	revokeToken(clientId: string): void {
		const existed = this.authenticatedClients.delete(clientId);
		
		if (!existed) {
			throw new NotFoundError('Client ID', clientId);
		}
		
		// Also clean up rate limit entries for this client
		this.cleanupClientRateLimits(clientId);
		
		Log.log(authLogger, `🔒 Token revoked for client: ${clientId}`);
	}

	/**
	 * Middleware-style authentication check
	 * 
	 * @param clientId - Client ID from request header
	 * @throws {AuthenticationError} with specific reason
	 */
	requireAuthentication(clientId: string | undefined): void {
		if (!clientId) {
			throw new AuthenticationError(
				'Missing authentication credentials',
				{ hint: 'Include X-Client-ID header with your client ID' }
			);
		}
		
		if (!this.isAuthenticated(clientId)) {
			const client = this.authenticatedClients.get(clientId);
			
			if (!client) {
				throw new AuthenticationError(
					'Invalid client ID',
					{ hint: 'Client ID not found. Please authenticate first.' }
				);
			}
			
			// Client exists but token expired
			throw new AuthenticationError(
				'Authentication token expired',
				{ 
					expiredAt: client.expiresAt,
					hint: 'Please re-authenticate to get a new token'
				}
			);
		}
	}

	/**
	 * Get all authenticated clients (for monitoring/debugging)
	 */
	getAuthenticatedClients(): ReadonlyArray<ExternalClient> {
		return Array.from(this.authenticatedClients.values());
	}

	/**
	 * Clean up expired clients and rate limits
	 * Should be called periodically (e.g., every 5 minutes)
	 */
	cleanup(): void {
		const now = Date.now();
		const expiredClients: string[] = [];
		
		// Find expired clients
		for (const [clientId, client] of this.authenticatedClients.entries()) {
			if (new Date(client.expiresAt).getTime() < now) {
				expiredClients.push(clientId);
			}
		}
		
		// Remove expired clients
		for (const clientId of expiredClients) {
			this.authenticatedClients.delete(clientId);
			this.cleanupClientRateLimits(clientId);
		}
		
		if (expiredClients.length > 0) {
			Log.log(authLogger, `🧹 Cleaned up ${expiredClients.length} expired client sessions`);
		}
		
		// Clean up expired rate limit windows
		this.cleanupExpiredRateLimits();
	}

	/**
	 * Clear all authentication state (for plugin unload)
	 */
	destroy(): void {
		this.authenticatedClients.clear();
		Log.log(authLogger, '🔒 Authentication manager destroyed');
	}

	// Private helper methods

	private generateClientId(): string {
		return `client-${Date.now().toString(36)}-${Math.random().toString(36).substring(2)}`;
	}

	private hashApiKey(apiKey: string): string {
		// Simple hash for identification (not cryptographic)
		let hash = 0;
		for (let i = 0; i < apiKey.length; i++) {
			const char = apiKey.charCodeAt(i);
			hash = ((hash << 5) - hash) + char;
			hash = hash & hash; // Convert to 32-bit integer
		}
		return `hash_${Math.abs(hash).toString(36)}`;
	}

	private updateClientLastUsed(clientId: string): void {
		const client = this.authenticatedClients.get(clientId);
		if (client?.metadata) {
			client.metadata.lastUsed = new Date().toISOString();
			this.authenticatedClients.set(clientId, client);
		}
	}

	/**
	 * Clean up rate limits for a specific client
	 * Delegates to RateLimiterService if available
	 */
	private cleanupClientRateLimits(clientId: string): void {
		if (this.rateLimiterService) {
			this.rateLimiterService.cleanupClient(clientId);
		}
	}

	/**
	 * Clean up expired rate limit windows
	 * Delegates to RateLimiterService if available
	 */
	private cleanupExpiredRateLimits(): void {
		if (this.rateLimiterService) {
			this.rateLimiterService.cleanup();
		}
	}

	private getDefaultRateLimits(): { [operation: string]: number } {
		return {
			records_query: 60,  // per hour
			record_create: 10,  // per hour
			search: 30          // per hour
		};
	}
}

/**
 * Helper function to extract client ID from request
 * Kept as standalone utility since it's stateless
 */
export function extractClientId(request: ApiRequest): string | undefined {
	const clientId = request.headers['x-client-id'];
	return clientId ? String(clientId) : undefined;
}