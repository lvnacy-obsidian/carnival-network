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
	ExtendedActQueryOptions,
	LogContext,
	NetworkRequestResponse,
	PaginatedActResult,
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
 * 
 * IMPORTANT: This service now maintains an in-memory act store.
 * In production, this would be backed by a persistent database or file system.
 */
export class ActService implements ActServiceInterface {
	// In-memory act storage (TODO: Replace with persistent storage)
	private actStore: Map<string, CarnivalRecord> = new Map();
	private actsByTerritory: Map<string, Set<string>> = new Map();
	private actsByType: Map<string, Set<string>> = new Map();
	private actsByPerformer: Map<string, Set<string>> = new Map();

	constructor(
		private readonly territoryAccess: TerritoryAccessService,
		private readonly config: CarnivalConfig
	) {
		// Initialize with some mock data for testing
		this.seedMockData();
	}

	/**
	 * ============================================================================
	 * ACT CREATION & BROADCAST
	 * ============================================================================
	 */

	/**
	 * Create a new act
	 */
	createAct(params: CreateActParams): CarnivalRecord {
		const record: CarnivalRecord = {
			id: params.id ?? this.generateActId(),
			title: params.title,
			territory: params.territory,
			actType: params.actType,
			content: params.content ?? '',
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

		// Store the act
		this.storeAct(record);

		Log.log(actLogger, `🎭 Created act: ${record.title} (${record.id})`);

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

			// Store locally first
			this.storeAct(record);
			
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
							`Act broadcast successful to ${performer.territoryName} (${performer.performerId})`
						);
					} else {
						Log.warn(actLogger, 
							`Act broadcast failed to ${performer.territoryName}: ${response.status}`
						);
					}
				} catch (error) {
					Log.error(actLogger, `Broadcast error to ${performer.territoryName}:`, error);
				}
			});
			
			await Promise.allSettled(broadcastPromises);
			Log.log(actLogger, `Act ${record.id} broadcast to ${targetPerformers.length} performers`);
			
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
	 * Count acts matching parameters
	 */
	countActs(params: ActCountOptions): number {
		try {
			let acts = Array.from(this.actStore.values());

			if (params.territory) {
				acts = acts.filter(act => act.territory === params.territory);
			}

			if (params.type) {
				acts = acts.filter(act => act.actType === params.type);
			}

			if (params.status) {
				acts = acts.filter(act => act.status === params.status);
			}

			return acts.length;
		} catch (error) {
			Log.error(actLogger, 'Failed to count acts:', error);
			return 0;
		}
	}

	/**
	 * Get a specific act by ID
	 */
	getAct(actId: string): CarnivalRecord | null {
		return this.actStore.get(actId) ?? null;
	}

	/**
	 * List acts with optional filtering
	 */
	listActs(filter?: {
		territory?: string;
		type?: string;
		status?: 'active' | 'archived' | 'cancelled';
		limit?: number;
	}): CarnivalRecord[] {
		const options: ActQueryOptions = {
			territory: filter?.territory,
			type: filter?.type,
			limit: filter?.limit ?? 100,
			offset: 0
		};

		return this.queryActs(options);
	}

	/**
	 * Perform search across acts
	 */
	performSearch(params: SearchOptions): SearchResult[] {
		try {
			const results: SearchResult[] = [];
			const query = params.query.toLowerCase();
			
			let acts = Array.from(this.actStore.values());

			// Filter by territories if specified
			if (params.territories && params.territories.length > 0) {
				acts = acts.filter(act => params.territories.includes(act.territory));
			}

			// Filter by types if specified in filters
			if (params.filters?.actTypes && params.filters.actTypes.length > 0) {
				acts = acts.filter(act => params.filters?.actTypes?.includes(act.actType));
			}

			// Search in title and content
			for (const act of acts) {
				const searchableText = `
					${act.title}
					${act.content}
					${act.territory}
					${act.actType}
				`.toLowerCase();

				if (searchableText.includes(query)) {
					const matchedFields: string[] = [];
					if (act.title.toLowerCase().includes(query)) {
						matchedFields.push('title');
					}
					if (act.content.toLowerCase().includes(query)) {
						matchedFields.push('content');
					}
					if (act.territory.toLowerCase().includes(query)) {
						matchedFields.push('territory');
					}

					// Calculate relevance (simple scoring)
					let relevance = 0;
					if (act.title.toLowerCase().includes(query)) {
						relevance += 0.5;
					}
					if (act.content.toLowerCase().includes(query)) {
						relevance += 0.3;
					}
					relevance += matchedFields.length * 0.1;

					results.push({
						id: act.id,
						title: act.title,
						type: act.actType,
						territory: act.territory,
						content: this.generateSummary(act),
						matchedFields,
						relevance,
						lastSeen: act.updatedAt ?? act.createdAt,
						metadata: act.metadata
					});
				}
			}

			// Sort by relevance
			results.sort((a, b) => (b.relevance ?? 0) - (a.relevance ?? 0));
			
			return results.slice(0, params.limit);
			
		} catch (error) {
			Log.error(actLogger, 'Search failed:', error);
			return [];
		}
	}

	/**
	 * Query acts based on parameters
	 */
	queryActs(options: ExtendedActQueryOptions): CarnivalRecord[] {
		try {
			let acts = Array.from(this.actStore.values());

			// Apply filters
			if (options.territory) {
				acts = acts.filter(act => act.territory === options.territory);
			}

			if (options.type) {
				acts = acts.filter(act => act.actType === options.type);
			}
			
			if (options.performerId) {
				acts = acts.filter(act => 
					act.metadata.performerId === options.performerId
				);
			}

			if (options.status) {
				acts = acts.filter(act => act.status === options.status);
			}

			if (options.dateRange) {
				const start = new Date(options.dateRange.start).getTime();
				const end = new Date(options.dateRange.end).getTime();
				acts = acts.filter(act => {
					const created = new Date(act.createdAt).getTime();
					return created >= start && created <= end;
				});
			}

			// Apply sorting
			if (options.sortBy) {
				acts = this.sortActs(acts, options.sortBy, options.sortOrder ?? 'desc');
			} else {
				// Default: sort by creation date (newest first)
				acts.sort((a, b) => 
					new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
				);
			}

			// Apply pagination
			const offset = options.offset ?? 0;
			const limit = options.limit ?? 10;
			
			return acts.slice(offset, offset + limit);
			
		} catch (error) {
			Log.error(actLogger, 'Failed to query acts:', error);
			return [];
		}
	}

	/**
	 * Query acts with pagination support
	 */
	queryActsPaginated(options: ExtendedActQueryOptions): PaginatedActResult {
		const page = options.page ?? 1;
		const pageSize = options.pageSize ?? 10;

		// Update offset/limit for pagination
		const paginatedOptions = {
			...options,
			offset: (page - 1) * pageSize,
			limit: pageSize
		};

		const acts = this.queryActs(paginatedOptions);
		const totalItems = this.countActs({
			territory: options.territory,
			type: options.type,
			status: options.status
		});

		const totalPages = Math.ceil(totalItems / pageSize);

		return {
			acts,
			pagination: {
				currentPage: page,
				pageSize,
				totalItems,
				totalPages,
				hasNext: page < totalPages,
				hasPrevious: page > 1
			}
		};
	}

	/**
	 * ============================================================================
	 * PRIVATE HELPER METHODS
	 * ============================================================================
	 */

	/**
	 * Store an act in memory with indexing
	 */
	private storeAct(act: CarnivalRecord): void {
		// Store in main map
		this.actStore.set(act.id, act);

		// Index by territory
		if (!this.actsByTerritory.has(act.territory)) {
			this.actsByTerritory.set(act.territory, new Set());
		}
		this.actsByTerritory.get(act.territory)?.add(act.id);

		// Index by type
		if (!this.actsByType.has(act.actType)) {
			this.actsByType.set(act.actType, new Set());
		}
		this.actsByType.get(act.actType)?.add(act.id);

		// Index by performer if available
		if (act.metadata.performerId) {
			const performerId = act.metadata.performerId as string;
			if (!this.actsByPerformer.has(performerId)) {
				this.actsByPerformer.set(performerId, new Set());
			}
			this.actsByPerformer.get(performerId)?.add(act.id);
		}
	}

	/**
	 * Sort acts by specified field and order
	 */
	private sortActs(
		acts: CarnivalRecord[], 
		sortBy: 'createdAt' | 'updatedAt' | 'title' | 'territory',
		order: 'asc' | 'desc' = 'desc'
	): CarnivalRecord[] {
		return acts.sort((a, b) => {
			let comparison = 0;

			switch (sortBy) {
				case 'createdAt':
					comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
					break;
				case 'updatedAt':
					const aTime = a.updatedAt ? new Date(a.updatedAt).getTime() : new Date(a.createdAt).getTime();
					const bTime = b.updatedAt ? new Date(b.updatedAt).getTime() : new Date(b.createdAt).getTime();
					comparison = aTime - bTime;
					break;
				case 'title':
					comparison = a.title.localeCompare(b.title);
					break;
				case 'territory':
					comparison = a.territory.localeCompare(b.territory);
					break;
			}

			return order === 'asc' ? comparison : -comparison;
		});
	}

	/**
	 * Seed mock data for testing
	 */
	private seedMockData(): void {
		// Create a few mock acts for testing
		const mockActs: CarnivalRecord[] = [
			{
				id: 'act-mock-1',
				title: 'Initial Territory Setup',
				territory: 'backstage',
				actType: 'changelog',
				content: 'Set up initial territory configuration and performer registration',
				metadata: {
					performerId: 'performer-1',
					createdBy: 'system'
				},
				createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
				status: 'active',
				syncPreferences: {
					requireAck: true,
					broadcastToAll: false,
					targetTerritories: ['backstage']
				}
			},
			{
				id: 'act-mock-2',
				title: 'Network Discovery Completed',
				territory: 'backstage',
				actType: 'conversation',
				content: 'Successfully discovered 5 performers across 3 territories',
				metadata: {
					performerId: 'performer-1',
					createdBy: 'network-service'
				},
				createdAt: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
				status: 'active',
				syncPreferences: {
					requireAck: false,
					broadcastToAll: true,
					targetTerritories: []
				}
			}
		];

		mockActs.forEach(act => this.storeAct(act));
		Log.log(actLogger, `🎭 Seeded ${mockActs.length} mock acts for testing`);
	}

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
					'User-Agent': 'Carnival-Network-Act-Service/1.0'
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
		// Could save acts to persistent storage here
		Log.log(actLogger, '🎭 Act service cleanup complete');
	}
}