// network/error-handler.ts
import { Log } from '../../utils/logger';
import { 
	ApiError, 
	InternalServerError
} from '../../errors';
import type {
	ApiResponse,
	LogContext
} from '../../types';

const errorLogger: LogContext = {
	context: 'API Error Handler',
	path: '/.obsidian/plugins/carnival-records/network/error-handler'
};

/**
 * Convert errors to standardized API responses
 */
export function handleError(error: unknown, operation: string): ApiResponse {
	// Handle known ApiError types
	if (error instanceof ApiError) {
		// Log based on severity
		if (error.statusCode >= 500) {
			Log.error(errorLogger, `${ operation } failed:`, error);
		} else if (error.statusCode >= 400) {
			Log.warn(errorLogger, `${ operation } client error:`, error.message);
		}
		
		return error.toJSON();
	}

	// Handle circuit breaker errors specially
	if (error instanceof Error && error.message.includes('Circuit breaker')) {
		Log.warn(errorLogger, `${operation} circuit open:`, error.message);

		return {
			status: 'error',
			error: 'CIRCUIT_OPEN',
			message: error.message,
			details: { operation },
			timestamp: new Date().toISOString()
		};
	}

	// Handle unknown errors
	Log.error(errorLogger, `${ operation } unexpected error:`, error);
	
	const internalError = new InternalServerError(
		'An unexpected error occurred',
		error
	);
	
	return internalError.toJSON();
}