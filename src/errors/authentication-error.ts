import { APIError } from './api-error';

export class AuthenticationError extends APIError {
	constructor(message: string, details?: unknown) {
		super('AUTHENTICATION_FAILED', message, 401, details);
		this.name = 'AuthenticationError';
	}
}