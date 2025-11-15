// Type for dynamically loaded Sentry SDK
export interface SentrySDK {
	init: (config: unknown) => void;
	startTransaction: (config: unknown) => SentryTransaction;
	setTag: (key: string, value: string) => void;
	setMeasurement: (name: string, value: number, unit: string) => void;
	addBreadcrumb: (breadcrumb: unknown) => void;
	captureException: (error: unknown, context?: unknown) => void;
	getCurrentHub?: () => { getClient: () => unknown };
	close: (timeout: number) => Promise<void>;
	BrowserTracing: new () => unknown;
}

export interface SentryTransaction {
	startChild: (config: unknown) => SentrySpan;
	finish: () => void;
}

interface SentrySpan {
	finish: () => void;
}