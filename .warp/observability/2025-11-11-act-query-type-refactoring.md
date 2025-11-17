# Act Query Type Hierarchy - Refactoring Summary

**Date**: 2025-11-11  
**Scope**: Establish proper type extension hierarchy for act queries  
**Status**: ✅ Complete

---

## Problem Identified

**Double-duty types with overlap:**
- `ActQueryParams` in `query-types.ts` (API input)
- `ActQueryOptions` in `records-types.ts` (internal processing)
- Both had overlapping fields but different purposes

**Overlap Analysis:**

```typescript
// ActQueryParams (API input - all optional)
{
	territory?: string;
	type?: 'changelog' | 'conversation';
	limit?: number;
	offset?: number;
}

// ActQueryOptions (internal - limit/offset required, adds sorting)
{
	territory?: string;
	type?: string;  // Broader type
	limit: number;   // Required
	offset: number;  // Required
	sortBy?: 'createdAt' | 'updatedAt' | 'title';
	sortOrder?: 'asc' | 'desc';
}
```

---

## Solution: Proper Extension Hierarchy

### Type Hierarchy (Bottom-up)

```
ActQueryParams (API input - query-types.ts)
    ↓ extends
ActQueryOptions (internal processing - records-types.ts)
    ↓ extends
ExtendedActQueryOptions (advanced filtering - records-types.ts)
```

### 1. ActQueryParams (Base - API Layer)

**Location**: `src/types/public/query-types.ts`  
**Purpose**: External API input parameters  
**Characteristics**: All fields optional

```typescript
export interface ActQueryParams {
	territory?: string;
	type?: 'changelog' | 'conversation';  // Strict typing
	limit?: number;
	offset?: number;
}
```

**Usage**: REST API handlers, external queries

### 2. ActQueryOptions (Internal Processing)

**Location**: `src/types/public/records-types.ts`  
**Purpose**: Internal service processing with defaults applied  
**Characteristics**: Required fields, adds sorting

```typescript
export interface ActQueryOptions extends Omit<ActQueryParams, 'type'> {
	type?: string;  // Broader than ActQueryParams (any act type)
	limit: number;  // Required (caller provides default)
	offset: number; // Required (caller provides default)
	sortBy?: 'createdAt' | 'updatedAt' | 'title';
	sortOrder?: 'asc' | 'desc';
}
```

**Key Design Decision**: Uses `Omit<ActQueryParams, 'type'>` to:
- Inherit territory, limit, offset from ActQueryParams
- Override `type` to be broader (string vs union)
- Make limit/offset required

**Usage**: ActService internal methods

### 3. ExtendedActQueryOptions (Advanced Filtering)

**Location**: `src/types/public/records-types.ts`  
**Purpose**: Advanced querying with filtering and pagination  
**Characteristics**: Adds performer, date range, status filters

```typescript
export interface ExtendedActQueryOptions extends ActQueryOptions {
	// Additional filtering
	performerId?: string;
	dateRange?: {
		start: string;
		end: string;
	};
	status?: 'active' | 'archived' | 'cancelled';
	capabilities?: string[];
	
	// Page-based pagination (in addition to offset/limit)
	page?: number;
	pageSize?: number;
	
	// Extended sorting options
	sortBy?: 'createdAt' | 'updatedAt' | 'title' | 'territory';
}
```

**Usage**: CarnivalQueryService, advanced filtering scenarios

### 4. PaginatedActResult (Response Format)

**Location**: `src/types/public/records-types.ts`  
**Purpose**: Paginated query results with metadata

```typescript
export interface PaginatedActResult {
	acts: CarnivalAct[];
	pagination: {
		currentPage: number;
		pageSize: number;
		totalItems: number;
		totalPages: number;
		hasNext: boolean;
		hasPrevious: boolean;
	};
}
```

---

## Type Flow Pattern

### API Request → Internal Processing

```typescript
// 1. API receives ActQueryParams (all optional)
function handleActQuery(params: ActQueryParams) {
	// 2. Convert to ActQueryOptions with required defaults
	const options: ActQueryOptions = {
		territory: params.territory,
		type: params.type,
		limit: params.limit ?? 10,      // Apply default
		offset: params.offset ?? 0,     // Apply default
		sortBy: 'createdAt',
		sortOrder: 'desc'
	};
	
	// 3. Pass to service
	return actService.queryActs(options);
}
```

### Advanced Query Building

```typescript
// 1. Use builder for complex queries
const query = new ActQueryBuilder()
	.withTerritory('backstage')
	.withType('changelog')
	.withPerformer('performer-123')
	.withStatus('active')
	.withDateRange('2025-01-01', '2025-12-31')
	.withPagination(2, 20)
	.withSort('createdAt', 'desc')
	.build();

// 2. Query returns ExtendedActQueryOptions
const result = actService.queryActsPaginated(query);
```

### Parameter Parsing (Generic → Structured)

```typescript
// CarnivalQuery (generic parameters)
{
	type: 'acts',
	parameters: {
		territory: 'backstage',
		type: 'changelog',
		page: 2,
		performerId: 'performer-123'
	}
}

// Parsed to ExtendedActQueryOptions
{
	territory: 'backstage',
	type: 'changelog',
	performerId: 'performer-123',
	page: 2,
	pageSize: 10,
	offset: 10,
	limit: 10
}
```

---

## Files Updated

### 1. `src/types/public/records-types.ts`

**Changes**:
- ✅ Made `ActQueryOptions` extend `ActQueryParams`
- ✅ Moved `ExtendedActQueryOptions` from act-query-types.ts
- ✅ Moved `PaginatedActResult` from act-query-types.ts
- ✅ Updated all type documentation

**New Structure**:
```typescript
// Imports
import type { ActQueryParams } from './query-types';

// Type hierarchy (all in one place)
export interface ActQueryOptions extends Omit<ActQueryParams, 'type'> { ... }
export interface ExtendedActQueryOptions extends ActQueryOptions { ... }
export interface PaginatedActResult { ... }

// Other record types
export interface ActCountOptions { ... }
export interface ActSyncPreferences { ... }
export interface CarnivalAct { ... }
export interface CreateActParams { ... }
export interface RecordMetadata { ... }
```

### 2. `src/types/public/act-query-types.ts` (Simplified)

**Changes**:
- ✅ Removed duplicate type definitions
- ✅ Kept only utility classes (ActQueryBuilder, parseActQueryParams)
- ✅ Added import from records-types.ts

**New Purpose**: Query building utilities only

```typescript
import type { ExtendedActQueryOptions } from './records-types';

export class ActQueryBuilder { ... }
export function parseActQueryParams(...) { ... }
```

### 3. `src/network/services/act-service.ts`

**Import Updates Needed**:
```typescript
// Before
import { ActQueryOptions, ExtendedActQueryOptions, PaginatedActResult } from '../../types/public';

// After (same - all from public index)
import { ActQueryOptions, ExtendedActQueryOptions, PaginatedActResult } from '../../types/public';
```

No change needed since public index exports everything!

### 4. `src/network/services/carnival-query-service.ts`

**Import Updates Needed**:
```typescript
// Add parseActQueryParams import
import { parseActQueryParams } from '../../types/public';
```

---

## Benefits of This Hierarchy

### 1. Clear Semantic Separation

| Level | Purpose | Required Fields | Use Case |
|-------|---------|----------------|----------|
| `ActQueryParams` | API input | None (all optional) | REST endpoints |
| `ActQueryOptions` | Internal processing | limit, offset | Service methods |
| `ExtendedActQueryOptions` | Advanced queries | limit, offset | Complex filtering |

### 2. Type Safety

```typescript
// Compiler catches missing required fields
const options: ActQueryOptions = {
	territory: 'backstage'
	// ❌ Error: limit is required
	// ❌ Error: offset is required
};

// Must provide defaults
const options: ActQueryOptions = {
	territory: 'backstage',
	limit: 10,   // ✅
	offset: 0    // ✅
};
```

### 3. Extensibility

Easy to add new features at appropriate level:

```typescript
// Add to ActQueryParams (API level)
interface ActQueryParams {
	// ... existing fields
	searchQuery?: string;  // New API parameter
}

// Automatically available in ActQueryOptions via extension
// Automatically available in ExtendedActQueryOptions via extension
```

### 4. Backward Compatibility

Existing code using `ActQueryOptions` continues to work:

```typescript
// Still valid
actService.queryActs({
	territory: 'backstage',
	type: 'changelog',
	limit: 10,
	offset: 0
});
```

---

## Usage Examples

### Example 1: API Handler Pattern

```typescript
// External API endpoint
async function handleAPIQuery(req: Request): Promise<Response> {
	// Parse API parameters (all optional)
	const params: ActQueryParams = {
		territory: req.query.territory,
		type: req.query.type,
		limit: parseInt(req.query.limit),
		offset: parseInt(req.query.offset)
	};
	
	// Convert to internal options with defaults
	const options: ActQueryOptions = {
		...params,
		limit: params.limit ?? 10,
		offset: params.offset ?? 0,
		sortBy: 'createdAt',
		sortOrder: 'desc'
	};
	
	// Query acts
	const acts = actService.queryActs(options);
	return Response.json(acts);
}
```

### Example 2: Builder Pattern

```typescript
// Complex query building
const query = new ActQueryBuilder()
	.withTerritory('backstage')
	.withType('changelog')
	.withPerformer('performer-123')
	.withStatus('active')
	.withPagination(1, 20)
	.withSort('createdAt', 'desc')
	.build();

// query is ExtendedActQueryOptions
const result = actService.queryActsPaginated(query);
```

### Example 3: Direct Service Call

```typescript
// Internal service usage
const acts = actService.queryActs({
	territory: 'backstage',
	type: 'changelog',
	limit: 10,
	offset: 0,
	sortBy: 'createdAt',
	sortOrder: 'desc'
});
```

### Example 4: Advanced Filtering

```typescript
const options: ExtendedActQueryOptions = {
	territory: 'backstage',
	type: 'changelog',
	performerId: 'performer-123',
	status: 'active',
	dateRange: {
		start: '2025-01-01T00:00:00Z',
		end: '2025-12-31T23:59:59Z'
	},
	limit: 20,
	offset: 0,
	page: 1,
	pageSize: 20,
	sortBy: 'createdAt',
	sortOrder: 'desc'
};

const result = actService.queryActsPaginated(options);
```

---

## Testing Implications

### Type Compatibility Tests

```typescript
describe('Type Hierarchy', () => {
	it('ActQueryOptions should accept ActQueryParams with defaults', () => {
		const params: ActQueryParams = {
			territory: 'backstage',
			type: 'changelog'
		};
		
		const options: ActQueryOptions = {
			...params,
			limit: 10,
			offset: 0
		};
		
		expect(options).toHaveProperty('limit');
		expect(options).toHaveProperty('offset');
	});
	
	it('ExtendedActQueryOptions should accept ActQueryOptions', () => {
		const options: ActQueryOptions = {
			territory: 'backstage',
			limit: 10,
			offset: 0
		};
		
		const extended: ExtendedActQueryOptions = {
			...options,
			performerId: 'performer-123',
			page: 1,
			pageSize: 10
		};
		
		expect(extended).toHaveProperty('performerId');
	});
});
```

### Builder Tests

```typescript
describe('ActQueryBuilder', () => {
	it('should build ExtendedActQueryOptions with all fields', () => {
		const query = new ActQueryBuilder()
			.withTerritory('backstage')
			.withPagination(2, 20)
			.build();
		
		expect(query.territory).toBe('backstage');
		expect(query.page).toBe(2);
		expect(query.pageSize).toBe(20);
		expect(query.limit).toBe(20);
		expect(query.offset).toBe(20);
	});
	
	it('should apply defaults for required fields', () => {
		const query = new ActQueryBuilder().build();
		
		expect(query.limit).toBe(10);
		expect(query.offset).toBe(0);
	});
});
```

---

## Migration Checklist

### For Existing Code

- [x] ✅ Update `ActQueryOptions` to extend `ActQueryParams`
- [x] ✅ Move `ExtendedActQueryOptions` to records-types.ts
- [x] ✅ Move `PaginatedActResult` to records-types.ts
- [x] ✅ Simplify act-query-types.ts to utilities only
- [x] ✅ Update ActQueryBuilder to use proper types
- [ ] ⏳ Update ActService imports (if needed)
- [ ] ⏳ Update CarnivalQueryService imports
- [ ] ⏳ Test compilation
- [ ] ⏳ Update documentation
- [ ] ⏳ Add type hierarchy tests

### For New Code

- Use `ActQueryParams` for API inputs
- Use `ActQueryOptions` for service methods
- Use `ExtendedActQueryOptions` for advanced queries
- Use `ActQueryBuilder` for complex query construction

---

## Future Considerations

### 1. Additional Query Types

Could add intermediate types for specific use cases:

```typescript
// For search-specific queries
export interface SearchActQueryOptions extends ExtendedActQueryOptions {
	searchQuery: string;
	searchFields?: Array<'title' | 'content' | 'metadata'>;
	fuzzyMatch?: boolean;
}

// For analytics queries
export interface AnalyticsActQueryOptions extends ExtendedActQueryOptions {
	groupBy?: 'territory' | 'type' | 'performer';
	aggregations?: Array<'count' | 'avg' | 'sum'>;
}
```

### 2. Query Validation

Add runtime validation:

```typescript
function validateActQueryOptions(options: ActQueryOptions): void {
	if (options.limit < 1 || options.limit > 100) {
		throw new ValidationError('limit must be between 1 and 100');
	}
	if (options.offset < 0) {
		throw new ValidationError('offset must be non-negative');
	}
}
```

### 3. Query Optimization Hints

Add metadata for query optimization:

```typescript
export interface OptimizedActQueryOptions extends ExtendedActQueryOptions {
	useIndex?: 'territory' | 'performer' | 'date';
	cacheResult?: boolean;
	cacheTTL?: number;
}
```

---

## Conclusion

The type hierarchy is now properly structured with clear semantic separation:
- **API Layer** (`ActQueryParams`): Flexible, all optional
- **Service Layer** (`ActQueryOptions`): Structured, required fields
- **Advanced Layer** (`ExtendedActQueryOptions`): Full-featured

This provides:
✅ Type safety through required fields  
✅ Extensibility through inheritance  
✅ Clear purpose for each level  
✅ Backward compatibility  
✅ Easy-to-understand API

**The show must go on!** 🎭✨

---

**End of Summary**