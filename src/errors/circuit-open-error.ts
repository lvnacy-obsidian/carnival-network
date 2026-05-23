import { APIError } from './api-error';

export class CircuitOpenError extends APIError {
	constructor(circuitName: string) {
		super(
			'CIRCUIT_OPEN',
			`Circuit breaker for ${ circuitName } is open`,
			503  // Service Unavailable
		);
		this.name = 'CircuitOpenError';
	}
}