import type {
	NetworkRequestResponse,
	Performer
} from '../types/public';

export class ValidationError extends Error {
	constructor(message: string, public details?: unknown) {
		super(message);
		this.name = 'ValidationError';
	}
}

export function validatePerformer(performer: unknown): asserts performer is Performer {
	if (!performer || typeof performer !== 'object') {
		throw new ValidationError('Invalid performer: expected object');
	}

	const requiredFields = ['id', 'name', 'territory', 'capabilities', 'lastSeen', 'metadata'];
	for (const field of requiredFields) {
		if (!(field in performer)) {
			throw new ValidationError(`Invalid performer: missing required field "${field}"`);
		}
	}

	const n = performer as Performer; // Type assertion for easier checks

	// Validate types of required fields
	if (typeof n.id !== 'string') {
		throw new ValidationError('Invalid performer: id must be a string');
	}
	if (typeof n.name !== 'string') {
		throw new ValidationError('Invalid performer: name must be a string');
	}
	if (typeof n.territory !== 'string') {
		throw new ValidationError('Invalid performer: territory must be a string');
	}
	if (!Array.isArray(n.capabilities)) {
		throw new ValidationError('Invalid performer: capabilities must be an array');
	}
	if (typeof n.lastSeen !== 'string' || isNaN(Date.parse(n.lastSeen))) {
		throw new ValidationError('Invalid performer: lastSeen must be a valid ISO date string');
	}
	if (!n.metadata || typeof n.metadata !== 'object') {
		throw new ValidationError('Invalid performer: metadata must be an object');
	}

	// Optional fields type checking
	if (n.path !== undefined && typeof n.path !== 'string') {
		throw new ValidationError('Invalid performer: path must be a string if present');
	}
	if (n.status !== undefined && !['active', 'inactive', 'unknown'].includes(n.status)) {
		throw new ValidationError('Invalid performer: status must be active, inactive, or unknown if present');
	}
	if (n.pluginVersion !== undefined && typeof n.pluginVersion !== 'string') {
		throw new ValidationError('Invalid performer: pluginVersion must be a string if present');
	}
}

export function validatePerformers(performers: unknown[]): Performer[] {
	const validPerformers: Performer[] = [];

	for (const [index, performer] of performers.entries()) {
		try {
			validatePerformer(performer);
			validPerformers.push(performer);
		} catch (error) {
			if (error instanceof ValidationError) {
				throw new ValidationError(
					`Invalid performer at index ${index}: ${error.message}`,
					{ index, performer, originalError: error }
				);
			}
			throw error;
		}
	}

	return validPerformers;
}

export function validateRegistryResponse(data: unknown): asserts data is NetworkRequestResponse {
	if (!data || typeof data !== 'object') {
		throw new ValidationError('Invalid registry response: expected object');
	}

	// Check if it has a performers array
	if (!('performers' in data)) {
		throw new ValidationError('Invalid registry response: missing performers array');
	}

	if (!Array.isArray(data.performers)) {
		throw new ValidationError('Invalid registry response: performers is not an array');
	}
}