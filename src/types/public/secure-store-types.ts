/**
 * ============================================================================
 * STORAGE INTERFACE (from Secure Storage plugin)
 * ============================================================================
 * 
 * Index of exports:
 * - APIKeyStorage - Interface for secure storage operations
 * - SecureStorePlugin - Interface for the Secure Store plugin
 * - isSecureStorePlugin - Type guard
 */

import { Plugin } from 'obsidian';

/**
 * Storage interface - must be provided by Secure Storage plugin
 */
export interface APIKeyStore {
	store(key: string, value: string): Promise<void>;
	retrieve(key: string): Promise<string | null>;
	remove(key: string): Promise<void>;
	exists(key: string): Promise<boolean>;
	listKeys(): Promise<string[]>;
	clearAll(): Promise<void>;
}

/**
 * Interface for the Secure Store plugin
 * Extends the base Plugin class with secure-store-specific methods
 */
export interface SecureStorePlugin extends Plugin {
	/**
	 * Create a namespaced storage instance
	 * @param namespace - The namespace to create storage for
	 * @returns A namespaced API Key Store instance
	 */
	createStorage(namespace: string): Promise<APIKeyStore>;
}

/**
 * Type guard to check if a plugin is a SecureStorePlugin
 */
export function isSecureStorePlugin(plugin: Plugin | null): plugin is SecureStorePlugin {
	return plugin !== null && 'createStorage' in plugin && typeof plugin.createStorage === 'function';
}