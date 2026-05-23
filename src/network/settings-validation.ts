import { CarnivalNetworkSettings } from '../types/public';

/**
 * Settings validation utility
 */
export function validateCarnivalSettings(settings: Partial<CarnivalNetworkSettings>): string[] {
	const errors: string[] = [];

	// Validate external API keys
	if (settings.externalApiKeys) {
		for (const [apiKey, config] of Object.entries(settings.externalApiKeys)) {
			if (config.permissions?.length === 0) {
				errors.push(`API key '${apiKey}' must have at least one permission`);
			}
			if (config.sessionDuration <= 0) {
				errors.push(`API key '${apiKey}' session duration must be positive`);
			}
		}
	}

	// Validate network settings
	if (settings.network) {
		if (settings.network.communicationTimeout <= 0) {
			errors.push('Network communication timeout must be positive');
		}
		if (settings.network.maxConnections <= 0) {
			errors.push('Network max connections must be positive');
		}
	}

	return errors;
}