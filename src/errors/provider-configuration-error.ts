/**
 * Validation errors for provider configuration
 */
export class ProviderConfigurationError extends Error {
	constructor(
		public readonly provider: string,
		message: string,
		public readonly field?: string
	) {
		super(`[${provider}] ${message}`);
		this.name = 'ProviderConfigurationError';
	}
}