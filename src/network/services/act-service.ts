import { Log } from '../../utils/logger';
import { fetchWithRetry } from '../http-client';
import { TerritoryAccessService } from './territory-access-service';
import { InMemoryArchive } from '../../archive/in-memory-archive';
import {
	NotFoundError,
	ServiceUnavailableError
} from '../../errors';
import type {
	ActCountOptions,
	ActQueryOptions,
	ActServiceInterface,
	ArchiveInterface,
	CarnivalConfig,
	CarnivalAct,
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
 * 🎭 Handles act operations - querying, creating, broadcasting
 * 
 * IMPORTANT: This service now maintains an in-memory act store.
 * In production, this would be backed by a persistent database or file system.
 */
export class ActService implements ActServiceInterface {
	// Archive Interface
	private archive: ArchiveInterface;

	constructor(
		private readonly territoryAccess: TerritoryAccessService,
		private readonly config: CarnivalConfig,
		archive?: ArchiveInterface
	) {

		// Default to InMemoryArchive if not provided
		this.archive = archive ?? new InMemoryArchive();

		Log.log(actLogger, `🎭 ActService initialized with ${this.archive.name}`);
		
		// Seed mock data only for InMemoryArchive
		if (this.archive.name === 'InMemoryArchive') {
			this.seedMockData();
		}
	}

	/**
	 * ============================================================================
	 * ACT CREATION & BROADCAST
	 * ============================================================================
	 */

	/**
	 * Create a new act
	 */
	async createAct(params: CreateActParams): Promise<CarnivalAct> {
		const act: CarnivalAct = {
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

		// Store via archive
		await this.archive.create(act);

		Log.log(actLogger, `🎭 Created act: ${act.title} (${act.id})`);

		return act;
	}

	/**
	 * Generate unique act ID
	 */
	generateActId(): string {
		return `act-${ Date.now().toString(36) }-${ Math.random().toString(36).substring(2) }`;
	}

	/**
	 * Generate summary for a act
	 */
	generateSummary(act: CarnivalAct): string {
		if (!act.content || act.content.length <= 200) {
			return act.content ?? 'No content available';
		}
		
		const sentences = act.content.split(/[.!?]+/).filter(s => s.trim());
		if (sentences.length > 0) {
			const firstSentence = sentences[0].trim();
			if (firstSentence.length <= 200) {
				return `${ firstSentence }.`;
			}
		}
		
		return `${ act.content.substring(0, 197) }...`;
	}

	/**
	 * Broadcast act to network
	 */
	async broadcastAct(act: CarnivalAct): Promise<void> {
		try {
			if (!this.territoryAccess.isAvailable()) {
				throw new ServiceUnavailableError(
					'Registry Service',
					'Performer registry is not initialized'
				);
			}

			// Store locally first via archive
			const exists = await this.archive.exists(act.id);
			if (exists) {
				await this.archive.update(act.id, act);
			} else {
				await this.archive.create(act);
			}
			
			const allPerformers = this.territoryAccess.getAllPerformers();
			let targetPerformers = allPerformers;

			if (!act.syncPreferences.targetTerritories) {
				throw new NotFoundError(
					'Target Territories',
					'No target territories specified for act broadcast'
				);
			}
			
			if (!act.syncPreferences.broadcastToAll && 
				act.syncPreferences.targetTerritories) {
				targetPerformers = allPerformers.filter((performer) => 
					act.syncPreferences.targetTerritories?.includes(performer.territoryName)
				);
			}
			
			const broadcastPromises = targetPerformers.map(async (performer) => {
				try {
					const payload = {
						act,
						source: {
							performerId: 'local-api-service',
							territory: 'external-api'
						},
						timestamp: new Date().toISOString(),
						requireAck: act.syncPreferences.requireAck
					};
					
					const endpoint = `${ performer.endpoint }/carnival/network/broadcast`;
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
			Log.log(actLogger, `Act ${ act.id } broadcast to ${ targetPerformers.length } performers`);
			
		} catch (error) {
			Log.error(actLogger, 'Failed to broadcast act:', error);
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
	async countActs(params: ActCountOptions): Promise<number> {
		try {
			return await this.archive.count({
				territory: params.territory,
				actType: params.type,
				status: params.status
			});
		} catch (error) {
			Log.error(actLogger, 'Failed to count acts:', error);
			return 0;
		}
	}

	/**
	 * Get a specific act by ID
	 */
	async getAct(actId: string): Promise<CarnivalAct | null> {
		try {
			return await this.archive.findById(actId);
		} catch (error) {
			Log.error(actLogger, `Failed to get act ${actId}:`, error);
			return null;
		}
	}

	/**
	 * List acts with optional filtering
	 */
	async listActs(filter?: {
		territory?: string;
		type?: string;
		status?: 'active' | 'archived' | 'cancelled';
		limit?: number;
	}): Promise<CarnivalAct[]> {
		const options: ActQueryOptions = {
			territory: filter?.territory,
			type: filter?.type,
			limit: filter?.limit ?? 100,
			offset: 0
		};

		return await this.queryActs(options);
	}

	/**
	 * Perform search across acts
	 */
	async performSearch(params: SearchOptions): Promise<SearchResult[]> {
		try {
			const results: SearchResult[] = [];
			const query = params.query.toLowerCase();
			
			// Get all acts matching territories/types
			const acts = await this.archive.find({
				territory: params.territories?.[0], // Archive filters one territory at a time
				actType: params.filters?.actTypes?.[0],
				limit: undefined // Get all for search
			});

			// Filter by territories if specified
			// Further filter by territories if multiple specified
			const filteredActs = acts.filter(act => {
				if (params.territories && params.territories.length > 0) {
					if (!params.territories.includes(act.territory)) {
						return false;
					}
				}

				if (params.filters?.actTypes && params.filters.actTypes.length > 0) {
					if (!params.filters.actTypes.includes(act.actType)) {
						return false;
					}
				}
				
				return true;
			});

			// Search in title and content
			for (const act of filteredActs) {
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
	async queryActs(options: ExtendedActQueryOptions): Promise<CarnivalAct[]> {
		try {
			return await this.archive.find({
				territory: options.territory,
				actType: options.type,
				performerId: options.performerId,
				status: options.status,
				dateRange: options.dateRange,
				sortBy: options.sortBy,
				sortOrder: options.sortOrder,
				limit: options.limit ?? 10,
				offset: options.offset ?? 0
			});
		} catch (error) {
			Log.error(actLogger, 'Failed to query acts:', error);
			return [];
		}
	}

	/**
	 * Query acts with pagination support
	 */
	async queryActsPaginated(options: ExtendedActQueryOptions): Promise<PaginatedActResult> {
		const page = options.page ?? 1;
		const pageSize = options.pageSize ?? 10;

		// Update offset/limit for pagination
		const paginatedOptions = {
			...options,
			offset: (page - 1) * pageSize,
			limit: pageSize
		};

		const acts = await this.queryActs(paginatedOptions);
		const totalItems = await this.countActs({
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
	 * Seed mock data for testing
	 */
	private async seedMockData(): Promise<void> {
		try {
			// Check if already seeded
			const existing = await this.archive.count({});
			if (existing > 0) {
				Log.log(actLogger, `🎭 Archive already contains ${existing} acts, skipping seed`);
				return;
			}

			// Create a few mock acts for testing
			const mockActs: CarnivalAct[] = [
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

			// Bulk create via archive
			const result = await this.archive.bulkCreate(mockActs);
			Log.log(actLogger, `🎭 Seeded ${result.successful.length} mock acts for testing`);
		} catch (error) {
			Log.error(actLogger, 'Failed to seed mock data:', error);
		}
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

	async cleanup(): Promise<void> {
		await this.archive.cleanup();
		Log.log(actLogger, '🎭 Act service cleanup complete');
	}
}