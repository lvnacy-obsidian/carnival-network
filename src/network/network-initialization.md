# Network Initialization

1. `main.ts`
	- `this.settings.networkEnabled` must be set to true
	- `initializeCarnivalNetwork(app, settings)` is run

2. `commands/network-commands.ts`

	`initializeCarnivalNetwork(app, settings)`:
	- `networkConfig` is set with default settings and passed into `CarnivalNetwork` instantiation
	- `const carnivalNetwork` is instantiated with `new CarnivalNetwork(app, networkConfig, settings)`
	- `const initialized` runs `carnivalNetwork.initializeNetwork()`

3. `network/carnival-network.ts`

	`carnivalNetwork.initializeNetwork()`:
	- 