import type {
	NetworkNode,
	NetworkResponse
} from '../types/public';

export class ValidationError extends Error {
	constructor(message: string, public details?: unknown) {
		super(message);
		this.name = 'ValidationError';
	}
}

export function validateNetworkNode(node: unknown): asserts node is NetworkNode {
	if (!node || typeof node !== 'object') {
		throw new ValidationError('Invalid node: expected object');
	}

	const requiredFields = ['id', 'name', 'territory', 'capabilities', 'lastSeen', 'metadata'];
	for (const field of requiredFields) {
		if (!(field in node)) {
			throw new ValidationError(`Invalid node: missing required field "${field}"`);
		}
	}

	const n = node as NetworkNode; // Type assertion for easier checks

	// Validate types of required fields
	if (typeof n.id !== 'string') {
		throw new ValidationError('Invalid node: id must be a string');
	}
	if (typeof n.name !== 'string') {
		throw new ValidationError('Invalid node: name must be a string');
	}
	if (typeof n.territory !== 'string') {
		throw new ValidationError('Invalid node: territory must be a string');
	}
	if (!Array.isArray(n.capabilities)) {
		throw new ValidationError('Invalid node: capabilities must be an array');
	}
	if (typeof n.lastSeen !== 'string' || isNaN(Date.parse(n.lastSeen))) {
		throw new ValidationError('Invalid node: lastSeen must be a valid ISO date string');
	}
	if (!n.metadata || typeof n.metadata !== 'object') {
		throw new ValidationError('Invalid node: metadata must be an object');
	}

	// Optional fields type checking
	if (n.path !== undefined && typeof n.path !== 'string') {
		throw new ValidationError('Invalid node: path must be a string if present');
	}
	if (n.status !== undefined && !['active', 'inactive', 'unknown'].includes(n.status)) {
		throw new ValidationError('Invalid node: status must be active, inactive, or unknown if present');
	}
	if (n.pluginVersion !== undefined && typeof n.pluginVersion !== 'string') {
		throw new ValidationError('Invalid node: pluginVersion must be a string if present');
	}
}

export function validateNetworkNodes(nodes: unknown[]): NetworkNode[] {
	const validNodes: NetworkNode[] = [];

	for (const [index, node] of nodes.entries()) {
		try {
			validateNetworkNode(node);
			validNodes.push(node);
		} catch (error) {
			if (error instanceof ValidationError) {
				throw new ValidationError(
					`Invalid node at index ${index}: ${error.message}`,
					{ index, node, originalError: error }
				);
			}
			throw error;
		}
	}

	return validNodes;
}

export function validateRegistryResponse(data: unknown): asserts data is NetworkResponse {
	if (!data || typeof data !== 'object') {
		throw new ValidationError('Invalid registry response: expected object');
	}

	// Check if it has a nodes array
	if (!('nodes' in data)) {
		throw new ValidationError('Invalid registry response: missing nodes array');
	}

	if (!Array.isArray(data.nodes)) {
		throw new ValidationError('Invalid registry response: nodes is not an array');
	}
}