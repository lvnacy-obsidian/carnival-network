export class APIError extends Error {
	constructor(
		public readonly code: string,
		message: string,
		public readonly statusCode: number,
		public readonly details?: unknown
	) {
		super(message);
		this.name = 'ApiError';
	}

	toJSON() {
		return {
			status: 'error' as const,
			error: this.code,
			message: this.message,
			details: this.details,
			timestamp: new Date().toISOString()
		};
	}
}