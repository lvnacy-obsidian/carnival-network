# Carnival Network Plugin

**Inter-vault network protocol for Obsidian**

A foundational infrastructure plugin that enables distributed coordination, content sharing, and network communication across multiple Obsidian vaults using HTTP-based registry discovery and P2P-inspired patterns.

[![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)](manifest.json)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](#license)
[![Ko-fi](https://img.shields.io/badge/Ko--fi-Support-orange.svg)](https://ko-fi.com/lvnacy)

---

## Table of Contents

- [What is the Carnival?](#what-is-the-carnival)
- [Features](#features)
- [Use Cases](#use-cases)
  - [For Plugin Developers](#for-plugin-developers)
  - [For External Services](#for-external-services)
- [Installation](#installation)
- [Configuration](#configuration)
- [Current Work](#current-work)
- [Planned Phases](#planned-phases)
- [Architecture](#architecture)
- [API Documentation](#api-documentation)
- [Contributing](#contributing)
- [License](#license)

---

## What is the Carnival?

The **Carnival Network** is a distributed ecosystem that connects multiple Obsidian vaults into a coordinated network. Think of it as a carnival where each vault is a **performer** joining the **troupe** to share their **acts** (content) on the **carnival grounds** (infrastructure).

### The Hierarchy

```
┌─────────────────────────────────────────────────────────────┐
│                    THE CARNIVAL                             │
│              (Entire Distributed Ecosystem)                 │
│                                                             │
│  ┌────────────────────────────────────────────────────┐     │
│  │              CARNIVAL GROUNDS                      │     │
│  │         (Infrastructure/Network Services)          │     │
│  │                                                    │     │
│  │  • Territories (locations/channels)                │     │
│  │  • Registry Service (booking/discovery)            │     │
│  │  • Observability (show metrics)                    │     │
│  └────────────────────────────────────────────────────┘     │
│                                                             │
│  ┌────────────────────────────────────────────────────┐     │
│  │               THE TROUPE                           │     │
│  │        (Network of Connected Performers)           │     │
│  │                                                    │     │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐          │     │
│  │  │Performer │  │Performer │  │Performer │          │     │
│  │  │  (Vault  │  │  (Vault  │  │  (Vault  │          │     │
│  │  │    A)    │  │    B)    │  │    C)    │          │     │
│  │  └──────────┘  └──────────┘  └──────────┘          │     │
│  └────────────────────────────────────────────────────┘     │
│                                                             │
│  ┌────────────────────────────────────────────────────┐     │
│  │                 THE ACTS                           │     │
│  │        (Content Being Performed/Shared)            │     │
│  │                                                    │     │
│  │  • Changelogs                                      │     │
│  │  • Conversations                                   │     │
│  │  • Cross-vault messages                            │     │
│  └────────────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────────┘
```

### Key Concepts

- **The Carnival**: The entire distributed ecosystem across all vaults
- **The Grounds**: Infrastructure services (territories, registry, cache)
- **The Troupe**: Collection of connected performers (the network)
- **Performers**: Individual vault instances (each vault is a performer)
- **Acts**: Content being shared (changelogs, conversations, records)
- **Territories**: Named channels/locations for content distribution

---

## Features

### Current Capabilities (Phase 3.3)

✅ **Network Infrastructure**
- HTTP-based registry discovery
- Circuit breaker pattern for resilience
- Persistent performer cache with LRU eviction
- Territory-based content organization

✅ **Content Management**
- Act creation and broadcasting
- Cross-vault search with relevance scoring
- Territory filtering and querying
- In-memory indexing by territory, type, and performer

✅ **Observability**
- Minimal in-memory metrics system
- Prometheus text format exposition
- Webhook-based push notifications
- Health check endpoints

✅ **Type System**
- Comprehensive carnival-themed type hierarchy
- API response wrappers for consistency
- Request/response type definitions
- Archive abstraction layer

---

## Use Cases

### For Plugin Developers

The Carnival Network provides **infrastructure-only** capabilities. Other plugins can build on top of it:

#### Example: Building a Changelog Sync Plugin

```typescript
import { CarnivalAct } from 'carnival-network';

// Join the carnival as a performer
const carnival = app.plugins.plugins['carnival-network'];
if (!carnival) {
  throw new Error('Carnival Network plugin required');
}

// Broadcast a changelog act
await carnival.broadcastAct({
  type: 'changelog',
  territory: 'backstage',
  title: 'Version 2.0 Released',
  content: 'New features added...',
  metadata: {
    version: '2.0.0',
    changes: ['feature-a', 'bug-fix-b']
  }
});

// Listen for acts from other performers
carnival.on('act-received', (act: CarnivalAct) => {
  if (act.type === 'changelog') {
    // Process incoming changelog
  }
});
```

#### Example Integration Patterns

The plugin includes reference implementations in `examples/integrations/`:

- **Discord Integration**: Receive messages and broadcast as acts
- **GitHub Webhooks**: Transform webhook payloads into carnival acts
- **Beehiiv Integration**: Sync newsletter posts across vaults
- **Webhook Verification**: HMAC signature validation examples

See [`examples/integrations/README.md`](examples/integrations/README.md) for detailed integration guides.

### For External Services

The Carnival Network exposes REST API endpoints (via `obsidian-local-rest-api` plugin) for external services to interact with your vault network.

#### REST API Endpoints

```bash
# Query acts with filtering and pagination
GET /api/acts?territory=backstage&type=changelog&limit=10

# Create a new act
POST /api/acts
{
  "territory": "backstage",
  "type": "changelog",
  "title": "New feature deployed",
  "content": "Description...",
  "broadcast": true
}

# Cross-vault search
POST /api/search
{
  "query": "feature implementation",
  "territories": ["backstage", "development"]
}

# Get network status
GET /api/carnival/status

# List territories
GET /api/territories

# Get analytics
GET /api/analytics?metrics=acts,activity,capabilities
```

#### Webhook Support (Planned - Phase 3.4)

```bash
# Generic webhook endpoint for external services
POST /api/webhooks/:webhookId
X-Carnival-Signature: sha256=<hmac>
X-Carnival-Ts: <timestamp>

{
  "event": "deployment.completed",
  "data": { ... }
}
```

---

## Installation

### Prerequisites

- **Obsidian** v0.15.0 or later
- **Local REST API Plugin** (for external API access)
- **Secure Storage Plugin** (for API key management)

### Install from Community Plugins

1. Open Obsidian Settings
2. Navigate to Community Plugins
3. Search for "Carnival Network"
4. Click Install
5. Enable the plugin

### Manual Installation

```bash
cd /path/to/vault/.obsidian/plugins
git clone https://github.com/xlvnacyx/carnival-network
cd carnival-network
npm install
npm run build
```

---

## Configuration

### Basic Setup

1. Open **Settings → Carnival Network**
2. Configure **Registry Endpoints** (HTTP URLs for performer discovery)
3. Set **Territory Preferences** (default channels to join)
4. Enable **Observability** (optional metrics and monitoring)

### Example Configuration

```json
{
  "registryEndpoints": [
    "http://localhost:3000/registry",
    "https://carnival-registry.example.com"
  ],
  "defaultTerritories": ["backstage", "development"],
  "observability": {
    "enabled": true,
    "provider": "webhook",
    "webhookEndpoint": "https://monitoring.example.com/metrics",
    "webhookSecret": "your-hmac-secret",
    "metricsEnabled": true
  }
}
```

### Configuration Options

| Option | Type | Description |
|--------|------|-------------|
| `registryEndpoints` | `string[]` | HTTP endpoints for registry discovery |
| `defaultTerritories` | `string[]` | Territories to auto-join on startup |
| `observability.enabled` | `boolean` | Enable observability features |
| `observability.provider` | `string` | Monitoring provider (`webhook`) |
| `observability.webhookEndpoint` | `string` | URL for push metrics |
| `observability.webhookSecret` | `string` | HMAC secret for signature verification |
| `observability.metricsEnabled` | `boolean` | Enable `/carnival/metrics` endpoint |

---

## Current Work

**Phase 3.3/5: External API Implementation** (In Progress)

### Recently Completed

✅ **Infrastructure-Only Refactoring** (2025-01-17)
- Removed service-specific handlers (Discord, GitHub, Beehiiv)
- Clarified nomenclature hierarchy (Carnival > Troupe > Performer)
- Created integration guide with reference implementations
- Renamed types: `CarnivalClient` → `CarnivalPerformer`

✅ **Type System Complete** (2025-11-16)
- API response wrappers (`APIResponse<T>`, `PaginationMeta`)
- Nomenclature standardization (Records → Acts)
- Request/response type definitions
- Design principles documented

✅ **Archive Abstraction Layer** (2025-11-15)
- `ArchiveInterface` with multiple implementations
- `InMemoryArchive`, `CacheArchive`, `MockArchive`
- Minimal observability system (metrics + webhook provider)

### Current Tasks

⏳ **API Router Implementation**
- Route registration with Local REST API plugin
- HTTP method mapping (GET, POST, PUT, DELETE)
- Error response formatting
- Request validation middleware

⏳ **ExternalAPIService Completion**
- Complete all endpoint handlers
- Integrate with ActService and CarnivalQueryService
- Request validation and sanitization
- Comprehensive error handling

For detailed status, see [NETWORK-ROADMAP.md](NETWORK-ROADMAP.md).

---

## Planned Phases

### Phase 4: Persistent Database Integration

**Timeline**: After API endpoints fully implemented  
**Selected Solution**: RxDB (reactive, offline-first NoSQL)

**Goals**:
- Replace in-memory storage with persistent database
- Enable complex queries and indexing
- Support offline-first operations
- Reactive data synchronization

**Deliverables**:
- RxDB schema design
- Database migration utilities
- Query optimization
- Performance benchmarking

### Phase 5: Production Hardening

**Timeline**: After database integration complete

**Goals**:
- Comprehensive test coverage (unit, integration, E2E)
- Security hardening (rate limiting, authentication)
- Performance optimization
- Documentation completion

**Deliverables**:
- Test suite with >80% coverage
- Security audit and penetration testing
- Performance profiling and optimization
- User documentation and guides

### Future Enhancements

- **Multi-vault sync**: Conflict resolution and merge strategies
- **Real-time collaboration**: WebSocket-based live updates
- **Plugin marketplace**: Discover and install integrations
- **Advanced analytics**: Network topology visualization, usage insights

For detailed roadmap, see [NETWORK-ROADMAP.md](NETWORK-ROADMAP.md).

---

## Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────┐
│                    Obsidian Vault                       │
│                                                         │
│  ┌────────────────────────────────────────────────┐     │
│  │         Carnival Network Plugin                │     │
│  │                                                │     │
│  │  ┌──────────────┐  ┌──────────────┐            │     │
│  │  │  ActService  │  │ CarnivalQuery│            │     │
│  │  │              │  │   Service    │            │     │
│  │  └──────────────┘  └──────────────┘            │     │
│  │                                                │     │
│  │  ┌──────────────┐  ┌──────────────┐            │     │
│  │  │   Territory  │  │  HttpRegistry│            │     │
│  │  │ AccessService│  │   Service    │            │     │
│  │  └──────────────┘  └──────────────┘            │     │
│  │                                                │     │
│  │  ┌──────────────────────────────────┐          │     │
│  │  │ PersistentPerformerCache (LRU)   │          │     │
│  │  └──────────────────────────────────┘          │     │
│  └────────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────┘
           │                          │
           │                          │
           ▼                          ▼
┌──────────────────┐        ┌──────────────────┐
│  Local REST API  │        │  HTTP Registry   │
│     Plugin       │        │    Endpoints     │
└──────────────────┘        └──────────────────┘
```

### Core Services

| Service | Responsibility |
|---------|---------------|
| **ActService** | Act creation, broadcasting, querying, search |
| **CarnivalQueryService** | Network analytics, topology, performer status |
| **PerformerAccessService** | Read-only performer cache access |
| **HttpRegistryService** | Territory registration and discovery |
| **PersistentPerformerCache** | LRU cache with vault persistence |

### Design Principles

1. **Infrastructure-Only**: Core plugin provides coordination, not application logic
2. **Companion Plugins**: Service integrations as separate plugins
3. **Type Safety**: Comprehensive TypeScript type system
4. **Resilience**: Circuit breaker patterns, graceful degradation
5. **Observability**: Built-in metrics and monitoring

---

## API Documentation

### TypeScript API (for Plugin Developers)

```typescript
import { CarnivalNetworkPlugin } from 'carnival-network';

// Access plugin instance
const carnival = app.plugins.plugins['carnival-network'] as CarnivalNetworkPlugin;

// Broadcast an act
await carnival.broadcastAct({
  type: 'changelog',
  territory: 'backstage',
  title: 'Feature released',
  content: '...',
  metadata: { version: '1.0' }
});

// Query acts
const acts = await carnival.queryActs({
  territory: 'backstage',
  type: 'changelog',
  limit: 10,
  offset: 0
});

// Search across vaults
const results = await carnival.performSearch({
  query: 'implementation details',
  territories: ['backstage', 'development']
});

// Get network status
const status = await carnival.getCarnivalStatus();
```

### REST API (for External Services)

Full REST API documentation available at:
- **OpenAPI Spec**: Coming soon
- **Interactive Docs**: `/api/docs` (when Local REST API plugin enabled)
- **Testing Guide**: `.warp/api-testing-phase-3-3.md` (development)

**Example Requests**:

```bash
# Query acts
curl -X GET "http://localhost:27124/api/acts?territory=backstage&limit=10"

# Create act
curl -X POST "http://localhost:27124/api/acts" \
  -H "Content-Type: application/json" \
  -d '{
    "territory": "backstage",
    "type": "changelog",
    "title": "New deployment",
    "broadcast": true
  }'

# Search
curl -X POST "http://localhost:27124/api/search" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "feature implementation",
    "territories": ["backstage"]
  }'
```

---

## Contributing

We welcome contributions to the Carnival Network! Whether it's bug reports, feature requests, or code contributions, your input helps improve the plugin for everyone.

### Contribution Process

1. **Check Existing Issues**: Search [GitHub Issues](https://github.com/xlvnacyx/carnival-network/issues) to avoid duplicates
2. **Fork the Repository**: Create your own fork for development
3. **Create a Branch**: Use descriptive branch names (`feature/add-webhook-support`)
4. **Make Changes**: Follow existing code style and patterns
5. **Test Thoroughly**: Add tests for new features
6. **Submit Pull Request**: Describe your changes clearly

### Development Setup

```bash
# Clone repository
git clone https://github.com/xlvnacyx/carnival-network
cd carnival-network

# Install dependencies
npm install

# Development build (watch mode)
npm run dev

# Production build
npm run build

# Run linter
npm run lint

# Run tests (when available)
npm test
```

### Coding Guidelines

- Follow existing TypeScript patterns and naming conventions
- Maintain carnival-themed nomenclature (Acts, Performers, Territories)
- Write self-documenting code with comprehensive JSDoc comments
- Add tests for new features and bug fixes
- Update documentation for user-facing changes

### Resources

- **Roadmap**: [NETWORK-ROADMAP.md](NETWORK-ROADMAP.md)
- **Changelog**: [CHANGELOG.md](CHANGELOG.md)
- **Integration Examples**: [examples/integrations/](examples/integrations/)
- **Type Definitions**: [src/types/public/](src/types/public/)

For detailed contribution guidelines, see [CONTRIBUTING.md](https://github.com/xlvnacyx/.github/blob/main/CONTRIBUTING.md) in the organization repository.

---

## License

This project is licensed under the **MIT License**.

```
MIT License

Copyright (c) 2025 L V N A C Y

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

**Note**: License terms may be updated in future releases. Current version uses MIT License.

---

## Support

- **Issues**: [GitHub Issues](https://github.com/lvnacy-obsidian/carnival-network/issues)
- **Discussions**: [GitHub Discussions](https://github.com/lvnacy-obsidian/carnival-network/discussions)
- **Funding**: [Ko-fi](https://ko-fi.com/lvnacy)
- **Author**: [L V N A C Y](https://github.com/xlvnacyx)

---

## Acknowledgments

Built with ❤️ for the Obsidian community.

Special thanks to:
- The Obsidian team for creating an extensible platform
- The Local REST API plugin for enabling external integrations
- All contributors and users of the Carnival Network

---

*"Step right up! The carnival network welcomes all performers to join the troupe and share their acts across the grounds. Let the show begin!"* 🎪✨
