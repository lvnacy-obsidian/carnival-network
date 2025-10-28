import { Log } from '../utils/logger';
import { CircuitOpenError } from '../errors/circuit-open-error';
import type {
	CircuitBreakerOptions,
	CircuitState
} from '../types';

/**
 * Circuit breaker for managing endpoint health
 * 
 * @version 2.0.0 - Enhanced with metrics, failure classification, and bug fixes
 * @backward-compatible All existing code continues to work unchanged
 */
export class CircuitBreaker {
	private state: CircuitState = 'closed';
	private failures: number = 0;
	private lastFailureTime: number = 0;
	private openTime: number = 0;
	private successCount: number = 0;
	
	// NEW: Enhanced tracking (doesn't affect existing functionality)
	private halfOpenAttempts: number = 0;
	private totalRequests: number = 0;
	private totalSuccesses: number = 0;
	private totalFailures: number = 0;
	private stateChangeTime: number = Date.now();
	private lastError?: unknown;

	constructor(
		private readonly name: string,
		private readonly options: CircuitBreakerOptions
	) {}

	/**
	 * Execute operation with circuit breaker protection
	 * 
	 * @param operation - Async operation to execute
	 * @param shouldTripCircuit - Optional: determine if error should open circuit (default: all errors trip)
	 */
	async execute<T>(
		operation: () => Promise<T>,
		shouldTripCircuit?: (error: unknown) => boolean  // NEW, OPTIONAL
	): Promise<T> {
		this.checkState();
		this.totalRequests++;

		if (this.isOpen()) {
			throw new CircuitOpenError(this.name);
		}

		// Track half-open attempts
		if (this.state === 'half-open') {
			this.halfOpenAttempts++;
		}

		try {
			const result = await operation();
			this.onSuccess();
			return result;
		} catch (error) {
			this.lastError = error;
			
			// NEW: Optional failure classification with safe default
			const shouldTrip = shouldTripCircuit?.(error) ?? true;
			
			if (shouldTrip) {
				this.onFailure();
			}
			throw error;
		}
	}

	/**
	 * Get current circuit state
	 * @unchanged - existing method signature preserved
	 */
	getState(): CircuitState {
		return this.state;
	}

	/**
	 * NEW: Get detailed metrics about circuit breaker performance
	 * @additive - new method, doesn't affect existing code
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
	 * NEW: Reset circuit breaker to closed state
	 * @additive - new method for manual recovery
	 */
	reset(): void {
		this.state = 'closed';
		this.failures = 0;
		this.successCount = 0;
		this.halfOpenAttempts = 0;
		this.lastError = undefined;
		this.changeState('closed');
		
		Log.log({
			context: 'Circuit Breaker',
			path: this.name
		}, `🔌 Circuit manually reset for ${this.name}`);
	}

	/**
	 * FIXED: Check if circuit is open (rejecting requests)
	 * @bug-fix - corrected half-open logic
	 */
	private isOpen(): boolean {
		if (this.state === 'open') {
			return true;
		}
		
		if (this.state === 'half-open') {
			// Allow limited requests in half-open state
			const maxHalfOpenRequests = this.options.halfOpenRequests ?? 3;
			return this.halfOpenAttempts >= maxHalfOpenRequests;
		}
		
		return false;
	}

	/**
	 * Update circuit state based on current conditions
	 * @unchanged - internal logic preserved
	 */
	private checkState() {
		const now = Date.now();

		// Clear old failures outside window
		if (now - this.lastFailureTime > this.options.failureWindow) {
			this.failures = 0;
		}

		// Check if we should attempt recovery
		if (this.state === 'open' && now - this.openTime > this.options.resetTimeout) {
			Log.log({
				context: 'Circuit Breaker',
				path: this.name
			}, `🔌 Attempting recovery for ${this.name}`);
			this.changeState('half-open');
			this.successCount = 0;
			this.halfOpenAttempts = 0;  // Reset attempt counter
		}
	}

	/**
	 * Handle successful operation
	 * @enhanced - added metrics tracking
	 */
	private onSuccess() {
		this.totalSuccesses++;
		
		if (this.state === 'half-open') {
			this.successCount++;
			if (this.successCount >= this.options.successThreshold) {
				Log.log({
					context: 'Circuit Breaker',
					path: this.name
				}, `🔌 Circuit closed for ${this.name} after ${this.successCount} successes`);
				this.changeState('closed');
				this.failures = 0;
				this.successCount = 0;
				this.halfOpenAttempts = 0;
			}
		} else if (this.state === 'closed') {
			// Clear failures after a success in closed state
			this.failures = 0;
		}
	}

	/**
	 * Handle failed operation
	 * @enhanced - added metrics tracking
	 */
	private onFailure() {
		this.failures++;
		this.totalFailures++;
		this.lastFailureTime = Date.now();

		if (this.state === 'closed' && this.failures >= this.options.failureThreshold) {
			Log.log({
				context: 'Circuit Breaker',
				path: this.name
			}, `🔌 Circuit opened for ${this.name} after ${this.failures} failures`);
			this.changeState('open');
			this.openTime = Date.now();
		} else if (this.state === 'half-open') {
			Log.log({
				context: 'Circuit Breaker',
				path: this.name
			}, `🔌 Circuit re-opened for ${this.name} after failed recovery`);
			this.changeState('open');
			this.openTime = Date.now();
			this.halfOpenAttempts = 0;
		}
	}

	/**
	 * NEW: Helper to change state with optional callback
	 * @internal - supports optional state change notifications
	 */
	private changeState(newState: CircuitState) {
		const oldState = this.state;
		this.state = newState;
		this.stateChangeTime = Date.now();
		
		// Optional callback for state changes
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