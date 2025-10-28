/* eslint-disable @typescript-eslint/no-explicit-any */
import { App } from 'obsidian';
import { Log } from '../utils/logger.js';
import type { 
	NetworkNode, 
	NetworkMessage, 
	NetworkResponse, 
	NetworkConfiguration,
	CrossVaultRecord 
} from '../types/network/network-types.js';

const httpNetworkProtocolLogger = {
	context: 'HTTP Network Protocol Class',
	path: '/.obsidian/plugins/carnival-records/src/network/http-network-protocol'
};

/**
 * 🌐 HTTP Network Protocol - Advanced cross-vault communication via Local REST API
 * 
 * This sophisticated protocol leverages the Local REST API plugin to enable
 * true HTTP/s communication between carnival territories, supporting cross-platform
 * deployment and real-time messaging capabilities.
 */
export class HttpNetworkProtocol {
	private app: App;
	private config: NetworkConfiguration;
	private localApiPort: number = 27123; // Default Local REST API port
	private localApiKey: string = '';
	private messageQueue: Map<string, NetworkMessage[]> = new Map();
	private acknowledgedMessages: Set<string> = new Set();
	private activeConnections: Map<string, WebSocket> = new Map();

	constructor(app: App, config: NetworkConfiguration) {
		this.app = app;
		this.config = config;
		this.initializeLocalApi();
	}

	/**
	 * Initialize connection to Local REST API plugin
	 */
	private initializeLocalApi(): void {
		try {
			// Check if Local REST API plugin is installed and active
			const { plugins } = this.app as unknown as { plugins: { plugins: Record<string, any> } };
			const restApiPlugin = plugins.plugins['obsidian-local-rest-api'];
			
			if (!restApiPlugin?.enabled) {
				throw new Error('Local REST API plugin not found or not enabled');
			}

			// Get API configuration from plugin settings
			const apiSettings = restApiPlugin.settings;
			this.localApiPort = apiSettings.port ?? 27123;
			this.localApiKey = apiSettings.apiKey ?? '';

			Log.log(httpNetworkProtocolLogger, `🌐 HTTP Network Protocol: Initialized with port ${ this.localApiPort }`);
		} catch (error) {
			Log.error(
				httpNetworkProtocolLogger,
				'🌐 HTTP Network Protocol: Failed to initialize Local REST API connection:',
				error
			);
		}
	}

	/**
	 * Establish HTTP connection to a network node
	 */
	async establishConnection(targetNode: NetworkNode): Promise<NetworkResponse> {
		try {
			// Extract connection details from node metadata
			const nodeUrl = this.getNodeApiUrl(targetNode);
			
			// Test connection with ping endpoint
			const pingResponse = await this.makeApiRequest(nodeUrl, '/ping', 'GET');
			
			if (pingResponse.ok) {
				Log.log(httpNetworkProtocolLogger, `🌐 HTTP Network Protocol: Connection established with ${ targetNode.name }`);
				
				// Establish WebSocket connection for real-time messaging if supported
				this.establishWebSocketConnection(targetNode);
				
				return { 
					success: true, 
					data: { 
						nodeId: targetNode.id,
						endpoint: nodeUrl,
						capabilities: await this.getNodeCapabilities(nodeUrl)
					}
				};
			} else {
				return {
					success: false,
					error: `HTTP connection failed: ${ pingResponse.status } ${ pingResponse.statusText }`
				};
			}

		} catch (error) {
			return {
				success: false,
				error: error instanceof Error ? error.message : 'Unknown HTTP connection error'
			};
		}
	}

	/**
	 * Send message via HTTP to target node
	 */
	async sendMessage(targetNode: NetworkNode, message: NetworkMessage): Promise<NetworkResponse> {
		try {
			const nodeUrl = this.getNodeApiUrl(targetNode);
			const endpoint = '/carnival/network/message';
			
			const response = await this.makeApiRequest(nodeUrl, endpoint, 'POST', {
				message: message,
				source: await this.getCurrentNodeInfo()
			});

			if (response.ok) {
				const result = await response.json();
				
				// If acknowledgment required, wait for response
				if (message.requiresAck) {
					return await this.waitForHttpAcknowledgment(message.id, targetNode);
				} else {
					return { 
						success: true, 
						messageId: message.id,
						data: result 
					};
				}
			} else {
				return {
					success: false,
					error: `HTTP message send failed: ${response.status}`,
					messageId: message.id
				};
			}

		} catch (error) {
			Log.error(httpNetworkProtocolLogger, `🌐 HTTP Network Protocol: Failed to send message to ${ targetNode.name }:`, error);
			return {
				success: false,
				error: error instanceof Error ? error.message : 'HTTP message send failed',
				messageId: message.id
			};
		}
	}

	/**
	 * Broadcast record to multiple nodes via HTTP
	 */
	async broadcastRecord(record: CrossVaultRecord, targetNodes: NetworkNode[]): Promise<Map<string, NetworkResponse>> {
		const results = new Map<string, NetworkResponse>();
		
		const broadcastMessage: NetworkMessage = {
			id: this.generateMessageId(),
			type: 'record_broadcast',
			sourceNodeId: await this.getCurrentNodeId(),
			timestamp: new Date().toISOString(),
			payload: record,
			requiresAck: record.syncPreferences.requireAck,
			expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString()
		};

		// Send to all target nodes concurrently
		const broadcastPromises = targetNodes.map(async (node) => {
			const response = await this.sendMessage(node, {
				...broadcastMessage,
				targetNodeId: node.id
			});
			results.set(node.id, response);
		});

		await Promise.allSettled(broadcastPromises);
		return results;
	}

	/**
	 * Query node for information via HTTP
	 */
	async queryNode(targetNode: NetworkNode, queryType: string, queryData: any): Promise<NetworkResponse> {
		try {
			const nodeUrl = this.getNodeApiUrl(targetNode);
			const endpoint = `/carnival/network/query/${queryType}`;
			
			const response = await this.makeApiRequest(nodeUrl, endpoint, 'POST', queryData);
			
			if (response.ok) {
				const result = await response.json();
				return {
					success: true,
					data: result
				};
			} else {
				return {
					success: false,
					error: `Query failed: ${response.status}`
				};
			}

		} catch (error) {
			return {
				success: false,
				error: error instanceof Error ? error.message : 'Query failed'
			};
		}
	}

	/**
	 * Discover network nodes via HTTP registry service
	 */
	async discoverNetworkNodes(registryEndpoints: string[]): Promise<NetworkNode[]> {
		const discoveredNodes: NetworkNode[] = [];
		
		for (const registryUrl of registryEndpoints) {
			try {
				const response = await this.makeApiRequest(registryUrl, '/carnival/network/registry', 'GET');
				
				if (response.ok) {
					const registry = await response.json();
					discoveredNodes.push(...registry.nodes);
				}
			} catch (error) {
				Log.error(
					httpNetworkProtocolLogger,
					`🌐 HTTP Network Protocol: Failed to query registry ${ registryUrl }:`,
					error
				);
			}
		}
		
		return this.deduplicateNodes(discoveredNodes);
	}

	/**
	 * Establish WebSocket connection for real-time messaging
	 */
	private establishWebSocketConnection(targetNode: NetworkNode): void {
		try {
			const wsUrl = this.getNodeWebSocketUrl(targetNode);
			const ws = new WebSocket(wsUrl);
			
			ws.onopen = () => {
				Log.log(httpNetworkProtocolLogger, `🔗 WebSocket connection established with ${ targetNode.name }`);
				this.activeConnections.set(targetNode.id, ws);
			};
			
			ws.onmessage = (event) => {
				this.handleWebSocketMessage(targetNode, JSON.parse(event.data));
			};
			
			ws.onclose = () => {
				Log.log(httpNetworkProtocolLogger, `🔌 WebSocket connection closed with ${ targetNode.name }`);
				this.activeConnections.delete(targetNode.id);
			};
			
			ws.onerror = (error) => {
				Log.error(httpNetworkProtocolLogger, `🔥 WebSocket error with ${ targetNode.name }:`, error);
			};

		} catch (error) {
			Log.error(httpNetworkProtocolLogger, `🔗 Failed to establish WebSocket with ${ targetNode.name }:`, error);
		}
	}

	/**
	 * Handle incoming WebSocket messages
	 */
	private handleWebSocketMessage(sourceNode: NetworkNode, message: any): void {
		// Process real-time messages from other carnival territories
		Log.log(httpNetworkProtocolLogger, `📨 Received WebSocket message from ${ sourceNode.name }:`, message);
		
		// Handle different message types
		switch (message.type) {
			case 'heartbeat':
				this.handleHeartbeat(sourceNode, message);
				break;
			case 'record_broadcast':
				this.handleRecordBroadcast(sourceNode, message);
				break;
			case 'network_query':
				this.handleNetworkQuery(sourceNode, message);
				break;
			default:
				Log.warn(httpNetworkProtocolLogger, `Unknown WebSocket message type: ${ message.type }`);
		}
	}

	/**
	 * Make authenticated API request to Local REST API
	 */
	private makeApiRequest(
		baseUrl: string, 
		endpoint: string, 
		method: string, 
		data?: any
	): Promise<Response> {
		const url = `${baseUrl}${endpoint}`;
		const headers: Record<string, string> = {
			'Authorization': `Bearer ${this.localApiKey}`,
			'Content-Type': 'application/json'
		};

		const requestOptions: RequestInit = {
			method,
			headers,
			...(data && { body: JSON.stringify(data) })
		};

		return fetch(url, requestOptions);
	}

	/**
	 * Get API URL for a network node
	 */
	private getNodeApiUrl(node: NetworkNode): string {
		// Extract connection info from node metadata
		const host = node.metadata.apiHost ?? 'localhost';
		const port = node.metadata.apiPort ?? 27123;
		const protocol = node.metadata.useHttps ? 'https' : 'http';
		
		return `${protocol}://${host}:${port}`;
	}

	/**
	 * Get WebSocket URL for a network node
	 */
	private getNodeWebSocketUrl(node: NetworkNode): string {
		const host = node.metadata.apiHost ?? 'localhost';
		const port = node.metadata.apiPort ?? 27123;
		const protocol = node.metadata.useHttps ? 'wss' : 'ws';
		
		return `${protocol}://${host}:${port}/ws`;
	}

	/**
	 * Get capabilities of a network node
	 */
	private async getNodeCapabilities(nodeUrl: string): Promise<string[]> {
		try {
			const response = await this.makeApiRequest(nodeUrl, '/carnival/network/capabilities', 'GET');
			if (response.ok) {
				const data = await response.json();
				return data.capabilities ?? [];
			}
		} catch (error) {
			Log.error(httpNetworkProtocolLogger, `Failed to get capabilities for ${nodeUrl}:`, error);
		}
		return ['basic_http'];
	}

	/**
	 * Wait for HTTP acknowledgment
	 */
	private waitForHttpAcknowledgment(messageId: string, targetNode: NetworkNode): Promise<NetworkResponse> {
		// Implement HTTP-based acknowledgment waiting
		return new Promise((resolve) => {
			const timeout = setTimeout(() => {
				resolve({
					success: false,
					error: 'HTTP acknowledgment timeout',
					messageId
				});
			}, this.config.communicationTimeout);

			// Poll for acknowledgment
			const checkAck = async () => {
				try {
					const nodeUrl = this.getNodeApiUrl(targetNode);
					const response = await this.makeApiRequest(
						nodeUrl, 
						`/carnival/network/ack/${messageId}`, 
						'GET'
					);
					
					if (response.ok) {
						const ackData = await response.json();
						clearTimeout(timeout);
						resolve({
							success: true,
							data: ackData,
							messageId
						});
					} else {
						// Not ready yet, check again
						setTimeout(checkAck, 1000);
					}
				} catch {
					// Error checking, try again
					setTimeout(checkAck, 1000);
				}
			};

			checkAck();
		});
	}

	/**
	 * Handle heartbeat message
	 */
	private handleHeartbeat(sourceNode: NetworkNode, message: any): void {
		// Update node status and last seen time
		Log.log(httpNetworkProtocolLogger, `💓 Heartbeat from ${ sourceNode.name }`, message);
	}

	/**
	 * Handle record broadcast
	 */
	private handleRecordBroadcast(sourceNode: NetworkNode, message: any): void {
		// Process incoming record broadcast
		Log.log(httpNetworkProtocolLogger, `📡 Record broadcast from ${ sourceNode.name }:`, message.payload);
	}

	/**
	 * Handle network query
	 */
	private handleNetworkQuery(sourceNode: NetworkNode, message: any): void {
		// Process network query and send response
		Log.log(httpNetworkProtocolLogger, `❓ Network query from ${ sourceNode.name }:`, message.payload);
	}

	/**
	 * Get current node information
	 */
	private async getCurrentNodeInfo(): Promise<any> {
		return {
			id: await this.getCurrentNodeId(),
			name: this.app.vault.getName(),
			apiUrl: `http://localhost:${this.localApiPort}`,
			timestamp: new Date().toISOString()
		};
	}

	/**
	 * Get current node ID
	 */
	private getCurrentNodeId(): string {
		const { vault } = this.app;
		const vaultPath = (vault.adapter as any).path;
		return this.generateNodeIdFromPath(vaultPath);
	}

	/**
	 * Generate node ID from vault path
	 */
	private generateNodeIdFromPath(vaultPath: string): string {
		const hash = this.simpleHash(vaultPath);
		return `carnival-node-${hash}`;
	}

	/**
	 * Simple hash function
	 */
	private simpleHash(str: string): string {
		let hash = 0;
		for (let i = 0; i < str.length; i++) {
			const char = str.charCodeAt(i);
			hash = ((hash << 5) - hash) + char;
			hash = hash & hash;
		}
		return Math.abs(hash).toString(36);
	}

	/**
	 * Generate unique message ID
	 */
	private generateMessageId(): string {
		const timestamp = Date.now().toString(36);
		const random = Math.random().toString(36).substring(2, 8);
		return `carnival-msg-${timestamp}-${random}`;
	}

	/**
	 * Deduplicate discovered nodes
	 */
	private deduplicateNodes(nodes: NetworkNode[]): NetworkNode[] {
		const uniqueNodes = new Map<string, NetworkNode>();
		
		for (const node of nodes) {
			if (!uniqueNodes.has(node.id)) {
				uniqueNodes.set(node.id, node);
			}
		}
		
		return Array.from(uniqueNodes.values());
	}

	/**
	 * Clean up connections
	 */
	cleanup(): void {
		// Close all WebSocket connections
		for (const [nodeId, ws] of this.activeConnections) {
			try {
				ws.close();
				Log.log(httpNetworkProtocolLogger, `🔌 Closed WebSocket connection to ${ nodeId }`);
			} catch (error) {
				Log.error(httpNetworkProtocolLogger, `Failed to close WebSocket to ${ nodeId }:`, error);
			}
		}
		
		this.activeConnections.clear();
		Log.log(httpNetworkProtocolLogger, '🌐 HTTP Network Protocol: Cleanup complete');
	}
}