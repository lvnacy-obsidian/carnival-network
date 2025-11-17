Perfect! Let's break Phase 3.3 into well-defined sub-phases with clear deliverables and documentation. I'll structure this as a proper implementation plan with commit boundaries.

---

# Phase 3.3 Implementation Plan - Complete REST API Service

## Phase 3.3 Overview

**Goal**: Create a production-ready external REST API service for the Carnival Network plugin

**Sub-Phases**:
- **3.3.1**: Core REST API Endpoints (Week 1)
- **3.3.2**: Authentication & Authorization (Week 2)
- **3.3.3**: Webhook Integration & Documentation (Week 3)
- **3.3.4**: Testing & Hardening (Week 4)

---

## Phase 3.3.1: Core REST API Endpoints

### Objectives
- Create `ExternalAPIService` class
- Implement core RESTful endpoints
- Integrate with existing ActService and CarnivalQueryService
- Register routes with Local REST API plugin
- Basic error handling and validation

### Deliverables

#### 1. External API Service Structure
**File**: `src/network/external-api-service.ts` (New)

```typescript
import { Log } from '../utils/logger';
import { ValidationError, InternalServerError, NotFoundError } from '../errors';
import type { ActService } from './services/act-service';
import type { CarnivalQueryService } from './services/carnival-query-service';
import type {
  APIRequest,
  LogContext,
  CarnivalAct,
  ActQueryParams,
  SearchRequestBody
} from '../types/public';

const apiLogger: LogContext = {
  context: 'External API Service',
  path: '/.obsidian/plugins/carnival-network/network/external-api-service'
};

/**
 * 🎪 External API Service - RESTful endpoints for external clients
 * 
 * Provides HTTP endpoints for external systems to interact with the
 * Carnival Network. Handles records CRUD, search, and network status.
 */
export class ExternalAPIService {
  constructor(
    private readonly actService: ActService,
    private readonly queryService: CarnivalQueryService
  ) {
    Log.log(apiLogger, '🎪 External API Service initialized');
  }

  /**
   * ========================================================================
   * RECORDS ENDPOINTS
   * ========================================================================
   */

  /**
   * Query records with pagination and filtering
   * GET /api/records?territory=backstage&type=changelog&limit=10&offset=0
   */
  async handleRecordsQuery(request: APIRequest): Promise<RecordQueryResponse> {
    try {
      const params = this.parseRecordQueryParams(request.query);
      
      // Validate pagination
      if (params.limit < 1 || params.limit > 100) {
        throw new ValidationError(
          'Invalid pagination parameters',
          { limit: 'Must be between 1 and 100' }
        );
      }

      if (params.offset < 0) {
        throw new ValidationError(
          'Invalid pagination parameters',
          { offset: 'Must be non-negative' }
        );
      }

      // Query acts
      const acts = await this.actService.queryActs(params);
      const total = await this.actService.countActs({
        territory: params.territory,
        type: params.type
      });

      return {
        status: 'success',
        data: acts.map(this.formatActForResponse),
        pagination: {
          limit: params.limit,
          offset: params.offset,
          total,
          hasNext: (params.offset + params.limit) < total,
          hasPrevious: params.offset > 0
        },
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      Log.error(apiLogger, 'Records query failed:', error);
      throw this.handleAPIError(error);
    }
  }

  /**
   * Create a new record
   * POST /api/records
   */
  async handleRecordCreate(request: APIRequest): Promise<RecordCreateResponse> {
    try {
      const body = this.parseRecordCreateBody(request.body);
      
      // Validate required fields
      this.validateRecordCreate(body);

      // Create record
      const record = await this.actService.createAct({
        title: body.title,
        territory: body.territory,
        actType: body.type,
        content: body.content || '',
        metadata: {
          ...body.metadata,
          createdVia: 'external-api',
          createdAt: new Date().toISOString()
        },
        createdAt: new Date(),
        status: 'active',
        syncPreferences: {
          requireAck: body.requireAck ?? true,
          broadcastToAll: body.broadcastToAll ?? false,
          targetTerritories: body.targetTerritories || [body.territory]
        }
      });

      // Broadcast if requested
      if (body.broadcast !== false) {
        await this.actService.broadcastAct(record);
      }

      return {
        status: 'success',
        data: {
          id: record.id,
          title: record.title,
          territory: record.territory,
          createdAt: record.createdAt
        },
        message: 'Record created successfully',
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      Log.error(apiLogger, 'Record creation failed:', error);
      throw this.handleAPIError(error);
    }
  }

  /**
   * Get a specific record by ID
   * GET /api/records/:id
   */
  async handleRecordGet(request: APIRequest): Promise<RecordGetResponse> {
    try {
      const { id } = request.params || {};
      
      if (!id) {
        throw new ValidationError('Record ID is required', { id: 'Missing record ID' });
      }

      const record = await this.actService.getAct(id);
      
      if (!record) {
        throw new NotFoundError('Record', id);
      }

      return {
        status: 'success',
        data: this.formatActForResponse(record),
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      Log.error(apiLogger, 'Record get failed:', error);
      throw this.handleAPIError(error);
    }
  }

  /**
   * ========================================================================
   * SEARCH ENDPOINT
   * ========================================================================
   */

  /**
   * Search across carnival records
   * POST /api/search
   */
  async handleSearch(request: APIRequest): Promise<SearchResponse> {
    try {
      const body = this.parseSearchBody(request.body);
      
      // Validate search query
      if (!body.query || body.query.trim().length < 2) {
        throw new ValidationError(
          'Invalid search parameters',
          { query: 'Query must be at least 2 characters' }
        );
      }

      if (body.query.length > 200) {
        throw new ValidationError(
          'Invalid search parameters',
          { query: 'Query must not exceed 200 characters' }
        );
      }

      const limit = Math.min(body.limit || 20, 100);

      // Perform search
      const results = await this.actService.performSearch({
        query: body.query.trim(),
        territories: body.territories || [],
        limit
      });

      return {
        status: 'success',
        data: {
          query: body.query.trim(),
          results,
          resultCount: results.length,
          hasMore: results.length === limit
        },
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      Log.error(apiLogger, 'Search failed:', error);
      throw this.handleAPIError(error);
    }
  }

  /**
   * ========================================================================
   * NETWORK STATUS ENDPOINTS
   * ========================================================================
   */

  /**
   * Get network status and health
   * GET /api/network/status
   */
  async handleNetworkStatus(): Promise<NetworkStatusResponse> {
    try {
      const topology = this.queryService.getCarnivalTopology();
      const uptime = this.queryService.getUptimeMs();
      const connectedPerformers = this.queryService.getConnectedPerformersCount();

      return {
        status: 'success',
        data: {
          health: 'operational',
          uptime: {
            milliseconds: uptime,
            formatted: this.formatUptime(uptime)
          },
          network: {
            totalPerformers: topology.totalPerformers,
            connectedPerformers,
            territories: Object.keys(topology.territories).length,
            activeRegistries: topology.activeRegistries
          },
          capabilities: topology.capabilities
        },
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      Log.error(apiLogger, 'Network status query failed:', error);
      throw this.handleAPIError(error);
    }
  }

  /**
   * Get territories list
   * GET /api/territories
   */
  async handleTerritoriesList(): Promise<TerritoriesResponse> {
    try {
      const topology = this.queryService.getCarnivalTopology();
      
      const territories = Object.entries(topology.territories).map(([name, performerCount]) => ({
        name,
        performerCount,
        status: performerCount > 0 ? 'active' : 'inactive' as const
      }));

      return {
        status: 'success',
        data: {
          territories,
          total: territories.length,
          active: territories.filter(t => t.status === 'active').length
        },
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      Log.error(apiLogger, 'Territories list failed:', error);
      throw this.handleAPIError(error);
    }
  }

  /**
   * Get network analytics
   * GET /api/analytics?metrics=records,activity,capabilities
   */
  async handleAnalytics(request: APIRequest): Promise<AnalyticsResponse> {
    try {
      const params = request.query as { metrics?: string; timeframe?: string };
      const metrics = this.parseMetricsParam(params.metrics);
      const timeframe = params.timeframe || '7d';

      const data = this.queryService.generateAnalytics(metrics);

      return {
        status: 'success',
        data: {
          timeframe,
          ...data
        },
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      Log.error(apiLogger, 'Analytics query failed:', error);
      throw this.handleAPIError(error);
    }
  }

  /**
   * ========================================================================
   * HELPER METHODS
   * ========================================================================
   */

  private parseRecordQueryParams(query: Record<string, unknown>): ActQueryParams & { limit: number; offset: number } {
    return {
      territory: typeof query.territory === 'string' ? query.territory : undefined,
      type: typeof query.type === 'string' ? query.type : undefined,
      limit: typeof query.limit === 'string' ? parseInt(query.limit, 10) : 10,
      offset: typeof query.offset === 'string' ? parseInt(query.offset, 10) : 0
    };
  }

  private parseRecordCreateBody(body: unknown): RecordCreateBody {
    if (!body || typeof body !== 'object') {
      throw new ValidationError('Request body must be an object', {});
    }

    const parsed = body as Record<string, unknown>;

    return {
      title: typeof parsed.title === 'string' ? parsed.title : '',
      territory: typeof parsed.territory === 'string' ? parsed.territory : '',
      type: typeof parsed.type === 'string' ? parsed.type : 'changelog',
      content: typeof parsed.content === 'string' ? parsed.content : undefined,
      metadata: parsed.metadata && typeof parsed.metadata === 'object' 
        ? parsed.metadata as Record<string, unknown>
        : undefined,
      requireAck: typeof parsed.requireAck === 'boolean' ? parsed.requireAck : undefined,
      broadcastToAll: typeof parsed.broadcastToAll === 'boolean' ? parsed.broadcastToAll : undefined,
      targetTerritories: Array.isArray(parsed.targetTerritories) 
        ? parsed.targetTerritories.filter(t => typeof t === 'string')
        : undefined,
      broadcast: typeof parsed.broadcast === 'boolean' ? parsed.broadcast : true
    };
  }

  private parseSearchBody(body: unknown): SearchRequestBody {
    if (!body || typeof body !== 'object') {
      throw new ValidationError('Request body must be an object', {});
    }

    const parsed = body as Record<string, unknown>;

    return {
      query: typeof parsed.query === 'string' ? parsed.query : '',
      territories: Array.isArray(parsed.territories) 
        ? parsed.territories.filter(t => typeof t === 'string')
        : undefined,
      limit: typeof parsed.limit === 'number' ? parsed.limit : 20
    };
  }

  private validateRecordCreate(body: RecordCreateBody): void {
    const errors: Record<string, string> = {};

    if (!body.title || body.title.trim().length === 0) {
      errors.title = 'Title is required';
    } else if (body.title.length > 500) {
      errors.title = 'Title must not exceed 500 characters';
    }

    if (!body.territory || body.territory.trim().length === 0) {
      errors.territory = 'Territory is required';
    }

    if (!body.type || !['changelog', 'conversation'].includes(body.type)) {
      errors.type = 'Type must be "changelog" or "conversation"';
    }

    if (body.content && body.content.length > 50000) {
      errors.content = 'Content must not exceed 50,000 characters';
    }

    if (Object.keys(errors).length > 0) {
      throw new ValidationError('Invalid record data', errors);
    }
  }

  private parseMetricsParam(metrics?: string): Array<'records' | 'activity' | 'capabilities' | 'performance'> {
    if (!metrics) {
      return ['records', 'activity'];
    }

    const requested = metrics.split(',').map(m => m.trim());
    const valid = requested.filter(m => 
      ['records', 'activity', 'capabilities', 'performance'].includes(m)
    ) as Array<'records' | 'activity' | 'capabilities' | 'performance'>;

    return valid.length > 0 ? valid : ['records', 'activity'];
  }

  private formatActForResponse(act: CarnivalAct): FormattedAct {
    return {
      id: act.id,
      title: act.title,
      territory: act.territory,
      type: act.actType,
      content: act.content,
      metadata: act.metadata,
      createdAt: act.createdAt,
      updatedAt: act.updatedAt,
      status: act.status
    };
  }

  private formatUptime(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) {
      return `${days}d ${hours % 24}h`;
    } else if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }

  private handleAPIError(error: unknown): Error {
    if (error instanceof ValidationError || 
        error instanceof NotFoundError ||
        error instanceof InternalServerError) {
      return error;
    }

    if (error instanceof Error) {
      return new InternalServerError('API request failed', error);
    }

    return new InternalServerError('Unknown API error', error);
  }
}

// Type definitions for request/response
interface RecordCreateBody {
  title: string;
  territory: string;
  type: string;
  content?: string;
  metadata?: Record<string, unknown>;
  requireAck?: boolean;
  broadcastToAll?: boolean;
  targetTerritories?: string[];
  broadcast?: boolean;
}

interface FormattedAct {
  id: string;
  title: string;
  territory: string;
  type: string;
  content: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt?: string;
  status: string;
}

interface RecordQueryResponse {
  status: 'success' | 'error';
  data: FormattedAct[];
  pagination: {
    limit: number;
    offset: number;
    total: number;
    hasNext: boolean;
    hasPrevious: boolean;
  };
  timestamp: string;
}

interface RecordCreateResponse {
  status: 'success' | 'error';
  data: {
    id: string;
    title: string;
    territory: string;
    createdAt: string;
  };
  message: string;
  timestamp: string;
}

interface RecordGetResponse {
  status: 'success' | 'error';
  data: FormattedAct;
  timestamp: string;
}

interface SearchResponse {
  status: 'success' | 'error';
  data: {
    query: string;
    results: Array<{
      id: string;
      title: string;
      type: string;
      territory: string;
      content: string;
      matchedFields: string[];
      relevance?: number;
    }>;
    resultCount: number;
    hasMore: boolean;
  };
  timestamp: string;
}

interface NetworkStatusResponse {
  status: 'success' | 'error';
  data: {
    health: string;
    uptime: {
      milliseconds: number;
      formatted: string;
    };
    network: {
      totalPerformers: number;
      connectedPerformers: number;
      territories: number;
      activeRegistries: number;
    };
    capabilities: string[];
  };
  timestamp: string;
}

interface TerritoriesResponse {
  status: 'success' | 'error';
  data: {
    territories: Array<{
      name: string;
      performerCount: number;
      status: 'active' | 'inactive';
    }>;
    total: number;
    active: number;
  };
  timestamp: string;
}

interface AnalyticsResponse {
  status: 'success' | 'error';
  data: {
    timeframe: string;
    records?: unknown;
    activity?: unknown;
    capabilities?: unknown;
    performance?: unknown;
  };
  timestamp: string;
}
```

#### 2. Route Registration
**File**: `src/network/api-router.ts` (New)

```typescript
import type { App } from 'obsidian';
import { ExternalAPIService } from './external-api-service';
import { Log } from '../utils/logger';
import type {
  ActService,
  CarnivalQueryService,
  LocalRestAPIPublic,
  LogContext
} from '../types/public';

const routerLogger: LogContext = {
  context: 'API Router',
  path: '/.obsidian/plugins/carnival-network/network/api-router'
};

/**
 * 🎪 API Router - Registers external API routes with Local REST API plugin
 */
export class APIRouter {
  private apiService: ExternalAPIService;
  private localRestAPI?: LocalRestAPIPublic;

  constructor(
    private app: App,
    actService: ActService,
    queryService: CarnivalQueryService
  ) {
    this.apiService = new ExternalAPIService(actService, queryService);
  }

  /**
   * Register all API routes with Local REST API plugin
   */
  registerRoutes(localRestAPI: LocalRestAPIPublic): void {
    this.localRestAPI = localRestAPI;

    try {
      // Records endpoints
      this.registerRecordsRoutes();
      
      // Search endpoint
      this.registerSearchRoutes();
      
      // Network endpoints
      this.registerNetworkRoutes();

      Log.log(routerLogger, '🎪 API routes registered successfully');
    } catch (error) {
      Log.error(routerLogger, 'Failed to register API routes:', error);
      throw error;
    }
  }

  /**
   * Unregister all API routes
   */
  unregisterRoutes(): void {
    if (this.localRestAPI) {
      this.localRestAPI.unregister();
      Log.log(routerLogger, '🎪 API routes unregistered');
    }
  }

  /**
   * Register records CRUD routes
   */
  private registerRecordsRoutes(): void {
    if (!this.localRestAPI) return;

    // GET /api/records - Query records
    this.localRestAPI.addRoute('/api/records').get(async (req, res) => {
      try {
        const result = await this.apiService.handleRecordsQuery(req as any);
        res.status(200).json(result);
      } catch (error) {
        this.handleRouteError(res, error);
      }
    });

    // POST /api/records - Create record
    this.localRestAPI.addRoute('/api/records').post(async (req, res) => {
      try {
        const result = await this.apiService.handleRecordCreate(req as any);
        res.status(201).json(result);
      } catch (error) {
        this.handleRouteError(res, error);
      }
    });

    // GET /api/records/:id - Get specific record
    this.localRestAPI.addRoute('/api/records/:id').get(async (req, res) => {
      try {
        const result = await this.apiService.handleRecordGet(req as any);
        res.status(200).json(result);
      } catch (error) {
        this.handleRouteError(res, error);
      }
    });

    Log.log(routerLogger, '📋 Records routes registered');
  }

  /**
   * Register search routes
   */
  private registerSearchRoutes(): void {
    if (!this.localRestAPI) return;

    // POST /api/search - Search records
    this.localRestAPI.addRoute('/api/search').post(async (req, res) => {
      try {
        const result = await this.apiService.handleSearch(req as any);
        res.status(200).json(result);
      } catch (error) {
        this.handleRouteError(res, error);
      }
    });

    Log.log(routerLogger, '🔍 Search routes registered');
  }

  /**
   * Register network status routes
   */
  private registerNetworkRoutes(): void {
    if (!this.localRestAPI) return;

    // GET /api/network/status - Network status
    this.localRestAPI.addRoute('/api/network/status').get(async (req, res) => {
      try {
        const result = await this.apiService.handleNetworkStatus();
        res.status(200).json(result);
      } catch (error) {
        this.handleRouteError(res, error);
      }
    });

    // GET /api/territories - Territories list
    this.localRestAPI.addRoute('/api/territories').get(async (req, res) => {
      try {
        const result = await this.apiService.handleTerritoriesList();
        res.status(200).json(result);
      } catch (error) {
        this.handleRouteError(res, error);
      }
    });

    // GET /api/analytics - Network analytics
    this.localRestAPI.addRoute('/api/analytics').get(async (req, res) => {
      try {
        const result = await this.apiService.handleAnalytics(req as any);
        res.status(200).json(result);
      } catch (error) {
        this.handleRouteError(res, error);
      }
    });

    Log.log(routerLogger, '🌐 Network routes registered');
  }

  /**
   * Handle route errors with proper status codes
   */
  private handleRouteError(res: any, error: unknown): void {
    const apiError = error as any;
    
    const statusCode = apiError.statusCode || 500;
    const response = {
      status: 'error',
      error: apiError.code || 'UNKNOWN_ERROR',
      message: apiError.message || 'An error occurred',
      details: apiError.details,
      timestamp: new Date().toISOString()
    };

    res.status(statusCode).json(response);
    Log.error(routerLogger, `Route error (${statusCode}):`, error);
  }
}
```

#### 3. Integration with Main Plugin
**File**: `src/main.ts` (Modified)

```typescript
// Add to imports
import { APIRouter } from './network/api-router';

// Add to class properties
private apiRouter?: APIRouter;

// In onload(), after carnival network initialization:
async onload(): Promise<void> {
  // ... existing code ...

  // Initialize API router if Local REST API available
  this.app.workspace.onLayoutReady(async () => {
    await this.initializeAPIRouter();
  });
}

private async initializeAPIRouter(): Promise<void> {
  const localRestAPI = getPlugin(this.app, 'obsidian-local-rest-api');
  
  if (!localRestAPI) {
    Log.warn(mainLogger, 'Local REST API plugin not found - API routes not registered');
    return;
  }

  try {
    // Get public API from Local REST API plugin
    const restAPI = localRestAPI.getPublicApi?.(this.manifest);
    
    if (!restAPI) {
      Log.warn(mainLogger, 'Could not get Local REST API public API');
      return;
    }

    // Create and register router
    // Note: You'll need to get actService and queryService from active troupes
    // For now, we'll create them here (you may want to refactor this)
    
    const actService = this.getActService();
    const queryService = this.getQueryService();
    
    if (!actService || !queryService) {
      Log.warn(mainLogger, 'Services not available for API router');
      return;
    }

    this.apiRouter = new APIRouter(this.app, actService, queryService);
    this.apiRouter.registerRoutes(restAPI);
    
    Log.log(mainLogger, '🎪 API router initialized successfully');
  } catch (error) {
    Log.error(mainLogger, 'Failed to initialize API router:', error);
  }
}

// Helper methods to get services (you may need to adjust based on your architecture)
private getActService(): ActService | undefined {
  // Get from first active troupe or create a shared instance
  const firstTroupe = this.activeTroupes.values().next().value;
  return firstTroupe?.getActService();
}

private getQueryService(): CarnivalQueryService | undefined {
  // Get from first active troupe or create a shared instance
  const firstTroupe = this.activeTroupes.values().next().value;
  return firstTroupe?.getQueryService();
}

// In onunload():
async onunload(): Promise<void> {
  // Unregister API routes
  if (this.apiRouter) {
    this.apiRouter.unregisterRoutes();
  }

  // ... existing cleanup code ...
}
```

---

### Testing Phase 3.3.1

Create a simple test script to verify endpoints:

**File**: `.github/docs/api-testing-phase-3-3-1.md`

```markdown
# API Testing Guide - Phase 3.3.1

## Prerequisites
- Obsidian running with Carnival Network plugin
- Local REST API plugin installed and enabled
- Default port: 27123

## Test Endpoints

### 1. Records Query
```bash
# Get all records
curl http://localhost:27123/api/records

# Query with filters
curl "http://localhost:27123/api/records?territory=backstage&limit=5&offset=0"

# Query by type
curl "http://localhost:27123/api/records?type=changelog&limit=10"
```

### 2. Record Creation
```bash
curl -X POST http://localhost:27123/api/records \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Test Record",
    "territory": "backstage",
    "type": "changelog",
    "content": "This is a test record from the API"
  }'
```

### 3. Record Get by ID
```bash
# Replace {id} with actual record ID
curl http://localhost:27123/api/records/{id}
```

### 4. Search
```bash
curl -X POST http://localhost:27123/api/search \
  -H "Content-Type: application/json" \
  -d '{
    "query": "test",
    "territories": ["backstage"],
    "limit": 10
  }'
```

### 5. Network Status
```bash
curl http://localhost:27123/api/network/status
```

### 6. Territories List
```bash
curl http://localhost:27123/api/territories
```

### 7. Analytics
```bash
curl "http://localhost:27123/api/analytics?metrics=records,activity,capabilities"
```

## Expected Responses

All responses should have this structure:
```json
{
  "status": "success",
  "data": { ... },
  "timestamp": "2025-11-15T..."
}
```

Errors should have:
```json
{
  "status": "error",
  "error": "ERROR_CODE",
  "message": "Human readable message",
  "details": { ... },
  "timestamp": "2025-11-15T..."
}
```

## Validation Checklist

- [ ] All endpoints respond with correct status codes
- [ ] Pagination works correctly
- [ ] Validation errors return 400 status
- [ ] Not found errors return 404 status
- [ ] Server errors return 500 status
- [ ] Response format is consistent
- [ ] Timestamps are ISO 8601 format
- [ ] Search returns relevant results
- [ ] Analytics returns network data
```

---

### Phase 3.3.1 Completion Checklist

Before committing:
- [ ] `ExternalAPIService` created and implements all core endpoints
- [ ] `APIRouter` created and registers routes
- [ ] `main.ts` integrated with API router
- [ ] All TypeScript compiles without errors
- [ ] ESLint passes without errors
- [ ] API testing guide created
- [ ] Manual testing completed for at least 3 endpoints

---

## What's Next?

After Phase 3.3.1 is complete and committed, I'll provide:

1. **CHANGELOG.md update** with Phase 3.3.1 details
2. **NETWORK-ROADMAP.md update** showing progress
3. **Commit message** following your project style
4. **Session summary** documenting what was accomplished

Then we'll move to **Phase 3.3.2: Authentication & Authorization**.

---

**Ready to start implementing Phase 3.3.1?** I can generate the complete files for you, or we can work through them step by step. Let me know your preference!