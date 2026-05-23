import { CircuitBreaker } from '../services/circuit-breaker';
import type {
	CircuitBreakerConfig,
	CircuitState
} from '../../types/internal';

/**
 * 🎪 Registry endpoint state manager with circuit breaker
 * 
 * Manages circuit breakers for each registry endpoint to provide
 * fault tolerance and automatic recovery from failing endpoints.
 */
export class EndpointHealthMonitor {
	private breakers: Map<string, CircuitBreaker> = new Map();
	private defaultOptions: CircuitBreakerConfig = {
		failureThreshold: 3,
		successThreshold: 2,   // 2 consecutive successes to restore
		timeout: 60000,        // 1 minute
		resetTimeout: 30000    // 30 seconds
	};

	private options: CircuitBreakerConfig;

	// Simple in-memory metrics per endpoint
	private metrics: Map<string, { requests: number; successes: number; failures: number }> = new Map();

	constructor(
		private readonly endpoints: string[],
		options?: Partial<CircuitBreakerConfig>
	) {
		this.options = { ...this.defaultOptions, ...options };
		for (const endpoint of this.endpoints) {
			this.breakers.set(endpoint, new CircuitBreaker(endpoint, this.options));
			this.metrics.set(endpoint, { requests: 0, successes: 0, failures: 0 });
		}
	}

	/**
	 * Execute operation against endpoint with circuit breaker protection
	 */
	async executeEndpoint<T>(
		endpoint: string,
		operation: () => Promise<T>
	): Promise<T> {
		const breaker = this.breakers.get(endpoint);
		if (!breaker) {
			throw new Error(`No circuit breaker for endpoint: ${endpoint}`);
		}

		// Track request metrics
		const m = this.metrics.get(endpoint);

		if (m) {
			m.requests++;
		}

		try {
			const result = await breaker.execute(operation);

			if (m) {
				m.successes++;
			}

			return result;
		} catch (err) {

			if (m) {
				m.failures++;
			}

			throw err;
		}
	}

	/**
	 * Get endpoint health states
	 */
	getEndpointStates(): Map<string, CircuitState> {
		const states = new Map<string, CircuitState>();
		for (const [endpoint, breaker] of this.breakers) {
			states.set(endpoint, breaker.getState());
		}
		return states;
	}

	/**
	 * Get a snapshot of metrics per endpoint
	 */
	getMetrics(): Record<string, { requests: number; successes: number; failures: number }> {
		const out: Record<string, { requests: number; successes: number; failures: number }> = {};
		for (const [endpoint, m] of this.metrics) {
			out[endpoint] = { ...m };
		}
		return out;
	}

	/**
	 * Update the set of endpoints managed by the registry manager.
	 * Adds new breakers for new endpoints and removes breakers for endpoints that are no longer present.
	 */
	updateEndpoints(newEndpoints: string[]) {
		// Add new endpoints
		for (const endpoint of newEndpoints) {
			if (!this.breakers.has(endpoint)) {
				this.breakers.set(endpoint, new CircuitBreaker(endpoint, this.options));
				this.metrics.set(endpoint, { requests: 0, successes: 0, failures: 0 });
			}
		}

		// Remove endpoints that are no longer present
		for (const existing of Array.from(this.breakers.keys())) {
			if (!newEndpoints.includes(existing)) {
				this.breakers.delete(existing);
				this.metrics.delete(existing);
			}
		}
	}
}