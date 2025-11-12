import { APIError } from './api-error';

export class AuthorizationError extends APIError {
	constructor(message: string, details?: unknown) {
		super('AUTHORIZATION_FAILED', message, 403, details);
		this.name = 'AuthorizationError';
	}
}