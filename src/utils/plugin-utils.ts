import type {
	App,
	Plugin
} from 'obsidian';
import { Log } from './logger';
import {
	LogContext
} from '../types/public';

/**
 * Extended App type that includes the plugins property
 */
interface AppWithPlugins extends App {
	plugins: {
		plugins: Record<string, Plugin>;
		enabledPlugins: Set<string>;
	};
}

/**
 * Get a plugin instance with type safety for public APIs
 */
export function getPlugin<T extends Plugin = Plugin>(
	app: App,
	pluginId: string
): T | null {
	// Type assertion: we know this property exists at runtime
	// even though it's not in Obsidian's public API types
	const appWithPlugins = app as AppWithPlugins;
	const plugin = appWithPlugins.plugins?.plugins?.[pluginId];
	return (plugin as T) ?? null;
}

export function verifyDependencies(
	name: string,
	app: App,
	logger: LogContext
): boolean {

	const plugin = getPlugin(app, name);
	
	if (!plugin) {
		Log.warn(logger, 
			`🎪 ${ name } not found. The carnival cannot begin until it is installed!`
		);
		return false;
	} else {
		Log.log(logger, `🎪 Dependencies verified: ${ name } found. Let the show begin!`);
		return true;
	}
}