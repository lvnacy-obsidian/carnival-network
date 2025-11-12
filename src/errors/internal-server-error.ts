import { APIError } from './api-error';

export class InternalServerError extends APIError {
	constructor(message: string, originalError?: unknown) {
		super('INTERNAL_SERVER_ERROR', message, 500, { originalError });
		this.name = 'InternalServerError';
	}
}