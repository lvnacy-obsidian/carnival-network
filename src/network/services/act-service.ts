// services/record-service.ts
import { Log } from '../../utils/logger';
import { fetchWithRetry } from '../http-client';
import { TerritoryAccessService } from './territory-access-service';
import {
	NotFoundError,
	ServiceUnavailableError
} from '../../errors';
import type {
	CarnivalRecord,
	CreateActParams,
	LogContext,
	CarnivalConfiguration,
	NetworkRequestResponse,
	ActCountOptions,
	ActQueryOptions,
	TerritoryNode,
	SearchOptions,
	SearchResult
} from '../../types/public';

const recordLogger: LogContext = {
	context: 'Record Service',
	path: '/.obsidian/plugins/carnival-records/network/services/record-service'
};

/**
 * Handles record operations - querying, creating, broadcasting
 */
export class ActService {
	constructor(
		private readonly territoryAccess: TerritoryAccessService,
		private readonly config: CarnivalConfiguration
	) {}

	/**
	 * ============================================================================
	 * RECORD CREATION & BROADCAST
	 * ============================================================================
	 */

	/**
	 * Create a new record
	 */
	createAct(params: CreateActParams): CarnivalRecord {
		const record: CarnivalRecord = {
			id: this.generateRecordId(),
			title: params.title,
			territory: params.territory,
			recordType: params.recordType,
			content: params.content,
			metadata: {
				...params.metadata,
				createdAt: new Date().toISOString()
			},
			createdAt: new Date().toISOString(),
			status: 'active',
			syncPreferences: {
				requireAck: true,
				broadcastToAll: false,
				targetTerritories: [params.territory]
			}
		};

		return record;
	}

	/**
	 * Generate unique record ID
	 */
	generateRecordId(): string {
		return `record-${ Date.now().toString(36) }-${ Math.random().toString(36).substring(2) }`;
	}

	/**
	 * Generate summary for a record
	 */
	generateSummary(record: CarnivalRecord): string {
		if (!record.content || record.content.length <= 200) {
			return record.content ?? 'No content available';
		}
		
		const sentences = record.content.split(/[.!?]+/).filter(s => s.trim());
		if (sentences.length > 0) {
			const firstSentence = sentences[0].trim();
			if (firstSentence.length <= 200) {
				return `${ firstSentence }.`;
			}
		}
		
		return `${ record.content.substring(0, 197) }...`;
	}

	private createChangelogRecord(node: TerritoryNode): CarnivalRecord {
		return {
			id: `changelog-${ node.nodeId }-${ Date.now() }`,
			title: `Recent Changes in ${ node.territoryName }`,
			territory: node.territoryName,
			recordType: 'changelog',
			content: `Development activity in ${ node.territoryName } territory. Node ${ node.nodeId } reporting operational status.`,
			metadata: {
				nodeId: node.nodeId,
				lastSeen: node.lastSeen,
				capabilities: node.capabilities
			},
			createdAt: node.lastSeen ?? new Date().toISOString(),
			status: 'active',
			syncPreferences: {
				requireAck: true,
				broadcastToAll: false,
				targetTerritories: [node.territoryName]
			}
		};
	}

	private createConversationRecord(node: TerritoryNode): CarnivalRecord {
		return {
			id: `conversation-${ node.nodeId }-${ Date.now() }`,
			title: `Network Communication - ${ node.territoryName }`,
			territory: node.territoryName,
			recordType: 'conversation',
			content: `Inter-node communication logged for territory ${ node.territoryName }. Active protocols: ${ node.capabilities.join(', ') }.`,
			metadata: {
				nodeId: node.nodeId,
				protocols: node.capabilities,
				connectionType: 'http-registry'
			},
			createdAt: node.discoveredAt ?? new Date().toISOString(),
			status: 'active',
			syncPreferences: {
				requireAck: false,
				broadcastToAll: true,
				targetTerritories: []
			}
		};
	}

	/**
	 * Broadcast record to network
	 */
	async broadcastRecord(record: CarnivalRecord): Promise<void> {
		try {
			if (!this.territoryAccess.isAvailable()) {
				throw new ServiceUnavailableError(
					'Registry Service',
					'Node registry is not initialized'
				);
			}
			
			const allNodes = this.territoryAccess.getAllNodes();
			let targetNodes = allNodes;

			if (!record.syncPreferences.targetTerritories) {
				throw new NotFoundError(
					'Target Territories',
					'No target territories specified for record broadcast'
				);
			}
			
			if (!record.syncPreferences.broadcastToAll && 
				record.syncPreferences.targetTerritories) {
				targetNodes = allNodes.filter(node => 
					record.syncPreferences.targetTerritories?.includes(node.territoryName)
				);
			}
			
			const broadcastPromises = targetNodes.map(async (node) => {
				try {
					const payload = {
						record,
						source: {
							nodeId: 'local-api-service',
							territory: 'external-api'
						},
						timestamp: new Date().toISOString(),
						requireAck: record.syncPreferences.requireAck
					};
					
					const endpoint = `${node.endpoint}/carnival/network/broadcast`;
					const response = await this.makeNetworkRequest(endpoint, 'POST', payload);
					
					if (response.ok) {
						Log.log(recordLogger, 
							`Record broadcast successful to ${node.territoryName} (${node.nodeId})`
						);
					} else {
						Log.warn(recordLogger, 
							`Record broadcast failed to ${node.territoryName}: ${response.status}`
						);
					}
				} catch (error) {
					Log.error(recordLogger, `Broadcast error to ${node.territoryName}:`, error);
				}
			});
			
			await Promise.allSettled(broadcastPromises);
			Log.log(recordLogger, `Record ${record.id} broadcast to ${targetNodes.length} nodes`);
			
		} catch (error) {
			Log.error(recordLogger, 'Failed to broadcast record:', error);
			throw error;
		}
	}

	/**
	 * ============================================================================
	 * QUERY RECORDS & SEARCH
	 * ============================================================================
	 */

	/**
	 * Query records based on parameters
	 */
	queryRecords(params: ActQueryOptions): CarnivalRecord[] {
		try {
			const allNodes = this.territoryAccess.getAllNodes();
			
			const filteredNodes = params.territory 
				? allNodes.filter(node => node.territoryName === params.territory)
				: allNodes;
			
			const records: CarnivalRecord[] = [];
			
			for (const node of filteredNodes) {
				if (node.capabilities.includes('changelog_sync') && 
					(!params.type || params.type === 'changelog')) {
					records.push(this.createChangelogRecord(node));
				}
				
				if (node.capabilities.includes('conversation_sync') && 
					(!params.type || params.type === 'conversation')) {
					records.push(this.createConversationRecord(node));
				}
			}
			
			const startIndex = params.offset;
			const endIndex = startIndex + params.limit;
			return records.slice(startIndex, endIndex);
			
		} catch (error) {
			Log.error(recordLogger, 'Failed to query records:', error);
			return [];
		}
	}

	/**
	 * Count records matching parameters
	 */
	countRecords(params: ActCountOptions): number {
		try {
			const allNodes = this.territoryAccess.getAllNodes();
			
			const filteredNodes = params.territory 
				? allNodes.filter(node => node.territoryName === params.territory)
				: allNodes;
			
			let count = 0;
			for (const node of filteredNodes) {
				if (!params.type || params.type === 'changelog') {
					if (node.capabilities.includes('changelog_sync')) {
						count++;
					}
				}
				if (!params.type || params.type === 'conversation') {
					if (node.capabilities.includes('conversation_sync')) {
						count++;
					}
				}
			}
			
			return count;
		} catch (error) {
			Log.error(recordLogger, 'Failed to count records:', error);
			return 0;
		}
	}

	/**
	 * Perform search across territories
	 */
	performSearch(params: SearchOptions): SearchResult[] {
		try {
			const results: SearchResult[] = [];
			const query = params.query.toLowerCase();
			
			const allNodes = this.territoryAccess.getAllNodes();
			
			for (const node of allNodes) {
				if (params.territories.length > 0 && 
					!params.territories.includes(node.territoryName)) {
					continue;
				}
				
				const searchableText = `
					${ node.territoryName } 
					${ node.nodeId } 
					${ node.endpoint } 
					${ node.capabilities.join(' ') }
				`.toLowerCase();
				
				if (searchableText.includes(query)) {
					results.push({
						id: `search-result-${ node.nodeId }`,
						title: `${ node.territoryName } Territory Node`,
						type: 'network_node',
						territory: node.territoryName,
						content: `
							Node ID: ${ node.nodeId }
							Endpoint: ${ node.endpoint }
							Capabilities: ${ node.capabilities.join(', ') }
						`,
						matchedFields: ['territoryName', 'nodeId', 'capabilities'],
						relevance: 0.8,
						lastSeen: node.lastSeen as string
					});
				}
			}
			
			return results
				.sort((a, b) => (b.relevance ?? 0) - (a.relevance ?? 0))
				.slice(0, params.limit);
			
		} catch (error) {
			Log.error(recordLogger, 'Search failed:', error);
			return [];
		}
	}

	/**
	 * ============================================================================
	 * NETWORK UTILITIES
	 * ============================================================================
	 */

	private async makeNetworkRequest(
		url: string,
		method: string,
		body?: unknown
	): Promise<NetworkRequestResponse> {
		try {
			const options: RequestInit = {
				method,
				headers: {
					'Content-Type': 'application/json',
					'X-Carnival-Source': 'external-api-service',
					'User-Agent': 'Carnival-Records-External-API/1.0'
				}
			};
			
			if (body) {
				options.body = JSON.stringify(body);
			}
			
			const response = await fetchWithRetry(
				url,
				{
					...options,
					timeoutMs: this.config.communicationTimeout ?? 5000,
					...(this.config.tlsConfig && { tlsConfig: this.config.tlsConfig })
				},
				this.config.maxRetries ?? 2,
				this.config.retryBaseDelayMs ?? 200
			);
			
			let responseData: unknown = null;
			try {
				responseData = await response.json();
			} catch {
				responseData = await response.text().catch(() => null);
			}
			
			return {
				ok: response.ok,
				status: response.status,
				data: responseData
			};
			
		} catch (error) {
			Log.error(recordLogger, `Network request failed to ${url}:`, error);
			return { ok: false, status: 500 };
		}
	}

	cleanup(): void {
		// Cleanup if needed
	}
}