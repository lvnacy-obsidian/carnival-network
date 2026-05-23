import { Log } from '../../../utils/logger';
import type {
	LocalRestAPIPublic,
	MetricDataPoint
} from '../../../types/public';

const metricsLogger = {
	context: 'Observability Metrics',
	path: 'src/network/services/observability/metrics.ts'
};

// Simple in-memory registry
const counters: Map<string, number> = new Map();
const gauges: Map<string, number> = new Map();

export function incrementCounter(name: string, value = 1) {
	counters.set(name, (counters.get(name) ?? 0) + value);
}

export function setGauge(name: string, value: number) {
	gauges.set(name, value);
}

export function recordMetricPoint(point: MetricDataPoint) {
	try {
		switch (point.type) {
			case 'counter':
				incrementCounter(point.name, point.value);
				break;
			case 'gauge':
				setGauge(point.name, point.value);
				break;
			default:
				// ignore histograms for now
				break;
		}
	} catch (err) {
		Log.error(metricsLogger, 'Failed to record metric point', err);
	}
}

export function getPrometheusText(): string {
	const lines: string[] = [];

	for (const [name, value] of counters.entries()) {
		const metricName = sanitizeMetricName(name);
		lines.push(`# TYPE ${metricName} counter`);
		lines.push(`${metricName} ${value}`);
	}

	for (const [name, value] of gauges.entries()) {
		const metricName = sanitizeMetricName(name);
		lines.push(`# TYPE ${metricName} gauge`);
		lines.push(`${metricName} ${value}`);
	}

	return `${lines.join('\n')}\n`;
}

function sanitizeMetricName(name: string): string {
	return name.replace(/[^a-zA-Z0-9_:]/g, '_');
}

/**
 * Register metrics endpoint with Local REST API plugin.
 * 
 * @param localRestAPI - The public API instance from obsidian-local-rest-api
 * @param path - The endpoint path (default: /carnival/metrics)
 * @returns true if registration succeeded, false otherwise
 */
export function registerMetricsEndpoint(
	localRestAPI: LocalRestAPIPublic | undefined,
	path = '/carnival/metrics'
): boolean {
	try {
		if (!localRestAPI) {
			Log.warn(metricsLogger, 'Local REST API plugin not available');
			return false;
		}

		const route = localRestAPI.addRoute(path);
		route.get((_req: unknown, res: unknown) => {
			// res is an express-like response object
			const response = res as Record<string, unknown>;
			if (typeof response.set === 'function') {
				(response.set as (name: string, value: string) => unknown)('Content-Type', 'text/plain');
			}
			if (typeof response.status === 'function' && typeof response.send === 'function') {
				const statusResult = (response.status as (code: number) => unknown)(200);
				(statusResult as Record<string, (data: string) => unknown>).send?.(getPrometheusText());
			}
		});

		Log.log(metricsLogger, `Registered metrics endpoint at ${path}`);
		return true;
	} catch (err) {
		Log.error(metricsLogger, 'Failed to register metrics endpoint', err);
		return false;
	}
}
