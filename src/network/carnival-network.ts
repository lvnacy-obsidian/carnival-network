/* eslint-disable @typescript-eslint/no-explicit-any */
import { App, Notice } from 'obsidian';
import { HttpNetworkProtocol } from './http-network-protocol.js';
import { HttpRegistryService } from './http-registry-service.js';
import { ExternalApiService } from './external-api-service.js';
import { Log } from '../utils/logger.js';
import type {
	NetworkNode,
	NetworkStatus,
	CrossVaultRecord,
	NetworkConfiguration
} from '../types/network/network-types.js';
import type {
	APIKeyStorage,
	CarnivalNetworkSettings
} from '../types';

const carnivalNetworkLogger = {
	context: 'Carnival Network Class',
	path: '/.obsidian/plugins/carnvial-records/network/carnival-network.ts'
};

/**
 * 🎪 Carnival Network - The modern HTTP-based distributed nervous system
 * 
 * This magnificent contraption weaves together all carnival territories into a single
 * operational intelligence network using HTTP/s communication, enabling unprecedented
 * coordination, cross-territorial communication, and external integrations.
 */
export class CarnivalNetwork {
	private app: App;
	private config: NetworkConfiguration;
	private storage: APIKeyStorage;
	private settings: CarnivalNetworkSettings;
	
	// Core HTTP-based services
	private httpProtocol: HttpNetworkProtocol;
	private registryService: HttpRegistryService;
	private externalApiService: ExternalApiService;
	
	// Network state
	private currentNode: NetworkNode | null = null;
	private networkStatus: NetworkStatus = 'disconnected';
	isInitialized: boolean = false;

	constructor(app: App, config: NetworkConfiguration, storage: APIKeyStorage, settings: CarnivalNetworkSettings) {
		this.app = app;
		this.config = config;
		this.storage = storage;
		this.settings = settings;
		
		// Initialize HTTP-based services
		this.httpProtocol = new HttpNetworkProtocol(app, config);
		this.registryService = new HttpRegistryService(app, config, storage);
		this.externalApiService = new ExternalApiService(app, config, settings);
		
		Log.info(carnivalNetworkLogger, '🎪 Carnival Network: Initializing modern HTTP-based network...');
	}

	/**
	 * Broadcast a record across the carnival network via HTTP
	 */
	async broadcastRecord(record: CrossVaultRecord): Promise<Map<string, any>> {
		if (this.networkStatus !== 'connected') {
			Log.warn(carnivalNetworkLogger, '🎪 Carnival Network: Cannot broadcast - network not connected');
			return new Map();
		}

		try {
			// Get target nodes for broadcasting
			const allNodes = this.registryService.getRegisteredNodes();
			const targetNodes = record.syncPreferences.targetTerritories?.length 
				? allNodes.filter(node => record.syncPreferences.targetTerritories?.includes(node.territory))
				: allNodes;

			if (targetNodes.length === 0) {
				Log.warn(carnivalNetworkLogger, '🎪 Carnival Network: No target nodes found for broadcasting');
				return new Map();
			}

			// Broadcast via HTTP protocol
			const results = await this.httpProtocol.broadcastRecord(record, targetNodes);
			
			// Log results
			for (const [nodeId, result] of results) {
				const node = targetNodes.find(n => n.id === nodeId);
				const nodeName = node?.name ?? nodeId;
				
				if (result.success) {
					Log.log(carnivalNetworkLogger, `🎪 Carnival Network: Record broadcast to ${nodeName} successful`);
				} else {
					Log.warn(
						carnivalNetworkLogger,
						`🎪 Carnival Network: Record broadcast to ${nodeName} failed: ${result.error}`
					);
				}
			}
			
			return results;
		} catch (error) {
			Log.error(carnivalNetworkLogger, '🎪 Carnival Network: Broadcast error:', error);
			return new Map();
		}
	}

	/**
	 * Disconnect from the HTTP-based network
	 */
	async disconnectNetwork(): Promise<void> {
		try {
			if (!this.isInitialized) {
				Log.log(carnivalNetworkLogger, '🎪 Carnival Network: Already disconnected');
				return;
			}

			Log.log(carnivalNetworkLogger, '🎪 Carnival Network: Disconnecting from HTTP network...');

			// Cleanup external API service
			await this.externalApiService.cleanup();

			// Cleanup HTTP protocol connections
			await this.httpProtocol.cleanup();

			// Unregister from registry
			await this.registryService.cleanup();


			// Update state
			this.networkStatus = 'disconnected';
			this.isInitialized = false;
			this.currentNode = null;

			Log.log(carnivalNetworkLogger, '🎪 Carnival Network: Disconnected from HTTP network');
			new Notice('🎪 Carnival Network: Disconnected', 3000);
		} catch (error) {
			Log.error(carnivalNetworkLogger, '🎪 Carnival Network: Error during disconnect:', error);
		}
	}

	/**
	 * Get external API service for integrations
	 */
	getExternalApiService(): ExternalApiService {
		return this.externalApiService;
	}

	/**
	 * Get HTTP protocol service for direct communication
	 */
	getHttpProtocol(): HttpNetworkProtocol {
		return this.httpProtocol;
	}

	/**
	 * Get current network metrics for monitoring
	 */
	async getNetworkMetrics(): Promise<{
		uptime: number;
		connectedNodes: number;
		totalMessages: number;
		latencyAverage: number;
		errorRate: number;
	}> {
		try {
			const topology = await this.registryService.getNetworkTopology();
			
			return {
				uptime: this.isInitialized ? Date.now() - this.initializationTime : 0,
				connectedNodes: topology.totalNodes,
				totalMessages: 0, // TODO: Implement message counting
				latencyAverage: 0, // TODO: Implement latency tracking
				errorRate: 0 // TODO: Implement error rate calculation
			};
		} catch (error) {
			Log.error(carnivalNetworkLogger, '🎪 Carnival Network: Error getting metrics:', error);
			return {
				uptime: 0,
				connectedNodes: 0,
				totalMessages: 0,
				latencyAverage: 0,
				errorRate: 1
			};
		}
	}

	/**
	 * Get comprehensive network status and topology
	 */
	async getNetworkStatus(): Promise<{
		status: NetworkStatus;
		currentNode: NetworkNode | null;
		registeredNodes: NetworkNode[];
		totalConnections: number;
		networkTopology: any;
		externalApiStatus: boolean;
	}> {
		try {
			const registeredNodes = this.registryService.getRegisteredNodes();
			const networkTopology = await this.registryService.getNetworkTopology();
			
			return {
				status: this.networkStatus,
				currentNode: this.currentNode,
				registeredNodes,
				totalConnections: registeredNodes.length,
				networkTopology,
				externalApiStatus: true // TODO: Implement actual check
			};
		} catch (error) {
			Log.error(carnivalNetworkLogger, '🎪 Carnival Network: Error getting network status:', error);
			return {
				status: 'error',
				currentNode: null,
				registeredNodes: [],
				totalConnections: 0,
				networkTopology: {},
				externalApiStatus: false
			};
		}
	}

	/**
	 * Get registry service for node management
	 */
	getRegistryService(): HttpRegistryService {
		return this.registryService;
	}

	private initializationTime: number = Date.now();
	
	/**
	 * Initialize the modern HTTP-based carnival network
	 */
	async initializeNetwork(): Promise<boolean> {
		try {
			if (this.isInitialized) {
				Log.warn(carnivalNetworkLogger, '🎪 Carnival Network: Already initialized');
				return true;
			}
			
			Log.info(carnivalNetworkLogger, '🎪 Carnival Network: Initializing HTTP-based network...');
			
			// Register this vault with the HTTP registry
			await this.registryService.registerNode();
			
			// Discover other carnival territories via HTTP
			const discoveredNodes = await this.registryService.discoverNetworkNodes();
			Log.info(carnivalNetworkLogger, `🎪 Carnival Network: Discovered ${discoveredNodes.length} carnival territories`);

			// Establish HTTP connections to discovered territories
			const connectionPromises = discoveredNodes.map(async (node) => {
				try {
					return await this.httpProtocol.establishConnection(node);
				} catch (error) {
					Log.warn(carnivalNetworkLogger, `🎪 Failed to connect to ${node.name}:`, error);
					return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
				}
			});
			
			const connectionResults = await Promise.allSettled(connectionPromises);
			const successfulConnections = connectionResults.filter(result => 
				result.status === 'fulfilled' && result.value.success
			).length;

			this.networkStatus = successfulConnections > 0 ? 'connected' : 'isolated';
			this.isInitialized = true;
			
			new Notice(`🎪 Carnival Network: Connected to ${successfulConnections} territories via HTTP`, 5000);
			
			return true;
		} catch (error) {
			Log.error(carnivalNetworkLogger, '🎪 Carnival Network Error:', error);
			this.networkStatus = 'error';
			return false;
		}
	}

	/**
	 * Check if network is ready for operations
	 */
	isNetworkReady(): boolean {
		return this.isInitialized && this.networkStatus === 'connected';
	}

	/**
	 * Query the carnival network for intelligence via HTTP
	 */
	async queryNetwork(query: {
		type: 'status' | 'records' | 'projects' | 'activity';
		filters?: Record<string, any>;
		targetNodes?: string[];
	}): Promise<Map<string, any>> {
		const results = new Map<string, any>();

		try {
			const allNodes = this.registryService.getRegisteredNodes();
			const targetNodes = query.targetNodes 
				? allNodes.filter(node => query.targetNodes?.includes(node.id))
				: allNodes;

			const queryPromises = targetNodes.map(async (node) => {
				try {
					const response = await this.httpProtocol.queryNode(node, query.type, query);
					results.set(node.id, response.success ? response.data : { error: response.error });
				} catch (error) {
					Log.error(carnivalNetworkLogger, `🎪 Carnival Network: Query error to ${node.name}:`, error);
					results.set(node.id, { error: error instanceof Error ? error.message : 'Unknown error' });
				}
			});

			await Promise.allSettled(queryPromises);
			return results;
		} catch (error) {
			Log.error(carnivalNetworkLogger, '🎪 Carnival Network: Query operation failed:', error);
			return results;
		}
	}

	/**
	 * Refresh network topology and reconnect if needed
	 */
	async refreshNetwork(): Promise<boolean> {
		try {
			Log.log(carnivalNetworkLogger, '🎪 Carnival Network: Refreshing network topology...');
			
			// Rediscover nodes
			const discoveredNodes = await this.registryService.discoverNetworkNodes();
			
			// Test connections
			const connectionPromises = discoveredNodes.map(async (node) => {
				try {
					return await this.httpProtocol.establishConnection(node);
				} catch (error) {
					return {
						success: false,
						error: error instanceof Error ? error.message : 'Unknown error'
					};
				}
			});
			
			const results = await Promise.allSettled(connectionPromises);
			const successful = results.filter(result => 
				result.status === 'fulfilled' && result.value.success
			).length;
			
			this.networkStatus = successful > 0 ? 'connected' : 'isolated';
			Log.log(
				carnivalNetworkLogger,
				`🎪 Carnival Network: Refresh complete - ${successful}/${discoveredNodes.length} territories available`
			);
			
			return successful > 0;
		} catch (error) {
			Log.error(carnivalNetworkLogger, '🎪 Carnival Network: Refresh failed:', error);
			this.networkStatus = 'error';
			return false;
		}
	}

}