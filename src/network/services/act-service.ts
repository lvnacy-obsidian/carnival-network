// services/record-service.ts
import { Log } from '../../utils/logger';
import { fetchWithRetry } from '../http-client';
import { TerritoryAccessService } from './territory-access-service';
import {
	NotFoundError,
	ServiceUnavailableError
} from '../../errors';
import type {
	ActCountOptions,
	ActQueryOptions,
	ActServiceInterface,
	CarnivalConfig,
	CarnivalRecord,
	CreateActParams,
	LogContext,
	NetworkRequestResponse,
	RegistryEntry,
	SearchOptions,
	SearchResult
} from '../../types/public';

const actLogger: LogContext = {
	context: 'Act Service',
	path: '/.obsidian/plugins/carnival-network/services/act-service'
};

/**
 * 🎭 Handles act (record) operations - querying, creating, broadcasting
 */
export class ActService implements ActServiceInterface {
	constructor(
		private readonly territoryAccess: TerritoryAccessService,
		private readonly config: CarnivalConfig
	) {}

	/**
	 * ============================================================================
	 * RECORD CREATION & BROADCAST
	 * ============================================================================
	 */

	/**
	 * Create a new act
	 */
	createAct(params: CreateActParams): CarnivalRecord {
		const record: CarnivalRecord = {
			id: this.generateActId(),
			title: params.title,
			territory: params.territory,
			actType: params.actType,
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
	generateActId(): string {
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

	private createChangelogAct(performer: RegistryEntry): CarnivalRecord {
		return {
			id: `changelog-${ performer.performerId }-${ Date.now() }`,
			title: `Recent Changes in ${ performer.territoryName }`,
			territory: performer.territoryName,
			actType: 'changelog',
			content: `Development activity in ${ performer.territoryName } territory. Performer ${ performer.performerId } reporting operational status.`,
			metadata: {
				performerId: performer.performerId,
				lastSeen: performer.lastSeen,
				capabilities: performer.capabilities
			},
			createdAt: performer.lastSeen ?? new Date().toISOString(),
			status: 'active',
			syncPreferences: {
				requireAck: true,
				broadcastToAll: false,
				targetTerritories: [performer.territoryName]
			}
		};
	}

	private createConversationAct(performer: RegistryEntry): CarnivalRecord {
		return {
			id: `conversation-${ performer.performerId }-${ Date.now() }`,
			title: `Network Communication - ${ performer.territoryName }`,
			territory: performer.territoryName,
			actType: 'conversation',
			content: `Inter-performer communication logged for territory ${ performer.territoryName }. Active protocols: ${ performer.capabilities.join(', ') }.`,
			metadata: {
				performerId: performer.performerId,
				protocols: performer.capabilities,
				connectionType: 'http-registry'
			},
			createdAt: performer.discoveredAt ?? new Date().toISOString(),
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
	async broadcastAct(record: CarnivalRecord): Promise<void> {
		try {
			if (!this.territoryAccess.isAvailable()) {
				throw new ServiceUnavailableError(
					'Registry Service',
					'Performer registry is not initialized'
				);
			}
			
			const allPerformers = this.territoryAccess.getAllPerformers();
			let targetPerformers = allPerformers;

			if (!record.syncPreferences.targetTerritories) {
				throw new NotFoundError(
					'Target Territories',
					'No target territories specified for record broadcast'
				);
			}
			
			if (!record.syncPreferences.broadcastToAll && 
				record.syncPreferences.targetTerritories) {
				targetPerformers = allPerformers.filter((performer) => 
					record.syncPreferences.targetTerritories?.includes(performer.territoryName)
				);
			}
			
			const broadcastPromises = targetPerformers.map(async (performer) => {
				try {
					const payload = {
						record,
						source: {
							performerId: 'local-api-service',
							territory: 'external-api'
						},
						timestamp: new Date().toISOString(),
						requireAck: record.syncPreferences.requireAck
					};
					
					const endpoint = `${performer.endpoint}/carnival/network/broadcast`;
					const response = await this.makeNetworkRequest(endpoint, 'POST', payload);
					
					if (response.ok) {
						Log.log(actLogger, 
							`Record broadcast successful to ${performer.territoryName} (${performer.performerId})`
						);
					} else {
						Log.warn(actLogger, 
							`Record broadcast failed to ${performer.territoryName}: ${response.status}`
						);
					}
				} catch (error) {
					Log.error(actLogger, `Broadcast error to ${performer.territoryName}:`, error);
				}
			});
			
			await Promise.allSettled(broadcastPromises);
			Log.log(actLogger, `Record ${record.id} broadcast to ${targetPerformers.length} performers`);
			
		} catch (error) {
			Log.error(actLogger, 'Failed to broadcast record:', error);
			throw error;
		}
	}

	/**
	 * ============================================================================
	 * QUERY ACTS & SEARCH
	 * ============================================================================
	 */

	/**
	 * Query records based on parameters
	 */
	queryActs(params: ActQueryOptions): CarnivalRecord[] {
		try {
			const allPerformers = this.territoryAccess.getAllPerformers();
			
			const filteredPerformers = params.territory 
				? allPerformers.filter(performer => performer.territoryName === params.territory)
				: allPerformers;
			
			const records: CarnivalRecord[] = [];
			
			for (const performer of filteredPerformers) {
				if (performer.capabilities.includes('changelog_sync') && 
					(!params.type || params.type === 'changelog')) {
					records.push(this.createChangelogAct(performer));
				}
				
				if (performer.capabilities.includes('conversation_sync') && 
					(!params.type || params.type === 'conversation')) {
					records.push(this.createConversationAct(performer));
				}
			}
			
			const startIndex = params.offset;
			const endIndex = startIndex + params.limit;
			return records.slice(startIndex, endIndex);
			
		} catch (error) {
			Log.error(actLogger, 'Failed to query records:', error);
			return [];
		}
	}

	/**
	 * Count records matching parameters
	 */
	countActs(params: ActCountOptions): number {
		try {
			const allPerformers = this.territoryAccess.getAllPerformers();
			
			const filteredPerformers = params.territory 
				? allPerformers.filter(performer => performer.territoryName === params.territory)
				: allPerformers;
			
			let count = 0;
			for (const performer of filteredPerformers) {
				if (!params.type || params.type === 'changelog') {
					if (performer.capabilities.includes('changelog_sync')) {
						count++;
					}
				}
				if (!params.type || params.type === 'conversation') {
					if (performer.capabilities.includes('conversation_sync')) {
						count++;
					}
				}
			}
			
			return count;
		} catch (error) {
			Log.error(actLogger, 'Failed to count records:', error);
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
			
			const allPerformers = this.territoryAccess.getAllPerformers();
			
			for (const performer of allPerformers) {
				if (params.territories.length > 0 && 
					!params.territories.includes(performer.territoryName)) {
					continue;
				}
				
				const searchableText = `
					${ performer.territoryName } 
					${ performer.performerId } 
					${ performer.endpoint } 
					${ performer.capabilities.join(' ') }
				`.toLowerCase();
				
				if (searchableText.includes(query)) {
					results.push({
						id: `search-result-${ performer.performerId }`,
						title: `${ performer.territoryName } Territory Performer`,
						type: 'network_performer',
						territory: performer.territoryName,
						content: `
							Performer ID: ${ performer.performerId }
							Endpoint: ${ performer.endpoint }
							Capabilities: ${ performer.capabilities.join(', ') }
						`,
						matchedFields: ['territoryName', 'performerId', 'capabilities'],
						relevance: 0.8,
						lastSeen: performer.lastSeen as string
					});
				}
			}
			
			return results
				.sort((a, b) => (b.relevance ?? 0) - (a.relevance ?? 0))
				.slice(0, params.limit);
			
		} catch (error) {
			Log.error(actLogger, 'Search failed:', error);
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
			Log.error(actLogger, `Network request failed to ${url}:`, error);
			return { ok: false, status: 500 };
		}
	}

	cleanup(): void {
		// Cleanup if needed
	}
}