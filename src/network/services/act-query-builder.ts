import { ExtendedActQueryOptions } from '../../types/public';

/**
 * Act query filter builder
 * Converts CarnivalQuery parameters into ActQueryOptions
 */
export class ActQueryBuilder {
	private options: ExtendedActQueryOptions = {
		limit: 10,
		offset: 0
	};

	withTerritory(territory: string): this {
		this.options.territory = territory;
		return this;
	}

	withType(type: 'changelog' | 'conversation'): this {
		this.options.type = type;
		return this;
	}

	withPerformer(performerId: string): this {
		this.options.performerId = performerId;
		return this;
	}

	withStatus(status: 'active' | 'archived' | 'cancelled'): this {
		this.options.status = status;
		return this;
	}

	withDateRange(start: string, end: string): this {
		this.options.dateRange = { start, end };
		return this;
	}

	withPagination(page: number, pageSize: number): this {
		this.options.page = page;
		this.options.pageSize = pageSize;
		this.options.offset = (page - 1) * pageSize;
		this.options.limit = pageSize;
		return this;
	}

	withSort(sortBy: ExtendedActQueryOptions['sortBy'], order: 'asc' | 'desc' = 'desc'): this {
		this.options.sortBy = sortBy;
		this.options.sortOrder = order;
		return this;
	}

	build(): ExtendedActQueryOptions {
		return { ...this.options };
	}
}

/**
 * Act query parameter parser
 * Converts generic query parameters into structured options
 */
export function parseActQueryParams(params: Record<string, unknown>): ExtendedActQueryOptions {
	const builder = new ActQueryBuilder();

	if (params.territory && typeof params.territory === 'string') {
		builder.withTerritory(params.territory);
	}

	if (params.type && (params.type === 'changelog' || params.type === 'conversation')) {
		builder.withType(params.type);
	}

	if (params.performerId && typeof params.performerId === 'string') {
		builder.withPerformer(params.performerId);
	}

	if (params.status && typeof params.status === 'string') {
		builder.withStatus(params.status as 'active' | 'archived' | 'cancelled');
	}

	if (params.dateRange && typeof params.dateRange === 'object') {
		const range = params.dateRange as { start?: string; end?: string };
		if (range.start && range.end) {
			builder.withDateRange(range.start, range.end);
		}
	}

	// Pagination
	const page = typeof params.page === 'number' ? params.page : 1;
	const pageSize = typeof params.pageSize === 'number' ? params.pageSize : 10;
	builder.withPagination(page, pageSize);

	// Sorting
	if (params.sortBy && typeof params.sortBy === 'string') {
		const sortOrder = params.sortOrder === 'asc' ? 'asc' : 'desc';
		builder.withSort(params.sortBy as ExtendedActQueryOptions['sortBy'], sortOrder);
	}

	return builder.build();
}