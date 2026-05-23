/* eslint-disable no-console */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { Notice } from 'obsidian';
import type {
	LogConfig,
	LogEntry
} from '../types/internal';

/**
 * Emergency (emerg): indicates that the system is unusable and requires immediate attention.
 * Alert (alert): indicates that immediate action is necessary to resolve a critical issue.
 * Critical (crit): signifies critical conditions in the program that demand intervention to prevent system failure.
 * Error (error): indicates error conditions that impair some operation but are less severe than critical situations.
 * Warning (warn): signifies potential issues that may lead to errors or unexpected behavior in the future if not addressed.
 * Notice (notice): applies to normal but significant conditions that may require monitoring.
 * Informational (info): includes messages that provide a record of the normal operation of the system.
 * Debug (debug): intended for logging detailed information about the system for debugging purposes.
 * 
 * @param { Object } context
 * @param { string } message
 * @param { Object } error
 * 
 */

class LoggerSystem {
	private buffer: LogEntry[] = [];
	private config: LogConfig = {
		format: 'simple',
		minLevel: 1,
		enableBuffer: true
	};
	private levelMap: Record<string, number> = {
		debug: 0,
		info: 1,
		warning: 2,
		error: 3,
		trace: 0
	};

	configure(config: Partial<LogConfig>): void {
		this.config = { ...this.config, ...config };
	}

	getConfig(): LogConfig {
		return { ...this.config };
	}

	logEntry(level: keyof typeof this.levelMap, context: any, message: string, data?: any): LogEntry {
		const component = context?.context ?? 'unknown';
		const entry: LogEntry = {
			timestamp: new Date().toISOString(),
			level: level as any,
			component,
			message,
			...(data && { data })
		};

		if (this.config.enableBuffer) {
			this.buffer.push(entry);
			if (this.buffer.length > 500) {
				this.buffer = this.buffer.slice(-500);
			}
		}

		return entry;
	}

	getLogs(filter?: { level?: string; component?: string; limit?: number }): LogEntry[] {
		let logs = [...this.buffer];

		if (filter?.level) {
			logs = logs.filter(l => l.level === filter.level);
		}
		if (filter?.component) {
			logs = logs.filter(l => l.component === filter.component);
		}
		if (filter?.limit) {
			logs = logs.slice(-filter.limit);
		}

		return logs;
	}

	exportJSON(filter?: { level?: string; component?: string; limit?: number }): string {
		return JSON.stringify(this.getLogs(filter), null, 2);
	}

	exportCSV(filter?: { level?: string; component?: string; limit?: number }): string {
		const logs = this.getLogs(filter);
		const headers = ['timestamp', 'level', 'component', 'message', 'data'];
		const rows = logs.map(log => [
			log.timestamp,
			log.level,
			log.component,
			log.message,
			log.data ? JSON.stringify(log.data) : ''
		]);

		const csv = [
			headers.join(','),
			...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
		].join('\n');

		return csv;
	}

	clearBuffer(): void {
		this.buffer = [];
	}
}

const loggerSystem = new LoggerSystem();

export const Log = {

	error: (context: any, message: string, error: any) => {
		loggerSystem.logEntry('error', context, message, error);
		new Notice(`ERROR: ${ message }\nCheck the console for details`);
		console.error(context, new Error(message), error);
	},

	warn: (context: any, message: string, error?: any) => {
		loggerSystem.logEntry('warning', context, message, error);
		new Notice(`WARN: ${ message }\nCheck the console for details`);
		console.warn(context, new Error(message), error);
	},

	log: (context: any, message: string, item?: any) => {
		loggerSystem.logEntry('info', context, message, item);
		new Notice(`LOG: ${ message } ${ item }`);
		item ? console.log(context, message, item) : console.log(context, message);
	},

	info: (context: any, message: string, item?: any) => {
		loggerSystem.logEntry('info', context, message, item);
		new Notice(`INFO: ${ message } ${ item }`);
		console.info(context, message, item);
	},

	debug: (context: any, message: string) => {
		loggerSystem.logEntry('debug', context, message);
		new Notice(`DEBUG: ${ message }`);
		console.debug(context, message);
	},

	trace: (context: any, message: string) => {
		loggerSystem.logEntry('trace', context, message);
		new Notice(`TRACE: ${ message }\nCheck console for details`);
		console.trace(context, message);
	}
};

/**
 * Advanced logging configuration and export
 */
export const LoggerConfig = {
	configure: (config: Partial<LogConfig>) => loggerSystem.configure(config),
	getConfig: () => loggerSystem.getConfig(),
	getLogs: (filter?: { level?: string; component?: string; limit?: number }) => loggerSystem.getLogs(filter),
	exportJSON: (filter?: { level?: string; component?: string; limit?: number }) => loggerSystem.exportJSON(filter),
	exportCSV: (filter?: { level?: string; component?: string; limit?: number }) => loggerSystem.exportCSV(filter),
	clearBuffer: () => loggerSystem.clearBuffer()
};
