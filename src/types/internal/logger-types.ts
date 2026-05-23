/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Log entry with structured data
 */
export interface LogEntry {
	timestamp: string;
	level: 'debug' | 'info' | 'warning' | 'error' | 'trace';
	component: string;
	message: string;
	data?: any;
	error?: any;
}

/**
 * Logger configuration
 */
export interface LogConfig {
	format: 'simple' | 'json' | 'structured';
	minLevel: number;
	enableBuffer: boolean;
}