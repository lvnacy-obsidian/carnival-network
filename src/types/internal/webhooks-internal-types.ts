/**
 * ============================================================================
 * WEBHOOK INTERNAL
 * ============================================================================
 * 
 * Index of exports:
 * - WebhookDelivery - structure for a webhook delivery attempt
 * - WebhookVerification - structure for webhook verification result
 */

export interface WebhookDelivery {
	id: string;
	handlerId: string;
	payload: unknown;
	attempt: number;
	maxAttempts: number;
	status: 'pending' | 'delivering' | 'success' | 'failed';
	lastAttempt?: string;
	nextAttempt?: string;
	error?: string;
}

export interface WebhookVerification {
	valid: boolean;
	handlerId: string;
	error?: string;
}