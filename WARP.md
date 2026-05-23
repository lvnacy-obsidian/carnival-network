# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

> **⚠️ IMPORTANT**: Before providing assistance in this project, always review the conversation records in the `.warp/` directory to understand recent plugin developments, decisions made, and ongoing considerations.

## Welcome to Carnival Network Plugin

*The distributed infrastructure of the carnival - where performers connect, territories emerge, and the troupe coordinates across the grounds...*

**Carnival Network** is the foundational infrastructure plugin that enables distributed carnival operations across multiple Obsidian vaults. This plugin provides the "carnival grounds" - the infrastructure services, territory management, and performer coordination that make the entire carnival ecosystem possible.

## The Carnival Hierarchy

Understanding the carnival metaphor is critical to working with this codebase:

- **The Carnival**: The entire distributed ecosystem across all vaults
- **The Grounds**: Infrastructure services (territories, registry, cache) - THIS PLUGIN
- **The Troupe**: Collection of connected performers (the network of vault instances)
- **Performers**: Individual vault instances (each `CarnivalPerformer`)
- **Acts**: Content being shared (`CarnivalAct` instances)
- **Territories**: Named channels/locations on the grounds

**See `.warp/what-is-the-carnival.md` for complete metaphor documentation**

## Project Architecture

### Plugin Structure
```
carnival-network/
├── main.ts                       # Plugin lifecycle ONLY (onload, onunload, settings)
├── src/
│   ├── api/                      # External REST API routes
│   │   └── api-router.ts        # Route registration with Local REST API plugin
│   ├── network/
│   │   ├── carnival-performer.ts        # Individual performer (vault client)
│   │   ├── carnival-troupe-manager.ts   # Troupe coordination functions
│   │   └── services/             # Network services (proper classes)
│   │       ├── cache/            # Performer cache management
│   │       ├── observability/    # Metrics and monitoring
│   │       ├── registry/         # Service discovery
│   │       ├── status/           # Status tracking and health checks
│   │       └── territory/        # Territory management
│   ├── types/
│   │   ├── internal/             # Internal implementation types
│   │   ├── public/               # Public API types (exported to consumers)
│   │   └── type-guards.ts       # Runtime type validation
│   ├── ui/
│   │   └── settings-tab.ts      # Plugin settings interface
│   └── utils/
│       ├── logger.ts            # Logging infrastructure
│       └── plugin-utils.ts      # Obsidian plugin helpers
├── test/                        # Test suite
├── .warp/                       # Session documentation and conversation records
├── WARP.md                      # This file
├── README.md                    # Complete documentation
├── package.json                 # Dependencies and build scripts
├── tsconfig.json                # TypeScript configuration
├── eslint.config.js             # Code quality rules
├── manifest.json                # Obsidian plugin manifest
└── versions.json                # Version tracking
```

### Key Architectural Principles

#### 1. main.ts IS FOR PLUGIN LIFECYCLE ONLY
- `main.ts` contains ONLY: `onload()`, `onunload()`, `loadSettings()`, `saveSettings()`
- ALL business logic lives in service classes under `src/network/services/`
- Services are instantiated in `onload()` and cleaned up in `onunload()`
- **NO** packing functionality into main.ts

**Example:**
```typescript
export default class CarnivalNetworkPlugin extends Plugin {
  public statusMonitor?: CarnivalStatusMonitor;

  async onload() {
    await this.loadSettings();
    this.statusMonitor = new CarnivalStatusMonitor(this);
  }

  async onunload() {
    this.statusMonitor?.cleanup();
  }
}
```

#### 2. Function Binding Pattern - PUBLIC API ONLY
Function binding is ONLY used for methods that must be publicly accessible to other plugins:

```typescript
// PUBLIC API - Uses function binding pattern
export default class CarnivalNetworkPlugin extends Plugin {
  // These are part of the public API for consuming plugins
  joinCarnival(performerId: string, storage: APIKeyStore, config: CarnivalConfig): CarnivalPerformerInterface {
    return joinCarnival.call(this, performerId, storage, config);
  }
  
  async leaveCarnival(performerId: string): Promise<void> {
    await leaveCarnival.call(this, performerId);
  }
}
```

#### 3. Service Class Pattern - INTERNAL USE
For internal functionality, use proper service classes instantiated in main.ts:

```typescript
// INTERNAL SERVICES - Service class pattern
export default class CarnivalNetworkPlugin extends Plugin {
  public statusMonitor?: CarnivalStatusMonitor;
  
  async onload() {
    // Instantiate services
    this.statusMonitor = new CarnivalStatusMonitor(this);
  }
}

// Settings or other code accesses via:
this.plugin.statusMonitor?.refreshCarnivalStatus();
```

#### 4. Types Organization
- `types/internal/` - Internal implementation types (circuit breakers, caches, status, etc.)
- `types/public/` - Public API types exported to consuming plugins
- **NEVER** create types at root of `types/` directory - always use subdirectories
- Follow existing naming patterns (*-types.ts)
- **Reuse existing types** - search before creating new ones

#### 5. Service Module Structure
- Each service is a proper class under `src/network/services/<service-name>/`
- Services receive plugin instance in constructor for access to shared state
- Services maintain their own internal state
- Services provide cleanup() method called in onunload()
- Keep services focused and single-purpose

## Core Functionality

### Performer Management
- **Join Carnival**: Register new performers (vault instances) in the troupe
- **Leave Carnival**: Gracefully remove performers and cleanup resources
- **Troupe Tracking**: Maintain active performer registry

### Infrastructure Services
- **Territory Management**: Named channels/locations for content routing
- **HTTP Registry**: Service discovery and performer registration
- **Certificate Management**: Security and authentication
- **Circuit Breakers**: Fault tolerance and resilience
- **Caching**: Performance optimization for performer data
- **Observability**: Metrics, monitoring, and health checks
- **Status Tracking**: Network health and performance monitoring

### External API
- **REST Endpoints**: Integration with Local REST API plugin
- **Metrics Exposure**: Prometheus-style metrics endpoint
- **Query Interface**: Territory and performer queries

## Development Workflow

### Build Commands
```bash
# Install dependencies (in dev environment)
npm install

# Development mode (watch compilation)
npm run dev

# Build for production
npm run build

# Run test suite
npm test

# Code quality
npm run lint
npm run lint:fix

# Clean build artifacts
npm run clean
```

### Testing Strategy
- Unit tests for individual functions and modules
- Integration tests for service interactions
- Mock Obsidian API for isolated testing
- Test coverage for critical paths

### Code Quality Standards
- **TypeScript Strict Mode**: Full type safety
- **ESLint Integration**: Carnival coding standards
- **Modular Architecture**: Clean separation of concerns
- **Obsidian API Compliance**: Native plugin integration

## Carnival Ecosystem Integration

### Plugin Dependencies
- **Local REST API Plugin**: Required for REST endpoints and metrics exposure
- **Obsidian Secure Storage**: Optional for API key management

### Consumer Plugins
- **carnival-records**: Documentation and changelog management
- **carnival-network-graphql**: GraphQL query interface
- Other carnival plugins that need distributed coordination

### Public API
```typescript
// Exported interface for consuming plugins
interface CarnivalNetworkPlugin {
  // Join the carnival network
  joinCarnival(
    performerId: string,
    storage: APIKeyStore,
    config: CarnivalConfig
  ): CarnivalPerformerInterface;
  
  // Leave the carnival network
  leaveCarnival(performerId: string): Promise<void>;
}
```

## Development Phases

### Phase 3: Infrastructure (Current)
- ✅ 3.1: Core performer and territory services
- ✅ 3.2: Archive abstraction and caching
- ✅ 3.3: External API and authentication
- 🏗️ 3.4: Observability and metrics (in progress)
- 📋 3.5: Security hardening (planned)

### Phase 4: Database Integration (Future)
- Local database for persistent storage
- Cross-vault synchronization
- Advanced query capabilities

## Nomenclature Guide

### ✅ Correct Terms (Keep As-Is)
- `CarnivalPerformer` - A vault instance client
- `CarnivalPerformerInterface` - The performer's contract
- `CarnivalAct` - Content being shared
- `Territory` - Named channel/location
- `CarnivalConfig` - Configuration interface
- `carnival-troupe-manager.ts` - Troupe coordination functions
- `CarnivalStatusMonitor` - Status tracking service class
- `refreshCarnivalStatus()` - Status refresh method
- `disconnectCarnival()` - Disconnect method

### ❌ Avoid These Terms
- "Network" in type names or method names (use "carnival" instead)
- Packing methods into main.ts (use service classes)
- Function binding for internal methods (use service delegation)
- Root-level type files (use internal/ or public/ subdirectories)
- Creating new types without checking if they exist

### 🎪 Carnival Vocabulary
- **Performers**: Individual vault instances
- **Troupe**: Collection of connected performers
- **Grounds**: Infrastructure (this plugin)
- **Acts**: Content being performed/shared
- **Territories**: Named locations/channels
- **Registry**: Service discovery/booking
- **Observability**: Monitoring the show
- **Status**: Health and performance metrics

## Command Integration

### Obsidian Commands
The plugin provides background services without direct UI commands. Configuration is accessed through:
- Settings → Community Plugins → Carnival Network
- Settings tabs for: Configuration, Observability, Status

### Settings Tabs
1. **Configuration Tab**: Territory setup, registry endpoints, cache settings
2. **Observability Tab**: Metrics configuration, export settings, buffer configuration
3. **Status Tab**: Network health, circuit breakers, cache performance, topology

## Git Workflow

### Branch Management
- `main` - Stable releases
- `development` - Active development
- `feature/*` - Feature branches
- `bugfix/*` - Bug fix branches

### Commit Standards
- Follow conventional commits format
- Include issue/task references where applicable
- Keep commits focused and atomic

## 🤖 Agent Protocol & Usage Boundaries

**CRITICAL**: Digital assistants are authorized for **administrative, documentation, and version control tasks ONLY**.

### 🚫 **STRICTLY PROHIBITED**
- **Story writing assistance**: No creative content generation, plot development, character creation, or narrative assistance
- **Editorial content creation**: No writing of articles, posts, or publication content
- **Creative decision making**: No artistic or creative direction
- **Content generation**: No creation of fictional narratives, characters, or story elements

### ✅ **AUTHORIZED USAGE**
- **Documentation**: Technical documentation, WARP.md updates, README files, architectural guides
- **Administration**: File organization, workflow setup, system configuration
- **Version Control**: Git operations, branch management, commit message formatting
- **Code Development**: Plugin development, service modules, testing frameworks
- **Project Management**: Task tracking, progress documentation, workflow optimization
- **System Integration**: API connections, tool configurations, deployment procedures

### 📋 **End-of-Session Documentation Protocol**

**MANDATORY**: All agent sessions MUST conclude with proper documentation following established templates.

#### Pre-Commit Documentation Workflow
1. **Check for Templates**: Always verify and use existing templates in `.warp/` and `ARCHIVE/` directories
2. **CHANGELOG Creation**: 
   - Use `ARCHIVE/CHANGELOG-template.md` if it exists
   - **Use local system date**: Always run `date` command to get correct local timezone date/time
   - Fill in `commit-sha` field after commit
   - Fill in `digital-assistant` field appropriately
   - Follow established frontmatter format precisely
3. **Conversation Summary**:
   - Create session summary in `.warp/conversations/` directory
   - **Use local system date**: Ensure timestamps match user's local timezone
   - Document conversation flow, decisions made, and protocol adherence
   - Include agent contribution level and scope of work
4. **Template Adherence**: 
   - NEVER create custom formats when templates exist
   - Respect established workflow patterns
   - Follow carnival-specific terminology and structure

#### Git Workflow Integration
```bash
# Standard end-of-session sequence:
1. Create CHANGELOG using existing template (if exists)
2. Create conversation summary in .warp/conversations/
3. Add commit SHA to changelog after commit
4. Follow established branch/PR workflow
```

### 🎪 Carnival-Specific Guidelines

#### Documentation Voice
- Use theatrical carnival terminology where established
- Maintain "systematic precision meets supernatural coordination" tone
- Respect existing voice patterns in carnival documentation

#### Template Priority
- Project templates take precedence over global patterns
- Use `.warp/` directory templates for conversation documentation
- Use `ARCHIVE/` directory templates for changelog documentation (if exists)
- NEVER improvise formats when templates exist

#### Protocol Violations
- **Template Bypass**: Creating custom formats instead of using provided templates
- **Unauthorized Content**: Any creative writing or story assistance
- **Workflow Deviation**: Skipping established documentation procedures
- **Context Ignorance**: Not reviewing existing protocols before proceeding
- **Type Duplication**: Creating new types without searching for existing ones

### Template Verification Process

Before creating ANY documentation:
1. **Check `.warp/` directory** for conversation templates
2. **Check `ARCHIVE/` directory** for changelog templates
3. **Review existing WARP.md** for project-specific requirements
4. **Confirm template usage** rather than creating custom formats

### 🕐 Timestamp Management Protocol

**CRITICAL**: Always use local system time for changelog entries and documentation.

#### Date/Time Standards
- **Source**: Local system time via `date` command
- **Format**: ISO 8601 format derived from local timezone
- **Never use**: UTC timestamps from environment context
- **Rationale**: Local timezone provides consistent, user-expected reference points

#### Implementation
```bash
# Always run this command before creating changelog entries
date

# Use the returned local date/time for all timestamp fields
```

### 💻 Technical Documentation Standards

#### Code Documentation
- Inline documentation for complex functions
- README updates for new features or workflow changes
- Architecture documentation for system-level changes
- API documentation for integration points

#### Workflow Documentation
- Step-by-step procedures for complex operations
- Troubleshooting guides for known issues
- Integration guides for external systems
- Deployment and configuration procedures

---

**Remember**: The carnival's distributed infrastructure depends on protocol adherence and clean architecture. Every deviation from established patterns undermines the systematic precision that enables the entire carnival ecosystem to function.

*"The grounds provide the stage, the troupe performs the show, and the carnival becomes legend."* - The Management
