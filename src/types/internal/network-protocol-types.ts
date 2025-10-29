/**
 * ============================================================================
 * NETWORK PROTOCOL
 * ============================================================================
 * 
 * Index of exports:
 * - MessageMetadata - structure for message metadata
 * - MessageType - types of messages
 * - ProtocolMessage - structure for protocol message
 */

export interface MessageMetadata {
	messageId: string;
	timestamp: string;
	source: {
		pluginId: string;
		nodeId: string;
		territory: string;
	};
	destination?: {
		nodeId?: string;
		territory?: string;
	};
	correlationId?: string;
}

export type MessageType =
	| 'REGISTER'
	| 'DISCOVER'
	| 'HEARTBEAT'
	| 'BROADCAST'
	| 'QUERY'
	| 'RESPONSE'
	| 'ERROR';

export interface ProtocolMessage {
	version: string;
	type: MessageType;
	payload: unknown;
	metadata: MessageMetadata;
}