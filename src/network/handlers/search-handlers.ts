// handlers/search-handlers.ts
import {
	InternalServerError,
	ValidationError
} from '../../errors';
import { Log } from '../../utils/logger';
import type { RecordService } from '../services/record-service';
import type { NetworkQueryService } from '../services/network-query-service';
import type {
	AnalyticsQueryParams,
	AnalyticsResponse,
	ApiRequest,
	ExternalClient,
	SearchRequestBody,
	SearchResponse
} from '../../types';

const searchLogger = {
	context: 'Search Handlers',
	path: '/.obsidian/plugins/carnival-records/network/handlers/search'
};

export class SearchHandlers {
	constructor(
		private readonly recordService: RecordService,
		private readonly networkService: NetworkQueryService
	) {}

	/**
	 * Handle carnival search requests
	 * POST /api/carnival/search
	 */
	async handleSearch(
		request: ApiRequest,
		_client: ExternalClient
	): Promise<SearchResponse> {

		const body = this.parseSearchBody(request.body);
		
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

		const limit: number = body.limit as number;

		try {
			const searchResults = await this.recordService.performSearch({
				query: body.query.trim(),
				territories: body.territories ?? [],
				types: body.types ?? [],
				limit: Math.min(limit, 50)
			});

			return {
				results: searchResults,
				query: body.query.trim(),
				resultCount: searchResults.length,
				hasMore: searchResults.length === Math.min(limit, 50)
			};
		} catch (error) {
			Log.error(searchLogger, 'Search failed:', error);
			throw new InternalServerError('Search failed', error);
		}
	}

	/**
	 * Handle carnival analytics requests
	 * GET /api/carnival/analytics
	 */
	async handleAnalytics(
		request: ApiRequest,
		_client: ExternalClient
	): Promise<AnalyticsResponse> {
		const params = request.query as AnalyticsQueryParams;
		const timeframe = String(params.timeframe ?? '7d');
		const metrics = this.parseMetricsArray(params.metrics);
		
		try {
			const analytics = {
				timeframe,
				data: await Promise.resolve(this.networkService.generateAnalytics(metrics)),
				generated: new Date().toISOString()
			};

			return analytics;
		} catch (error) {
			Log.error(searchLogger, 'Analytics generation failed:', error);
			throw new InternalServerError('Analytics generation failed', error);
		}
	}

	private parseSearchBody(body: unknown): SearchRequestBody {
		if (!body || typeof body !== 'object') {
			throw new ValidationError('Request body must be an object', {});
		}

		const parsed = body as Record<string, unknown>;

		const searchQuery = typeof parsed.query === 'string' ? parsed.query : '';
		const searchTerritories = Array.isArray(parsed.territories) 
			? parsed.territories.filter(t => typeof t === 'string')
			: [];
		const searchTypes = Array.isArray(parsed.types) 
			? parsed.types.filter(t => t === 'changelog' || t === 'conversation')
			: [];

		let searchBody;
		if (typeof parsed.limit === 'number') {
			searchBody = {
				query: searchQuery,
				territories: searchTerritories,
				types: searchTypes,
				limit: parsed.limit
			};
		} else {
			searchBody = {
				query: searchQuery,
				territories: searchTerritories,
				types: searchTypes
			};
		}

		return searchBody;
	}

	private parseMetricsArray(metrics: unknown): Array<'records' | 'activity' | 'capabilities' | 'performance'> {
		const defaultMetrics: Array<'records' | 'activity' | 'capabilities' | 'performance'> = ['records', 'activity'];
		
		if (typeof metrics === 'string') {
			const metric = metrics;
			if (['records', 'activity', 'capabilities', 'performance'].includes(metric)) {
				return [metric as 'records' | 'activity' | 'capabilities' | 'performance'];
			}
			return defaultMetrics;
		}
		
		if (Array.isArray(metrics)) {
			const validMetrics = metrics.filter(m => 
				typeof m === 'string' && 
				['records', 'activity', 'capabilities', 'performance'].includes(m)
			) as Array<'records' | 'activity' | 'capabilities' | 'performance'>;
			
			return validMetrics.length > 0 ? validMetrics : defaultMetrics;
		}
		
		return defaultMetrics;
	}
}