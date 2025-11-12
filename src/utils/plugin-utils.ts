/* eslint-disable @typescript-eslint/no-explicit-any */
import { App } from 'obsidian';

/**
 * Get a plugin by ID from the app instance
 * @param app - The App instance (pass this.app from your plugin)
 * @param pluginId - The plugin ID to retrieve
 */
export function getPlugin(app: App, pluginId: string): any | null {
	return (app as any).plugins?.plugins?.[pluginId] ?? null;
}