/**
 * ============================================================================
 * API ROUTER - Route Registration with Local REST API Plugin
 * ============================================================================
 * 
 * Registers HTTP routes with the Local REST API plugin and delegates requests
 * to the ExternalAPIService. Handles route lifecycle (registration/cleanup) and
 * error response formatting.
 * 
 * Core Responsibilities:
 * - Route registration with Local REST API plugin
 * - HTTP method mapping (GET, POST, PUT, DELETE)
 * - Request delegation to ExternalAPIService
 * - Error response formatting
 * - Route cleanup on plugin unload
 * 
 * Architecture:
 * - Thin routing layer (no business logic)
 * - Maps routes to ExternalAPIService handlers
 * - Formats all responses consistently (APIResponse<T>)
 * - Handles errors gracefully with proper HTTP status codes
 * 
 * Route Structure:
 * - Acts: GET/POST /api/acts, GET /api/acts/:id
 * - Search: POST /api/search
 * - Status: GET /api/carnival/status
 * - Territories: GET /api/territories
 * - Analytics: GET /api/analytics
 * 
 * Exports:
 * - APIRouter (class) - Route registration and management
 * 
 * Public Methods:
 * - registerRoutes(localRestAPI: LocalRestAPIPublic): void
 *   Register all routes with Local REST API plugin
 *   Called during plugin onload()
 * 
 * - unregisterRoutes(): void
 *   Cleanup all registered routes
 *   Called during plugin onunload()
 * 
 * Implementation Details:
 * - Created in: main.ts initializeAPIRouter()
 * - Used by: CarnivalNetworkPlugin lifecycle
 * - Routes registered via: Local REST API plugin public API
 * - Error handling: Wraps all errors in APIResponse format
 * 
 * Dependencies:
 * - ExternalAPIService - Business logic handlers
 * - LocalRestAPIPublic - Route registration interface
 * - Log - Error logging
 * 
 * Route Registration Pattern:
 * ```typescript
 * localRestAPI.addRoute('/api/acts').get(async (req, res) => {
 *   const result = await apiService.handleActsQuery(req);
 *   res.status(200).json(result);
 * });
 * ```
 * 
 * Error Response Format:
 * All errors return consistent structure:
 * ```json
 * {
 *   "status": "error",
 *   "error": "ERROR_CODE",
 *   "message": "Human readable message",
 *   "details": { ... },
 *   "timestamp": "ISO timestamp"
 * }
 * ```
 * 
 * HTTP Status Codes:
 * - 200: Success (GET, search)
 * - 201: Created (POST /api/acts)
 * - 400: Bad Request (validation errors)
 * - 404: Not Found (act by ID)
 * - 500: Internal Server Error (unexpected errors)
 * 
 * @see external-api-service.ts - Request handlers
 * @see main.ts - Router initialization
 * @see local-rest-api-types.ts - Type definitions
 */

import type { App } from 'obsidian';
import { ExternalAPIService } from './external-api-service';
import { Log } from '../utils/logger';
import type CarnivalNetworkPlugin from '../main';
import type {
	LocalRestAPIPublic,
	LogContext
} from '../types/public';

const routerLogger: LogContext = {
	context: 'API Router',
	path: '/.obsidian/plugins/carnival-network/network/api-router'
};

/**
 * 🎪 API Router - Registers external API routes with Local REST API plugin
 * 
 * Thin routing layer that maps HTTP endpoints to ExternalAPIService handlers.
 * Handles route registration/cleanup and consistent error formatting.
 */
export class APIRouter {
	private apiService: ExternalAPIService;
	private localRestAPI?: LocalRestAPIPublic;

	constructor(
		private app: App,
		private plugin: CarnivalNetworkPlugin
	) {
		this.apiService = new ExternalAPIService(plugin);
	}

	/**
	 * Register all API routes with Local REST API plugin
	 */
	registerRoutes(localRestAPI: LocalRestAPIPublic): void {
		this.localRestAPI = localRestAPI;

		try {
			// Acts endpoints
			this.registerActsRoutes();
			
			// Search endpoint
			this.registerSearchRoutes();
			
			// Network endpoints
			this.registerNetworkRoutes();

			Log.log(routerLogger, '🎪 API routes registered successfully');
		} catch (error) {
			Log.error(routerLogger, 'Failed to register API routes:', error);
			throw error;
		}
	}

	/**
	 * Unregister all API routes
	 */
	unregisterRoutes(): void {
		if (this.localRestAPI) {
			try {
				this.localRestAPI.unregister();
				Log.log(routerLogger, '🎪 API routes unregistered');
			} catch (error) {
				Log.error(routerLogger, 'Error unregistering routes:', error);
			}
		}
	}

	/**
	 * ========================================================================
	 * ROUTE REGISTRATION
	 * ========================================================================
	 */

	/**
	 * Register acts CRUD routes
	 */
	private registerActsRoutes(): void {
		if (!this.localRestAPI) return;

		// GET /api/acts - Query acts
		this.localRestAPI.addRoute('/api/acts').get(async (req, res) => {
			try {
				const result = await this.apiService.handleActsQuery(req as any);
				res.status(200).json(result);
			} catch (error) {
				this.handleRouteError(res, error);
			}
		});

		// POST /api/acts - Create act
		this.localRestAPI.addRoute('/api/acts').post(async (req, res) => {
			try {
				const result = await this.apiService.handleActCreate(req as any);
				res.status(201).json(result);
			} catch (error) {
				this.handleRouteError(res, error);
			}
		});

		// GET /api/acts/:id - Get specific act
		this.localRestAPI.addRoute('/api/acts/:id').get(async (req, res) => {
			try {
				const result = await this.apiService.handleActGet(req as any);
				res.status(200).json(result);
			} catch (error) {
				this.handleRouteError(res, error);
			}
		});

		Log.log(routerLogger, '📋 Acts routes registered');
	}

	/**
	 * Register search routes
	 */
	private registerSearchRoutes(): void {
		if (!this.localRestAPI) return;

		// POST /api/search - Search acts
		this.localRestAPI.addRoute('/api/search').post(async (req, res) => {
			try {
				const result = await this.apiService.handleSearch(req as any);
				res.status(200).json(result);
			} catch (error) {
				this.handleRouteError(res, error);
			}
		});

		Log.log(routerLogger, '🔍 Search routes registered');
	}

	/**
	 * Register network status routes
	 */
	private registerNetworkRoutes(): void {
		if (!this.localRestAPI) return;

		// GET /api/carnival/status - Carnival status
		this.localRestAPI.addRoute('/api/carnival/status').get(async (req, res) => {
			try {
				const result = this.apiService.handleCarnivalStatus();
				res.status(200).json(result);
			} catch (error) {
				this.handleRouteError(res, error);
			}
		});

		// GET /api/territories - Territories list
		this.localRestAPI.addRoute('/api/territories').get(async (req, res) => {
			try {
				const result = this.apiService.handleTerritoriesList();
				res.status(200).json(result);
			} catch (error) {
				this.handleRouteError(res, error);
			}
		});

		// GET /api/analytics - Network analytics
		this.localRestAPI.addRoute('/api/analytics').get(async (req, res) => {
			try {
				const result = this.apiService.handleAnalytics(req as any);
				res.status(200).json(result);
			} catch (error) {
				this.handleRouteError(res, error);
			}
		});

		Log.log(routerLogger, '🌐 Network routes registered');
	}

	/**
	 * ========================================================================
	 * ERROR HANDLING
	 * ========================================================================
	 */

	/**
	 * Handle route errors with proper status codes
	 */
	private handleRouteError(res: any, error: unknown): void {
		const apiError = error as any;
		
		const statusCode = apiError.statusCode || 500;
		const response = {
			status: 'error',
			error: apiError.code || 'UNKNOWN_ERROR',
			message: apiError.message || 'An error occurred',
			details: apiError.details,
			timestamp: new Date().toISOString()
		};

		res.status(statusCode).json(response);
		Log.error(routerLogger, `Route error (${statusCode}):`, error);
	}
}