/**
 * ============================================================================
 * WEBHOOKS (The Announcement System)
 * ============================================================================
 * 
 * Index of exports:
 * - WebhookHandlerInterface - Webhook handler interface
 * - WebhookPayload - Webhook payload (generic)
 */

import { CarnivalRecord } from './records-types';

/**
 * Webhook handler interface - implement this for custom webhook integrations
 */
export interface WebhookHandlerInterface {
	handleIncoming(payload: unknown): Promise<void>;
	formatOutgoing(record: CarnivalRecord): unknown;
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
		nodeId: string;
		territory: string;
	};
}