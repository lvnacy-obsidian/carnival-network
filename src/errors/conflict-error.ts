import { APIError } from './api-error';

export class ConflictError extends APIError {
	constructor(message: string, details?: unknown) {
		super('CONFLICT', message, 409, details);
		this.name = 'ConflictError';
	}
}