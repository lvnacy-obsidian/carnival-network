Based on the code review, I'll break down how the HTTP Registry Service operates and explain the differences between performers, registries, and territories:

# Core Components
## Performers
*Individual Obsidian vaults that are part of the Carnival network.*
Each performer:
- Has a unique ID (generated from vault path)
- Has a name (vault name)
- Belongs to a territory
- Has specific capabilities (like REST API, templating, dataview queries)
- Reports its metadata (API host/port, platform, version)

## Registries
*HTTP endpoints that act as coordination points for the network.*
They:
- Maintain lists of active performers
- Handle performer registration/unregistration
- Process heartbeat signals
- Enable performer discovery
- Default endpoints include:
	- http://localhost:27123 (local)
	- http://192.168.1.100:27123 (common local network)
	- http://10.0.0.100:27123 (alternative local network)

## Territories
*Logical groupings of performers based on their vault paths.*
The recognized territories are:
- necropolis
- backstage
- boutique
- athenaeum
- carnival-main
- unknown (default if no specific territory is detected)

# Key Operations
## Performer Registration
- Performers register themselves with all known registries
- Start sending heartbeats every 30 seconds
- Provide their capabilities and metadata

## Performer Discovery
- Performers can query registries to discover other performers
- Results are deduplicated by performer ID
- Most recent performer data is preserved based on lastSeen timestamp

## Network Topology
- Tracks total number of performers
- Maintains counts of performers per territory
- Tracks available capabilities across the network
- Monitors active registry count

# Key Differences
## Performers vs Registries
- Performers are Obsidian vaults that participate in the network
- Registries are coordination services that maintain network state
- Performers connect to multiple registries for redundancy
- Registries handle the bookkeeping of network topology

## Territories vs Performers
- Territories are high-level organizational units
- Multiple performers can exist in one territory
- Territories appear to represent different functional areas of the Carnival system
- Performers inherit their territory based on their vault path

## Registries vs Territories
- Registries operate across all territories
- Territories are logical groupings within the registry system
- Registries maintain the complete network view
- Territories help organize performers by their purpose/location

# Network Features
## Heartbeat System
- Regular 30-second intervals
- Maintains performer presence
- Updates last seen timestamp
- Helps identify active/inactive performers

## Capability Detection
- Base capabilities: http_communication, record_sync
- Plugin-based capabilities:
- rest_api (obsidian-local-rest-api)
- templating (templater-obsidian)
- dataview_queries (dataview)

## Performer Search
- Can find performers by ID, name, territory
- Can search by required capabilities
- Supports territory-specific performer listings

This service appears to be part of a larger distributed system where Obsidian vaults can communicate and coordinate with each other, organized into territories and managed through registry endpoints. The design supports scalability and fault tolerance through multiple registries and territory-based organization.