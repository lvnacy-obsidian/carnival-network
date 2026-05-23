# Carnival Network API Integration Guide

## Overview

The Carnival Network plugin provides a centralized network abstraction layer for Obsidian plugins that need to make external API calls. Rather than each plugin implementing its own network logic, the Carnival Network acts as a shared infrastructure that handles:

- API key management via Secure Storage integration
- Request queuing and retry logic
- Rate limiting and timeout management
- Standardized error handling
- Centralized logging and monitoring

## Architecture

The network functionality is abstracted into two main components:

1. **`main.ts`**: Plugin lifecycle management and public API exposure
2. **`carnival-network.ts`**: Core network client creation and management logic

This separation allows the plugin to expose a clean public API while keeping implementation details encapsulated.

## Joining the Carnival

### Prerequisites

Your plugin must have access to:
- The Carnival Network plugin instance
- A Secure Store (`APIKeyStorage`) instance
- A network configuration object

### Basic Integration

```typescript
import type { 
  CarnivalPerformerInterface,
  CarnivalConfig,
  APIKeyStorage 
} from 'carnival-network';

// Get the Carnival Network plugin
const carnivalPlugin = this.app.plugins.plugins['carnival-network'];

if (!carnivalPlugin) {
  throw new Error('Carnival Network plugin not found');
}

// Configure your network client
const config: CarnivalConfig = {
  maxRetries: 3,
  communicationTimeout: 5000,
  enableDebugLogging: false,
  registeredPerformers: []
};

// Get your Secure Storage instance
const secureStorage = this.app.plugins.plugins['obsidian-secure-store'];
const storage: APIKeyStorage = secureStorage.getAPIKeyStorage();

// Join the carnival and get your network client
const networkClient = carnivalPlugin.joinCarnival(
  'my-plugin-id',  // Unique identifier for your plugin
  storage,
  config
);

// Initialize the client
await networkClient.enterRing();
```

### Full Example

```typescript
export default class MyPlugin extends Plugin {
  private networkClient: CarnivalPerformerInterface;

  async onload(): Promise<void> {
    // Wait for plugins to load
    this.app.workspace.onLayoutReady(async () => {
      await this.initializeNetwork();
    });
  }

  private async initializeNetwork(): Promise<void> {
    const carnivalPlugin = this.app.plugins.plugins['carnival-network'];
    const secureStorage = this.app.plugins.plugins['obsidian-secure-store'];

    if (!carnivalPlugin || !secureStorage) {
      console.error('Required plugins not available');
      return;
    }

    const config: CarnivalConfig = {
      maxRetries: 3,
      communicationTimeout: 5000,
      enableDebugLogging: false,
      registeredPerformers: []
    };

    this.networkClient = carnivalPlugin.joinCarnival(
      'my-plugin',
      secureStorage.getAPIKeyStorage(),
      config
    );

    await this.networkClient.enterRing();
  }

  async onunload(): Promise<void> {
    // Leave the carnival when unloading
    const carnivalPlugin = this.app.plugins.plugins['carnival-network'];
    if (carnivalPlugin && this.networkClient) {
      await carnivalPlugin.leaveCarnival('my-plugin');
    }
  }
}
```

## Leaving the Carnival

When your plugin unloads, you should properly clean up your network client:

```typescript
async onunload(): Promise<void> {
  const carnivalPlugin = this.app.plugins.plugins['carnival-network'];
  
  if (carnivalPlugin) {
    await carnivalPlugin.leaveCarnival('my-plugin-id');
  }
}
```

This will:
- Clean up the network client resources
- Remove your plugin from the active performers list
- Update the Carnival Network settings

## Using the Network Client

Once you have a network client, you can use it to make API requests:

```typescript
// Example API call
const response = await this.networkClient.makeRequest({
  method: 'GET',
  url: 'https://api.example.com/data',
  headers: {
    'Authorization': `Bearer ${apiKey}`
  }
});
```

## Configuration Options

### CarnivalConfig

```typescript
interface CarnivalConfig {
  maxRetries: number;              // Maximum retry attempts for failed requests
  communicationTimeout: number;    // Timeout in milliseconds
  enableDebugLogging: boolean;     // Enable detailed logging
  registeredPerformers: string[];  // List of registered plugin IDs
}
```

## Error Handling

The network client includes built-in error handling and retry logic. Make sure to wrap your API calls in try-catch blocks:

```typescript
try {
  const data = await this.networkClient.makeRequest(config);
  // Handle successful response
} catch (error) {
  // Handle error (after retries exhausted)
  console.error('Network request failed:', error);
}
```

## Dependencies

The Carnival Network requires:
- **Local REST API plugin**: For making external HTTP requests
- **Secure Store plugin**: For API key management

The plugin will verify these dependencies on load and throw descriptive errors if they're missing.

## Best Practices

1. **Single Client Per Plugin**: Each plugin should create only one network client using a unique identifier
2. **Proper Cleanup**: Always call `leaveCarnival()` in your `onunload()` method
3. **Configuration**: Adjust retry and timeout settings based on your API's characteristics
4. **Error Handling**: Always handle network errors gracefully with user-friendly messages
5. **Lazy Loading**: Consider initializing the network client only when needed rather than on plugin load

## Troubleshooting

### "Carnival Network requires Local REST API plugin"
Install the Local REST API plugin from Community Plugins.

### "Troupe already exists for: [plugin-id]"
You're trying to join the carnival with an ID that's already registered. Use a unique identifier or clean up the existing client first.

### Network requests timing out
Increase the `communicationTimeout` value in your config or check your network connection and API availability.
