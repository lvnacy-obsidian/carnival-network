import { Log } from '../utils/logger';
import { CircuitOpenError } from '../errors/circuit-open-error';
import type {
	CircuitBreakerConfig,
	CircuitState
} from '../types/internal';

/**
 * 🎪 Circuit breaker for managing endpoint health
 * 
 * Provides fault tolerance by preventing repeated calls to failing endpoints,
 * allowing them time to recover before retrying.
 * 
 * @version 2.0.0 - Enhanced with metrics, failure classification, and bug fixes
 */
export class CircuitBreaker {
	private state: CircuitState = 'CLOSED';
	private failures: number = 0;
	private lastFailureTime: number = 0;
	private openTime: number = 0;
	private successCount: number = 0;
	
	// Enhanced tracking
	private halfOpenAttempts: number = 0;
	private totalRequests: number = 0;
	private totalSuccesses: number = 0;
	private totalFailures: number = 0;
	private stateChangeTime: number = Date.now();
	private lastError?: unknown;

	constructor(
		private readonly name: string,
		private readonly options: CircuitBreakerConfig
	) {}

	/**
	 * Execute operation with circuit breaker protection
	 * 
	 * @param operation - Async operation to execute
	 * @param shouldTripCircuit - Optional: determine if error should open circuit (default: all errors trip)
	 */
	async execute<T>(
		operation: () => Promise<T>,
		shouldTripCircuit?: (error: unknown) => boolean
	): Promise<T> {
		this.checkState();
		this.totalRequests++;

		if (this.isOpen()) {
			throw new CircuitOpenError(this.name);
		}

		// Track half-open attempts
		if (this.state === 'HALF_OPEN') {
			this.halfOpenAttempts++;
		}

		try {
			const result = await operation();
			this.onSuccess();
			return result;
		} catch (error) {
			this.lastError = error;
			
			// Optional failure classification with safe default
			const shouldTrip = shouldTripCircuit?.(error) ?? true;
			
			if (shouldTrip) {
				this.onFailure();
			}
			throw error;
		}
	}

	/**
	 * Get current circuit state
	 */
	getState(): CircuitState {
		return this.state;
	}

	/**
	 * Get detailed metrics about circuit breaker performance
	 */
	getMetrics() {
		return {
			name: this.name,
			state: this.state,
			failures: this.failures,
			successCount: this.successCount,
			totalRequests: this.totalRequests,
			totalSuccesses: this.totalSuccesses,
			totalFailures: this.totalFailures,
			lastFailureTime: this.lastFailureTime,
			openTime: this.openTime,
			timeInCurrentState: Date.now() - this.stateChangeTime,
			lastError: this.lastError,
			halfOpenAttempts: this.halfOpenAttempts
		};
	}

	/**
	 * Reset circuit breaker to closed state
	 */
	reset(): void {
		this.state = 'CLOSED';
		this.failures = 0;
		this.successCount = 0;
		this.halfOpenAttempts = 0;
		this.lastError = undefined;
		this.changeState('CLOSED');
		
		Log.log({
			context: 'Circuit Breaker',
			path: this.name
		}, `🔌 Circuit manually reset for ${this.name}`);
	}

	/**
	 * Check if circuit is open (rejecting requests)
	 */
	private isOpen(): boolean {
		if (this.state === 'OPEN') {
			return true;
		}
		
		if (this.state === 'HALF_OPEN') {
			// Allow limited requests in half-open state
			const maxHalfOpenRequests = 3; // Could be configurable
			return this.halfOpenAttempts >= maxHalfOpenRequests;
		}
		
		return false;
	}

	/**
	 * Update circuit state based on current conditions
	 */
	private checkState() {
		const now = Date.now();

		// Clear old failures outside window
		if (now - this.lastFailureTime > this.options.timeout) {
			this.failures = 0;
		}

		// Check if we should attempt recovery
		if (this.state === 'OPEN' && now - this.openTime > this.options.resetTimeout) {
			Log.log({
				context: 'Circuit Breaker',
				path: this.name
			}, `🔌 Attempting recovery for ${this.name}`);
			this.changeState('HALF_OPEN');
			this.successCount = 0;
			this.halfOpenAttempts = 0;
		}
	}

	/**
	 * Handle successful operation
	 */
	private onSuccess() {
		this.totalSuccesses++;
		
		if (this.state === 'HALF_OPEN') {
			this.successCount++;
			if (this.successCount >= this.options.successThreshold) {
				Log.log({
					context: 'Circuit Breaker',
					path: this.name
				}, `🔌 Circuit closed for ${this.name} after ${this.successCount} successes`);
				this.changeState('CLOSED');
				this.failures = 0;
				this.successCount = 0;
				this.halfOpenAttempts = 0;
			}
		} else if (this.state === 'CLOSED') {
			// Clear failures after a success in closed state
			this.failures = 0;
		}
	}

	/**
	 * Handle failed operation
	 */
	private onFailure() {
		this.failures++;
		this.totalFailures++;
		this.lastFailureTime = Date.now();

		if (this.state === 'CLOSED' && this.failures >= this.options.failureThreshold) {
			Log.log({
				context: 'Circuit Breaker',
				path: this.name
			}, `🔌 Circuit opened for ${this.name} after ${this.failures} failures`);
			this.changeState('OPEN');
			this.openTime = Date.now();
		} else if (this.state === 'HALF_OPEN') {
			Log.log({
				context: 'Circuit Breaker',
				path: this.name
			}, `🔌 Circuit re-opened for ${this.name} after failed recovery`);
			this.changeState('OPEN');
			this.openTime = Date.now();
			this.halfOpenAttempts = 0;
		}
	}

	/**
	 * Helper to change state with optional callback
	 */
	private changeState(newState: CircuitState) {
		const oldState = this.state;
		this.state = newState;
		this.stateChangeTime = Date.now();
		
		// Optional callback for state changes (if added to config)
		if (this.options.onStateChange && oldState !== newState) {
			try {
				this.options.onStateChange(newState);
			} catch (error) {
				Log.error({
					context: 'Circuit Breaker',
					path: this.name
				}, 'State change callback error:', error);
			}
		}
	}
}