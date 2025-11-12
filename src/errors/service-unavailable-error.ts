import { APIError } from './api-error';

export class ServiceUnavailableError extends APIError {
	constructor(service: string, reason?: string) {
		const message = reason 
			? `${service} is unavailable: ${reason}`
			: `${service} is unavailable`;
		super('SERVICE_UNAVAILABLE', message, 503, { service, reason });
		this.name = 'ServiceUnavailableError';
	}
}