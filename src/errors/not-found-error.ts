import { APIError } from './api-error';

export class NotFoundError extends APIError {
	constructor(resource: string, identifier?: string) {
		const message = identifier 
			? `${resource} with identifier '${identifier}' not found`
			: `${resource} not found`;
		super('NOT_FOUND', message, 404, { resource, identifier });
		this.name = 'NotFoundError';
	}
}