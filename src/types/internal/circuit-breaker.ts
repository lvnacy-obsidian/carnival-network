/**
 * ============================================================================
 * CIRCUIT BREAKER
 * ============================================================================
 * 
 * Index of exports:
 * - CircuitBreakerConfig - Configuration options for the circuit breaker
 * - CircuitBreakerState - Current state of the circuit breaker
 * - CircuitState - Possible states of the circuit breaker
 */

export interface CircuitBreakerConfig {
	failureThreshold: number;
	successThreshold: number;
	timeout: number;
	resetTimeout: number;
}

export interface CircuitBreakerState {
	state: CircuitState;
	failureCount: number;
	successCount: number;
	lastFailureTime?: number;
	nextAttemptTime?: number;
}

export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';