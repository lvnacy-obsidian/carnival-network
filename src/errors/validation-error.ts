import { APIError } from './api-error';

export class ValidationError extends APIError {
	constructor(message: string, public readonly fields?: Record<string, string>) {
		super('VALIDATION_FAILED', message, 400, { fields });
		this.name = 'ValidationError';
	}
}