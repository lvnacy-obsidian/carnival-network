import { APIError } from './api-error';

export class TimeoutError extends APIError {
	constructor(operation: string, timeoutMs: number) {
		super(
			'TIMEOUT',
			`Operation '${operation}' timed out after ${timeoutMs}ms`,
			504,
			{ operation, timeoutMs }
		);
		this.name = 'TimeoutError';
	}
}