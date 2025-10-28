// network/external-api-service.ts
import { App } from 'obsidian';
import { Log } from '../utils/logger';

// Services
import {
	ClientAuthenticationManager,
	extractClientId
} from './utils/client-authentication';
import { RateLimiterService } from './services/rate-limiter';
import { RecordService } from './services/record-service';
import { RegistryAccessService } from './services/registry-access-service';
import { NetworkQueryService } from './services/network-query-service';
import { WebhookVerifier } from './services/webhook-verifier';

// Handlers
import { DiscordHandlers } from './handlers/discord-handlers';
import { WebhookHandlers } from './handlers/webhook-handlers';
import { SearchHandlers } from './handlers/search-handlers';

// Auth handlers
import {
	handleAuthentication,
	handleTokenRefresh,
	handleTokenRevocation,
	checkAuthentication
} from './handlers/auth-handlers';

// Error handling
import { handleError } from './handlers/error-handler';
import {
	AuthenticationError
} from '../errors';

// Types
import type {
	ApiRequest,
	CarnivalNetworkSettings,
	ExternalClient,
	LogContext,
	NetworkConfiguration
} from '../types';

const externalAPILogger: LogContext = {
	context: 'External API Service',
	path: '/.obsidian/plugins/carnival-records/network/external-api-service'
};

/**
 * 🌐 External API Service - Gateway for Discord bot and external integrations
 * 
 * Orchestrates authentication, rate limiting, and route registration.
 * Business logic is delegated to specialized handlers and services.
 */
export class ExternalApiService {
	private app: App;
	private config: NetworkConfiguration;
	private settings: CarnivalNetworkSettings;
	
	// Services
	private authManager: ClientAuthenticationManager;
	private rateLimiter: RateLimiterService;
	private recordService: RecordService;
	private registryAccess: RegistryAccessService;
	private networkService: NetworkQueryService;
	private webhookVerifier: WebhookVerifier;
	
	// Handlers
	private discordHandlers: DiscordHandlers;
	private webhookHandlers: WebhookHandlers;
	private searchHandlers: SearchHandlers;
	
	// State
	private pendingRoutes?: any[];
	private startTime = Date.now();

	constructor(
		app: App,
		config: NetworkConfiguration,
		settings: CarnivalNetworkSettings
	) {
		this.app = app;
		this.config = config;
		this.settings = settings;

		// Initialize shared registry access
		this.registryAccess = new RegistryAccessService(app);
		
		// Initialize services
		this.authManager = new ClientAuthenticationManager(settings);
		this.rateLimiter = new RateLimiterService();
		this.recordService = new RecordService(this.registryAccess, config);
		this.networkService = new NetworkQueryService(this.registryAccess, this.startTime);
		this.webhookVerifier = new WebhookVerifier(settings);
		
		// Initialize handlers
		this.discordHandlers = new DiscordHandlers(this.recordService, this.networkService);
		this.webhookHandlers = new WebhookHandlers(this.recordService, this.webhookVerifier);
		this.searchHandlers = new SearchHandlers(this.recordService, this.networkService);
		
		this.initializeExternalApi();
	}

	/**
	 * Initialize external API endpoints
	 */
	private async initializeExternalApi(): Promise<void> {
		try {
			await this.registerApiRoutes();
			
			Log.log(externalAPILogger, '🌐 External API Service: Initialized successfully');
		} catch (error) {
			Log.error(externalAPILogger, '🌐 External API Service: Initialization failed:', error);
			throw error;
		}
	}

	/**
	 * Register API routes with Local REST API plugin
	 */
	private async registerApiRoutes(): Promise<void> {
		const routes = [

			// ============================================================
            // Authentication endpoints
            // ============================================================

			{
				path: '/api/auth/token',
				method: 'POST',
				handler: async (req: ApiRequest) => {
                    try {
                        const result = await handleAuthentication(req, this.authManager);
                        return { status: 'success', data: result, timestamp: new Date().toISOString() };
                    } catch (error) {
                        return handleError(error, 'authentication');
                    }
                },
				auth: false
			},
			{
				path: '/api/auth/refresh',
				method: 'POST',
				handler: async (req: ApiRequest) => {
                    try {
                        const result = await handleTokenRefresh(req, this.authManager);
                        return { status: 'success', data: result, timestamp: new Date().toISOString() };
                    } catch (error) {
                        return handleError(error, 'token_refresh');
                    }
                },
				auth: true
			},
			{
				path: '/api/auth/revoke',
				method: 'DELETE',
				handler: async (req: ApiRequest) => {
                    try {
                        const result = await handleTokenRevocation(req, this.authManager);
                        return { status: 'success', data: result, timestamp: new Date().toISOString() };
                    } catch (error) {
                        return handleError(error, 'token_revocation');
                    }
                },
				auth: true
			},
			
			// ============================================================
            // Discord bot integration endpoints
            // ============================================================

			{
				path: '/api/discord/records',
				method: 'GET',
				handler: async (req: ApiRequest) => {
                    const clientId = extractClientId(req);
                    this.authManager.requireAuthentication(clientId);
                    const client = this.authManager.getClient(clientId!)!;
                    
                    try {
                        const result = await this.discordHandlers.handleRecordsQuery(req, client);
                        return { status: 'success', data: result, timestamp: new Date().toISOString() };
                    } catch (error) {
                        return handleError(error, 'discord_records_query');
                    }
                },
				auth: true,
				rateLimit: 'records_query'
			},
			{
				path: '/api/discord/records',
				method: 'POST',
				handler: async (req: ApiRequest) => {
                    const clientId = extractClientId(req);
                    this.authManager.requireAuthentication(clientId);
                    const client = this.authManager.getClient(clientId!)!;
                    
                    try {
                        const result = await this.discordHandlers.handleRecordCreate(req, client);
                        return { status: 'success', data: result, timestamp: new Date().toISOString() };
                    } catch (error) {
                        return handleError(error, 'discord_record_create');
                    }
                },
				auth: true,
				rateLimit: 'record_create'
			},
			{
				path: '/api/discord/territories',
				method: 'GET',
				handler: async (req: ApiRequest) => {
                    const clientId = extractClientId(req);
                    this.authManager.requireAuthentication(clientId);
                    const client = this.authManager.getClient(clientId!)!;
                    
                    try {
                        const result = this.discordHandlers.handleTerritoriesQuery(req, client);
                        return {
							status: 'success',
							data: result,
							timestamp: new Date().toISOString()
						};
                    } catch (error) {
                        return handleError(error, 'discord_territories_query');
                    }
                },
				auth: true
			},
			{
				path: '/api/discord/network/status',
				method: 'GET',
				handler: async (req: ApiRequest) => {
                    const clientId = extractClientId(req);
                    this.authManager.requireAuthentication(clientId);
                    const client = this.authManager.getClient(clientId!)!;
                    
                    try {
                        // Synchronous handler - no await needed
                        const result = this.discordHandlers.handleNetworkStatus();
                        return { status: 'success', data: result, timestamp: new Date().toISOString() };
                    } catch (error) {
                        return handleError(error, 'discord_network_status');
                    }
                },
				auth: true
			},
			
			// ============================================================
            // External webhook endpoints
            // ============================================================

			{
				path: '/api/webhooks/github',
				method: 'POST',
				handler: async (req: ApiRequest) => {
                    try {
                        const result = await this.webhookHandlers.handleGitHub(req);
                        return { status: 'success', data: result, timestamp: new Date().toISOString() };
                    } catch (error) {
                        return handleError(error, 'github_webhook');
                    }
                },
				auth: false
			},
			{
				path: '/api/webhooks/beehiiv',
				method: 'POST',
				handler: async (req: ApiRequest) => {
                    try {
                        const result = await this.webhookHandlers.handleBeehiiv(req);
                        return { status: 'success', data: result, timestamp: new Date().toISOString() };
                    } catch (error) {
                        return handleError(error, 'beehiiv_webhook');
                    }
                },
				auth: false
			},
			
			// ============================================================
            // General external API endpoints
            // ============================================================

			{
				path: '/api/carnival/search',
				method: 'POST',
				handler: async (req: ApiRequest) => {
                    const clientId = extractClientId(req);
                    this.authManager.requireAuthentication(clientId);
                    const client = this.authManager.getClient(clientId!)!;
                    
                    try {
                        const result = await this.searchHandlers.handleSearch(req, client);
                        return { status: 'success', data: result, timestamp: new Date().toISOString() };
                    } catch (error) {
                        return handleError(error, 'carnival_search');
                    }
                },
				auth: true,
				rateLimit: 'search'
			},
			{
				path: '/api/carnival/analytics',
				method: 'GET',
				handler: async (req: ApiRequest) => {
                    const clientId = extractClientId(req);
                    this.authManager.requireAuthentication(clientId);
                    const client = this.authManager.getClient(clientId!)!;
                    
                    try {
                        // Synchronous handler - no await needed
                        const result = this.searchHandlers.handleAnalytics(req, client);
                        return { status: 'success', data: result, timestamp: new Date().toISOString() };
                    } catch (error) {
                        return handleError(error, 'carnival_analytics');
                    }
                },
				auth: true
			}
		];

		for (const route of routes) {
			await this.registerRoute(route);
		}
	}

	/**
	 * Create authenticated handler wrapper with rate limiting
	 */
	private createAuthenticatedHandler(
		handler: (
			request: ApiRequest,
			client: ExternalClient
		) => Promise<unknown>
	): (request: ApiRequest) => Promise<unknown> {
		return async (request: ApiRequest) => {
			// Extract and verify client ID
			const clientId = extractClientId(request);
			this.authManager.requireAuthentication(clientId);

			if (!clientId) {
				throw new AuthenticationError('Client ID missing from request');
			}
			
			// Get authenticated client
			const client = this.authManager.getClient(clientId);

			if (!client) {
				throw new AuthenticationError('Client not found after authentication');
			}
			
			// Execute handler
			return await Promise.resolve(handler(request, client));
		};
	}

	/**
	 * Register route with Local REST API plugin
	 */
	private async registerRoute(route: any): Promise<void> {
		try {
			const restApiPlugin = (this.app as any).plugins?.plugins?.['obsidian-local-rest-api'];
			
			// Wrap handler with auth and rate limiting if required
			let wrappedHandler = route.handler;
			
			if (route.auth) {
				const originalHandler = wrappedHandler;
				wrappedHandler = async (request: any) => {
					await checkAuthentication(request, this.authManager);
					
					// Apply rate limiting if specified
					if (route.rateLimit) {
						const clientId = extractClientId(request);

						if (!clientId) {
							throw new AuthenticationError('Client ID missing from request for rate limiting');
						}

						const client = this.authManager.getClient(clientId);

						if (client) {
							this.rateLimiter.requireLimit(client, route.rateLimit);
						}
					}
					
					return originalHandler(request);
				};
			}
			
			if (restApiPlugin?.registerRoute) {
				await restApiPlugin.registerRoute({
					...route,
					handler: wrappedHandler
				});
				Log.log(externalAPILogger, `Registered API route: ${route.method} ${route.path}`);
			} else {
				if (!this.pendingRoutes) {
					this.pendingRoutes = [];
				}
				this.pendingRoutes.push({ ...route, handler: wrappedHandler });
				Log.warn(externalAPILogger, 
					`Local REST API plugin not available, route queued: ${route.method} ${route.path}`
				);
			}
		} catch (error) {
			Log.error(externalAPILogger, `Failed to register route ${route.method} ${route.path}:`, error);
		}
	}

	/**
	 * Clean up external API service
	 */
	cleanup(): void {
		this.authManager.destroy();
		this.rateLimiter.destroy();
		this.recordService.cleanup();
		this.registryAccess.clearCache();
		this.networkService.cleanup();
		
		Log.log(externalAPILogger, '🌐 External API Service: Cleanup complete');
	}
}