/**
 * ============================================================================
 * WEBHOOK TYPES
 * ============================================================================
 * 
 * Generic webhook types for infrastructure-only webhook handling.
 * Service-specific types (GitHub, Beehiiv, etc.) should be defined in
 * integration plugins that consume Carnival Network.
 * 
 * Index of exports:
 * - WebhookHandlerInterface - Interface for custom webhook implementations
 * - WebhookPayload - Generic webhook payload structure
 * - WebhookResponse - Generic webhook response structure
 */

import { CarnivalAct } from './acts-types';

/**
 * Webhook handler interface - implement this for custom webhook integrations
 */
export interface WebhookHandlerInterface {
	handleIncoming(payload: unknown): Promise<void>;
	formatOutgoing(record: CarnivalAct): unknown;
	verify(payload: unknown, signature: string): boolean;
}

/**
 * Webhook payload (generic)
 */
export interface WebhookPayload {
	event: string;
	timestamp: string;
	data: unknown;
	source: {
		pluginId: string;
		performerId: string;
		territory: string;
	};
}

export interface WebhookResponse {
	message: string;
	[key: string]: unknown;
}