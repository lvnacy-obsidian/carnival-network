/**
 * ============================================================================
 * AUTHENTICATION
 * ============================================================================
 * 
 * Index of exports:
 * - AuthenticationContext - structure for authentication context
 * - AuthenticationResult - structure for authentication result
 */

import { Certificate } from './certificate-store-types';

export interface AuthenticationContext {
	pluginId: string;
	performerId: string;
	territory: string;
	apiKey?: string;
	certificate?: Certificate;
}

export interface AuthenticationResult {
	authenticated: boolean;
	identity?: {
		pluginId: string;
		performerId: string;
		territory: string;
	};
	error?: string;
}