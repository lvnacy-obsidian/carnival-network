/**
 * ============================================================================
 * 🔐 SECURE STORE MANAGER 🎪
 * ============================================================================
 * 
 * Wrapper for integrating with the secure-store plugin!
 * This class handles all interactions with your Secure Store plugin,
 * providing a clean carnival-themed interface for credential store! 🎭
 * 
 * Key Features:
 * - 🎪 Automatic namespace creation (carnival-network)
 * - 🔒 AES-256-GCM encryption (via Secure Store)
 * - 📱 Desktop + mobile support (iOS/Android)
 * - 🎯 Type-safe store operations
 * - 🎭 Graceful degradation if plugin missing
 * - 🚨 Clear error messages with carnival metaphors
 * 
 * Architecture:
 * This manager sits between the authentication services and the Secure
 * Store plugin, providing a consistent interface and adding carnival-themed
 * error handling! 🎪✨
 * 
 * @module secure-store-manager
 * @category Network/Services
 * @carnival-themed 🎪
 */

import { App, Notice } from 'obsidian';
import { getPlugin } from './plugin-utils';
import { Log } from './logger';
import {
	BackstagePass,
	CARNIVAL_AUTH_CONSTANTS,
	isSecureStorePlugin,
	type APIKeyStore,
	type LogContext
} from '../types/public';

/*
const storeManagerLogger = 
*/

/**
 * 🎪 SecureStoreManager - Carnival's credential vault! 🔐
 * 
 * This class manages all interactions with the Secure Storage plugin,
 * providing encrypted store for backstage passes, JWT secrets,
 * refresh tokens, and webhook secrets! 🎭
 * 
 * Carnival metaphor: The carnival's secure vault where all valuable
 * credentials are kept under lock and key! Only the vault keeper
 * (this manager) knows how to access them safely. 🏦✨
 */
export class SecureStoreManager {
	private app: App;
	private keyStore: APIKeyStore | null = null;
	private isAvailable: boolean = false;
	private storeManagerLogger: LogContext;
	
	/**
	 * 🎪 Create a new Secure Store Manager
	 * 
	 * @param app - Obsidian App instance
	 */
	constructor(app: App) {
		this.app = app;
		this.storeManagerLogger = {
			context: 'Secure Store Manager',
			path: `${ app.vault.configDir }/plugins/obsidian-secure-store/src/utils/secure-store-manager.ts`
		};
	}
	
	/**
	 * 🎯 Initialize the Secure Store connection
	 * 
	 * This method checks if the Secure Storage plugin is installed and
	 * creates a namespaced store instance for Carnival Network! 🎪
	 * 
	 * Carnival metaphor: Opening the vault and getting the keys! 🗝️
	 * 
	 * @returns Promise<boolean> - True if initialization successful
	 */
	async initialize(): Promise<boolean> {
		try {
			// 🔍 Check if Secure Store plugin is installed
			const secureStorePlugin = getPlugin(this.app, 'secure-store');
			
			if (!isSecureStorePlugin(secureStorePlugin)) {
				Log.warn(this.storeManagerLogger, '🎪 [Carnival] Secure Storage plugin not found! Authentication will be disabled.');
				this.showMissingPluginNotice();
				return false;
			}
			
			// ✨ Create namespaced store for Carnival Network
			this.keyStore = await secureStorePlugin.createStorage(
				CARNIVAL_AUTH_CONSTANTS.SECURE_STORE_NAMESPACE
			);
			
			if (!this.keyStore) {
				Log.debug(this.storeManagerLogger, '🎪 [Carnival] Failed to create Secure Store namespace!');
				return false;
			}
			
			this.isAvailable = true;
			Log.log(this.storeManagerLogger, '🎪✨ [Carnival] Secure Store initialized successfully!');
			
			return true;
		} catch (error) {
			Log.error(this.storeManagerLogger, '🎪❌ [Carnival] Error initializing Secure Store:', error);
			this.isAvailable = false;
			return false;
		}
	}
	
	/**
	 * 🔒 Store a value in the secure vault
	 * 
	 * @param key - Storage key
	 * @param value - Value to store (will be encrypted by Secure Store)
	 * @throws Error if Secure Store not available
	 */
	async store(key: string, value: string): Promise<void> {
		this.ensureAvailable();

		if (!this.keyStore) {
			Log.warn(this.storeManagerLogger, 'Key Store not initialized');
			throw new Error('Key Store not initialized');
		}
		
		try {
			await this.keyStore.store(key, value);
			Log.log(this.storeManagerLogger, `🎪🔒 [Carnival] Stored: ${key}`);
		} catch (error) {
			Log.error(this.storeManagerLogger, `🎪❌ [Carnival] Failed to store ${key}:`, error);
			throw new Error(`🎪 Failed to store credentials in the vault: ${error}`);
		}
	}
	
	/**
	 * 🔓 Retrieve a value from the secure vault
	 * 
	 * @param key - Storage key
	 * @returns Decrypted value or null if not found
	 * @throws Error if Secure Store not available
	 */
	async retrieve(key: string): Promise<string | null> {
		this.ensureAvailable();

		if (!this.keyStore) {
			Log.warn(this.storeManagerLogger, 'Key Store not initialized');
			throw new Error('Key Store not initialized');
		}
		
		try {
			const value = await this.keyStore.retrieve(key);
			if (value) {
				Log.log(this.storeManagerLogger, `🎪🔓 [Carnival] Retrieved: ${key}`);
			}
			return value;
		} catch (error) {
			Log.error(this.storeManagerLogger, `🎪❌ [Carnival] Failed to retrieve ${key}:`, error);
			throw new Error(`🎪 Failed to retrieve credentials from the vault: ${error}`);
		}
	}
	
	/**
	 * 🗑️ Remove a value from the secure vault
	 * 
	 * @param key - Storage key
	 * @throws Error if Secure Store not available
	 */
	async remove(key: string): Promise<void> {
		this.ensureAvailable();

		if (!this.keyStore) {
			Log.warn(this.storeManagerLogger, 'Key Store not initialized');
			throw new Error('Key Store not initialized');
		}
		
		try {
			await this.keyStore.remove(key);
			Log.log(this.storeManagerLogger, `🎪🗑️ [Carnival] Removed: ${key}`);
		} catch (error) {
			Log.error(this.storeManagerLogger, `🎪❌ [Carnival] Failed to remove ${key}:`, error);
			throw new Error(`🎪 Failed to remove credentials from the vault: ${error}`);
		}
	}
	
	/**
	 * 🔍 Check if a key exists in the vault
	 * 
	 * @param key - Storage key
	 * @returns True if key exists
	 * @throws Error if Secure Store not available
	 */
	async exists(key: string): Promise<boolean> {
		this.ensureAvailable();

		if (!this.keyStore) {
			Log.warn(this.storeManagerLogger, 'Key Store not initialized');
			throw new Error('Key Store not initialized');
		}
		
		try {
			return await this.keyStore.exists(key);
		} catch (error) {
			Log.error(this.storeManagerLogger, `🎪❌ [Carnival] Failed to check existence of ${key}:`, error);
			return false;
		}
	}
	
	/**
	 * 📋 List all keys in the vault
	 * 
	 * @returns Array of store keys
	 * @throws Error if Secure Store not available
	 */
	async listKeys(): Promise<string[]> {
		this.ensureAvailable();

		if (!this.keyStore) {
			Log.warn(this.storeManagerLogger, 'Key Store not initialized');
			throw new Error('Key Store not initialized');
		}
		
		try {
			const keys = await this.keyStore.listKeys();
			Log.log(this.storeManagerLogger, `🎪📋 [Carnival] Listed ${keys.length} keys`);
			return keys;
		} catch (error) {
			Log.error(this.storeManagerLogger, '🎪❌ [Carnival] Failed to list keys:', error);
			throw new Error(`🎪 Failed to list vault contents: ${error}`);
		}
	}
	
	/**
	 * 🧹 Clear all values from the vault
	 * 
	 * ⚠️ WARNING: This is destructive! Use with caution! ⚠️
	 * 
	 * @throws Error if Secure Store not available
	 */
	async clearAll(): Promise<void> {
		this.ensureAvailable();

		if (!this.keyStore) {
			Log.warn(this.storeManagerLogger, 'Key Store not initialized');
			return;
		}
		
		try {
			await this.keyStore.clearAll();
			Log.warn(this.storeManagerLogger, '🎪🧹 [Carnival] CLEARED ALL vault contents!');
		} catch (error) {
			Log.error(this.storeManagerLogger, '🎪❌ [Carnival] Failed to clear vault:', error);
			throw new Error(`🎪 Failed to clear vault: ${error}`);
		}
	}
	
	/**
	 * ✅ Check if Secure Store is available
	 */
	isSecureStoreAvailable(): boolean {
		return this.isAvailable;
	}
	
	/**
	 * 🎪 Get the store instance (for direct access if needed)
	 * 
	 * @returns APIKeyStorage instance or null
	 */
	getStorage(): APIKeyStore | null {
		return this.keyStore;
	}
	
	/**
	 * 🚨 Ensure Secure Store is available before operations
	 * 
	 * @throws Error if Secure Store not available
	 */
	private ensureAvailable(): void {
		if (!this.isAvailable || !this.keyStore) {
			throw new Error(
				'🎪❌ The carnival vault is locked! Please install the Secure Storage plugin.'
			);
		}
	}
	
	/**
	 * 📢 Show notice about missing Secure Store plugin
	 */
	private showMissingPluginNotice(): void {
		new Notice(
			'🎪 Carnival Network requires the Secure Storage plugin for authentication.\n\n' +
			'📥 Please install it from Community Plugins:\n' +
			'Settings → Community Plugins → Browse → "Secure Storage"\n\n' +
			'🎭 Authentication features will be disabled until installed.',
			0 // Persistent notice
		);
	}
	
	/**
	 * 🎪 Helper: Store JSON data (automatically stringified)
	 * 
	 * @param key - Storage key
	 * @param data - Data to store (will be JSON.stringify'd)
	 */
	async storeJSON<T>(key: string, data: T): Promise<void> {
		await this.store(key, JSON.stringify(data));
	}
	
	/**
	 * 🎪 Helper: Retrieve JSON data (automatically parsed)
	 * 
	 * @param key - Storage key
	 * @returns Parsed data or null if not found
	 */
	async retrieveJSON<T>(key: string): Promise<T | null> {
		const value = await this.retrieve(key);
		if (!value) {
			return null;
		}
		
		try {
			return JSON.parse(value) as T;
		} catch (error) {
			console.error(`🎪❌ [Carnival] Failed to parse JSON for ${key}:`, error);
			throw new Error(`🎪 Invalid JSON data in vault for key: ${key}`);
		}
	}
	
	/**
	 * 🎪 Helper: Store backstage passes (convenience method)
	 */
	async storeBackstagePasses(passes: BackstagePass[]): Promise<void> {
		await this.storeJSON(
			CARNIVAL_AUTH_CONSTANTS.SECURE_STORE_KEYS.BACKSTAGE_PASSES,
			passes
		);
	}
	
	/**
	 * 🎪 Helper: Retrieve backstage passes (convenience method)
	 */
	async retrieveBackstagePasses(): Promise<BackstagePass[] | null> {
		return await this.retrieveJSON(
			CARNIVAL_AUTH_CONSTANTS.SECURE_STORE_KEYS.BACKSTAGE_PASSES
		);
	}
	
	/**
	 * 🎪 Helper: Store JWT secret (convenience method)
	 */
	async storeJWTSecret(secret: string): Promise<void> {
		await this.store(
			CARNIVAL_AUTH_CONSTANTS.SECURE_STORE_KEYS.JWT_SECRET,
			secret
		);
	}
	
	/**
	 * 🎪 Helper: Retrieve JWT secret (convenience method)
	 */
	async retrieveJWTSecret(): Promise<string | null> {
		return await this.retrieve(
			CARNIVAL_AUTH_CONSTANTS.SECURE_STORE_KEYS.JWT_SECRET
		);
	}
}