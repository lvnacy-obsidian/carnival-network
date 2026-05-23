/**
 * ============================================================================
 * LOCAL REST API (Obsidian Plugin & Dependency) TYPES
 * ============================================================================
 * 
 * Type definitions for the obsidian-local-rest-api plugin's public API.
 *
 * This module provides TypeScript types for the express-based REST API
 * that obsidian-local-rest-api exposes. Plugins can use this API to
 * register custom endpoints.
 *
 * @see https://github.com/coddingtonbear/obsidian-local-rest-api
 * 
 * Index of exports:
 * - ExpressIRoute
 * - LocalRestAPIPlugin
 * - LocalRestAPIPublic
 * - LocalRestAPIRequest
 * - LocalRestAPIResponse
 * - LocalRestAPIRouteHandler
 */

import {
	Plugin,
	PluginManifest
} from 'obsidian';

/**
 * Minimal type definition for an Express IRoute object.
 * Used for type-safe route registration.
 */
export interface ExpressIRoute {
	get(handler: (req: unknown, res: unknown) => void | Promise<void>): ExpressIRoute;
	post(handler: (req: unknown, res: unknown) => void | Promise<void>): ExpressIRoute;
	put(handler: (req: unknown, res: unknown) => void | Promise<void>): ExpressIRoute;
	delete(handler: (req: unknown, res: unknown) => void | Promise<void>): ExpressIRoute;
	patch(handler: (req: unknown, res: unknown) => void | Promise<void>): ExpressIRoute;
	head(handler: (req: unknown, res: unknown) => void | Promise<void>): ExpressIRoute;
	all(handler: (req: unknown, res: unknown) => void | Promise<void>): ExpressIRoute;
}

/**
 * Public API exposed by obsidian-local-rest-api plugin
 */
export interface LocalRestAPIPlugin extends Plugin {
	getPublicApi(manifest: PluginManifest): LocalRestAPIPublic | null;
}

/**
 * The public API provided by obsidian-local-rest-api for other plugins
 * to register custom endpoints.
 *
 * Obtain this via:
 * ```typescript
 * const api = (plugin as any).getPublicApi?.(manifest);
 * ```
 */
export interface LocalRestAPIPublic {
	/**
	 * Register a route with the local REST API.
	 *
	 * @param path - The path for the route (e.g., '/metrics', '/webhook')
	 * @returns An express IRoute object to chain HTTP method handlers
	 *
	 * @example
	 * ```typescript
	 * const route = api.addRoute('/metrics');
	 * route.get((req, res) => {
	 *   res.status(200).send('metrics data');
	 * });
	 * ```
	 */
	addRoute(path: string): ExpressIRoute;

	/**
	 * Unregister all routes added by this API extension.
	 *
	 * Call this during plugin cleanup (onunload) to remove routes.
	 */
	unregister(): void;
}

/**
 * Express-like request object with common methods.
 */
export interface LocalRestAPIRequest {
	method?: string;
	path?: string;
	url?: string;
	headers?: Record<string, unknown>;
	body?: unknown;
	query?: Record<string, unknown>;
	params?: Record<string, unknown>;
}

/**
 * Express-like response object with common methods.
 */
export interface LocalRestAPIResponse {
	status(code: number): LocalRestAPIResponse;
	json(data: unknown): LocalRestAPIResponse;
	send(data: unknown): LocalRestAPIResponse;
	set(name: string, value: string): LocalRestAPIResponse;
	setHeader(name: string, value: string): LocalRestAPIResponse;
	end(): void;
}

/**
 * Type for a complete route handler function.
 *
 * @example
 * ```typescript
 * const metricsHandler: LocalRestApiRouteHandler = (req, res) => {
 *   res.status(200).json({ uptime: process.uptime() });
 * };
 * ```
 */
export type LocalRestAPIRouteHandler = (
	req: LocalRestAPIRequest,
	res: LocalRestAPIResponse
) => void | Promise<void>;
