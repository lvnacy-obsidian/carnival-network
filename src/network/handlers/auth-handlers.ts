// utils/authentication/auth-handlers.ts
import { ClientAuthenticationManager, extractClientId } from '../utils/client-authentication';
import { Log } from '../../utils/logger';
import {
	ApiError,
	AuthenticationError,
	InternalServerError,
	ValidationError
} from '../../errors';
import { ApiRequest, AuthenticationRequestBody } from '../../types/public';

const handlerLogger = {
	context: 'Auth Handlers',
	path: '/.obsidian/plugins/carnival-records/utils/authentication/handlers'
};

/**
 * Handle authentication request
 * POST /api/auth/token
 */
export function handleAuthentication(
	request: AuthenticationRequestBody,
	authManager: ClientAuthenticationManager
): {
	clientId: string;
	expiresAt: string;
	expiresIn: number;
	tokenType: string;
} {
	const { apiKey, clientType } = request;
	
	// Validate request
	if (!apiKey || typeof apiKey !== 'string') {
		throw new ValidationError(
			'Invalid authentication request',
			{ apiKey: 'API key is required and must be a string' }
		);
	}
	
	if (!clientType || !['discord', 'webhook', 'external'].includes(clientType)) {
		throw new ValidationError(
			'Invalid authentication request',
			{ clientType: 'Client type must be "discord", "webhook", or "external"' }
		);
	}
	
	try {
		// Authenticate and get client ID
		const clientId = authManager.authenticate(apiKey, clientType);
		
		if (!clientId) {
			throw new AuthenticationError(
				'Invalid API key or disabled client',
				{ hint: 'Check API key configuration in plugin settings' }
			);
		}
		
		// Get client details for response
		const client = authManager.getClient(clientId);
		if (!client) {
			throw new InternalServerError('Authentication succeeded but client not found');
		}
		
		const expiresAt = new Date(client.expiresAt);
		const expiresIn = Math.floor((expiresAt.getTime() - Date.now()) / 1000);
		
		Log.log(handlerLogger, `🔑 Client authenticated: ${clientType} (${clientId})`);
		
		return {
			clientId,
			expiresAt: client.expiresAt,
			expiresIn,
			tokenType: 'Bearer'
		};
	} catch (error) {
		if (error instanceof ApiError) {
			throw error;
		}
		throw new InternalServerError('Authentication processing failed', error);
	}
}

/**
 * Handle token refresh request
 * POST /api/auth/refresh
 */
export function handleTokenRefresh(
	request: ApiRequest,
	authManager: ClientAuthenticationManager
): {
	clientId: string;
	expiresAt: string;
	expiresIn: number;
} {
	const currentClientId = extractClientId(request);
	
	if (!currentClientId) {
		throw new AuthenticationError('Missing client ID for token refresh');
	}
	
	return authManager.refreshToken(currentClientId);
}

/**
 * Handle token revocation
 * DELETE /api/auth/token
 */
export function handleTokenRevocation(
	request: ApiRequest,
	authManager: ClientAuthenticationManager
): { message: string } {
	const clientId = extractClientId(request);
	
	if (!clientId) {
		throw new AuthenticationError('Missing client ID for token revocation');
	}
	
	authManager.revokeToken(clientId);
	
	return {
		message: 'Token successfully revoked'
	};
}

/**
 * Middleware to check authentication before route handlers
 */
export function checkAuthentication(
	request: ApiRequest,
	authManager: ClientAuthenticationManager
): void {
	const clientId = extractClientId(request);
	authManager.requireAuthentication(clientId);
}