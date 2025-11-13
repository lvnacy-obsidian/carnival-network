/**
 * Type guard to check if a value is a valid date representation.
 * @param value 
 * @returns 
 */
export function isValidDateValue(value: unknown): value is string | number | Date {
	return typeof value === 'string' || 
			typeof value === 'number' || 
			value instanceof Date;
}

/**
 * Safely retrieves a date value from metadata and returns its time in milliseconds.
 * If the key is not present or the value is invalid, returns the provided fallback.
 * @param metadata 
 * @param key 
 * @param fallback 
 * @returns 
 */
export function safeGetDateFromMetadata(
	metadata: Record<string, unknown> | undefined,
	key: string,
	fallback: number
): number {
	const value = metadata?.[key];
	
	if (value === undefined || value === null) {
		return fallback;
	}
	
	try {
		if (typeof value === 'string' || typeof value === 'number' || value instanceof Date) {
			const time = new Date(value).getTime();
			return isNaN(time) ? fallback : time;
		}
	} catch {
		// Invalid date value, use fallback
	}
	
	return fallback;
}