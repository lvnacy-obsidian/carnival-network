import { APIError } from './api-error';

export class RateLimitError extends APIError {
	constructor(
		message: string,
		public readonly retryAfter?: number,  // seconds
		public readonly limit?: number
	) {
		super('RATE_LIMIT_EXCEEDED', message, 429, { retryAfter, limit });
		this.name = 'RateLimitError';
	}
}