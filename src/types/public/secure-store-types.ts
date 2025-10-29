/**
 * ============================================================================
 * STORAGE INTERFACE (from Secure Storage plugin)
 * ============================================================================
 * 
 * Index of exports:
 * - APIKeyStorage - Interface for secure storage operations
 */

/**
 * Storage interface - must be provided by Secure Storage plugin
 */
export interface APIKeyStorage {
	store(key: string, value: string): Promise<void>;
	retrieve(key: string): Promise<string | null>;
	remove(key: string): Promise<void>;
	exists(key: string): Promise<boolean>;
	listKeys(): Promise<string[]>;
	clearAll(): Promise<void>;
}