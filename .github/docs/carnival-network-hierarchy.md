# 🎪 Carnival Network - Hierarchy & Metaphor Guide

## Overview

The Carnival Network uses a theatrical carnival metaphor to describe a distributed network of Obsidian vaults. This guide explains each component and how they relate to both the carnival theme and the technical implementation.

---

## 🎭 The Complete Hierarchy

```
Carnival Network (The Whole Show)
├── Territories (Locations/Regions)
│   ├── Performers (Individual Vaults/Nodes)
│   │   ├── Acts (Records/Content)
│   │   └── PerformerRatings (Metrics)
│   └── RegistryEntry (Lightweight performer info)
└── Clients/Troupes (Plugin Network Instances)
```

---

## 📖 Component Definitions

### 🎪 **Carnival Network** (Top Level)

**What it is:**
- The entire distributed network of connected Obsidian vaults
- A plugin that enables cross-vault communication and synchronization

**Carnival Metaphor:**
- The whole carnival event - all the tents, stages, performers, and audience combined

**Technical Reality:**
- A standalone Obsidian plugin (`carnival-network`)
- Provides network infrastructure that other plugins can use
- Manages connections, discovery, and communication between vaults

**Example:**
- Your entire ecosystem of connected vaults working together

---

### 🗺️ **Territories** (Regions/Locations)

**What it is:**
- Logical groupings or classifications of vaults
- Named regions that help organize the network
- Can represent different purposes, projects, or organizational units

**Carnival Metaphor:**
- Different areas of the carnival grounds
- "Backstage" = private/development area
- "Main Stage" = public/production area
- "Necropolis" = archive/historical area
- "Boutique" = creative/content area

**Technical Reality:**
- A string identifier assigned to each vault (e.g., `territory: "backstage"`)
- Used for filtering, routing, and organizing performers
- Helps target specific subsets of the network for broadcasts

**Example:**
```typescript
{
  territoryName: "backstage",
  performerCount: 5,
  lastSeen: "2024-01-15T10:30:00Z"
}
```

**Key Points:**
- One territory can contain multiple performers
- Performers are discovered and grouped by territory
- Acts can be broadcast to specific territories

---

### 🎭 **Performers** (Individual Vaults/Nodes)

**What it is:**
- An individual Obsidian vault participating in the carnival network
- The actual participant/node in the distributed system
- Has full identity, capabilities, and metadata

**Carnival Metaphor:**
- The actual performers in the show (musicians, acrobats, magicians)
- Each has unique skills (capabilities) and performs in a specific area (territory)
- Can be actively performing or taking an intermission

**Technical Reality:**
```typescript
interface Performer {
  id: string;                    // Unique identifier
  name: string;                  // Vault name
  territory: string;             // Which region they're in
  lastSeen: string;              // Last activity timestamp
  capabilities: string[];        // What they can do
  status?: 'active' | 'inactive' | 'unknown';
  metadata: PerformerMetadata;   // Technical details (API, platform, etc.)
}
```

**Example:**
```typescript
{
  id: "carnival-performer-abc123",
  name: "John's Development Vault",
  territory: "backstage",
  lastSeen: "2024-01-15T10:30:00Z",
  capabilities: ["act_sync", "changelog_sync", "webhook_notifications"],
  metadata: {
    apiHost: "localhost",
    apiPort: 27123,
    platform: "macos",
    version: "1.0.0"
  }
}
```

**Key Points:**
- Each vault becomes a Performer when it joins the network
- Performers are discovered via registries
- Cached locally for quick access
- Full representation with rich metadata

---

### 📋 **RegistryEntry** (Lightweight Performer Reference)

**What it is:**
- A lightweight, simplified version of Performer data
- Used in registries and for network communication
- Contains only essential information for discovery and routing

**Carnival Metaphor:**
- The "playbill" or "program guide" entry
- Basic info: who they are, where they perform, when they're available
- Not the full performer biography

**Technical Reality:**
```typescript
interface RegistryEntry {
  performerId: string;
  territoryName: string;
  endpoint: string;
  capabilities: string[];
  lastSeen?: string;
  metadata?: Record<string, unknown>;
}
```

**Example:**
```typescript
{
  performerId: "carnival-performer-abc123",
  territoryName: "backstage",
  endpoint: "http://localhost:27123",
  capabilities: ["act_sync", "changelog_sync"],
  lastSeen: "2024-01-15T10:30:00Z"
}
```

**Key Points:**
- Minimal data for efficient network communication
- Returned by registry queries and territory service
- Converted from full Performer when needed

---

### 🎬 **Acts** (Records/Content)

**What it is:**
- Content/records that are broadcast across the network
- The actual "performance" or data being shared
- Can be changelogs, conversations, status updates, or custom content

**Carnival Metaphor:**
- The actual performances in the show
- A magic trick, a musical number, an acrobatic display
- What the performers do and what the audience experiences

**Technical Reality:**
```typescript
interface CarnivalRecord {
  id: string;
  title: string;
  territory: string;
  actType: string;              // 'changelog', 'conversation', etc.
  content: string;
  status: 'active' | 'archived' | 'cancelled';
  syncPreferences: {
    requireAck: boolean;
    broadcastToAll: boolean;
    targetTerritories?: string[];
  };
}
```

**Example:**
```typescript
{
  id: "act-xyz789",
  title: "New Feature Released",
  territory: "backstage",
  actType: "changelog",
  content: "Added dark mode support...",
  syncPreferences: {
    requireAck: true,
    broadcastToAll: false,
    targetTerritories: ["backstage", "main"]
  }
}
```

**Key Points:**
- Created by performers
- Broadcast to other performers
- Can target specific territories
- Different types for different purposes

---

### 📊 **PerformerRatings** (Performance Metrics)

**What it is:**
- Performance metrics and statistics for a performer
- Tracks how well the performer is doing in the network
- Request counts, response times, success rates

**Carnival Metaphor:**
- Audience reviews and critic ratings
- "How well is this performer doing?"
- Box office numbers, attendance, satisfaction scores

**Technical Reality:**
```typescript
interface PerformerRatings {
  performerId: string;
  requestCount: number;
  successCount: number;
  failureCount: number;
  averageResponseTime: number;
  minResponseTime: number;
  maxResponseTime: number;
  successRate?: number;
  performanceScore?: number;
}
```

**Key Points:**
- Tracks operational health
- Used for monitoring and debugging
- Helps identify network issues

---

### 🎪 **Clients/Troupes** (Network Client Instances)

**What it is:**
- An instance of `CarnivalNetworkClient` created for a consuming plugin
- The interface that plugins use to interact with the carnival network
- Manages network operations for a specific plugin

**Carnival Metaphor (Current - "Troupes"):**
- A troupe is a group/company of performers traveling together
- The management team and support crew for a performer
- Handles logistics, scheduling, and coordination

**Carnival Metaphor (Alternative - Could just call them "Clients"):**
- The stage manager or coordinator for a specific act
- The technical crew that makes the performance possible

**Technical Reality:**
```typescript
// In main.ts of carnival-network plugin
private activeTroupes: Map<string, CarnivalNetworkClient> = new Map();

// Each consuming plugin gets one
const client = networkPlugin.joinCarnival('my-plugin', storage, config);
```

**Example:**
```typescript
// Carnival Records plugin joins the network
const carnivalRecordsClient = networkPlugin.joinCarnival(
  'carnival-records',    // Plugin ID
  secureStorage,         // API key storage
  networkConfig          // Network configuration
);

// Now Carnival Records can:
await carnivalRecordsClient.enterRing();
await carnivalRecordsClient.establishTerritory('backstage');
await carnivalRecordsClient.broadcastAct(record);
```

**Key Points:**
- One client per consuming plugin
- Encapsulates all network operations for that plugin
- Lifecycle: `joinCarnival()` → `enterRing()` → perform operations → `leaveRing()`
- Plugin-specific configuration and state

---

## 🔄 How They Relate

### Example Scenario

```
1. Carnival Records plugin wants to join the network
   └─> Calls: networkPlugin.joinCarnival('carnival-records')
   └─> Creates: A "troupe" (CarnivalNetworkClient instance)

2. The troupe/client initializes
   └─> Calls: client.enterRing()
   └─> This vault becomes a Performer in the "backstage" territory

3. The performer registers with registries
   └─> Creates: RegistryEntry (lightweight format)
   └─> Stored in: Registry caches

4. Other performers discover this performer
   └─> Query: territoryService.scoutTerritories('backstage')
   └─> Returns: List of RegistryEntry objects

5. Performer creates and broadcasts an act
   └─> Creates: CarnivalRecord (an act)
   └─> Broadcasts: To other performers in target territories

6. Metrics are tracked
   └─> Updates: PerformerRatings for each performer
   └─> Monitor: Network health and performance
```

---

## 🤔 Terminology Questions

### Is "Troupe" the right term?

**Current Usage:**
- A troupe = A `CarnivalNetworkClient` instance for a plugin
- Managed by the main carnival-network plugin
- One troupe per consuming plugin

**Potential Confusion:**
- "Troupe" often means a GROUP of performers
- But we use it for a single client instance
- Doesn't clearly indicate "this is the interface for network operations"

**Alternatives:**

1. **Client** (Most Clear)
   - Straightforward, technical, accurate
   - `private activeClients: Map<string, CarnivalNetworkClient>`
   
2. **Performance** (Carnival Theme)
   - "A plugin's performance in the carnival"
   - Each plugin has its own performance/participation
   - `private activePerformances: Map<string, CarnivalNetworkClient>`

3. **Act Manager**
   - Manages acts for a specific plugin
   - Handles the performance logistics

4. **Stage** (Carnival Theme)
   - Each plugin gets its own stage to perform from
   - `private activeStages: Map<string, CarnivalNetworkClient>`

5. **Keep Troupe** (Current)
   - Redefine it as "the crew/team managing this plugin's network participation"
   - Document it clearly

---

## 📚 Quick Reference

| Term | What It Is | Carnival Analogy | Code Type |
|------|-----------|------------------|-----------|
| **Carnival Network** | The whole system | The entire carnival event | Plugin |
| **Territory** | Logical region | Area of carnival grounds | `string` |
| **Performer** | Individual vault | Performer in the show | `Performer` interface |
| **RegistryEntry** | Lightweight performer data | Playbill entry | `RegistryEntry` interface |
| **Act** | Broadcast content | Performance/show | `CarnivalRecord` interface |
| **PerformerRatings** | Performance metrics | Audience reviews | `PerformerRatings` interface |
| **Troupe/Client** | Plugin's network instance | Stage crew/manager | `CarnivalNetworkClient` class |

---

## 🎯 Design Philosophy

The carnival metaphor was chosen to:
1. **Make the system memorable and fun** - Easier to understand and work with
2. **Reflect the distributed nature** - Like a traveling carnival with multiple locations
3. **Capture the collaborative spirit** - Different acts working together to create a show
4. **Distinguish from generic networking terms** - Makes the codebase unique and cohesive

The key is maintaining consistency while keeping the metaphor intuitive!