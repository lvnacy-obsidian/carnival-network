/**
 * ============================================================================
 * BUFFER TYPES INTERNAL
 * ============================================================================
 * 
 * Index of exports:
 * - BufferedMetric
 */

import { MetricDataPoint } from '../public';

/**
 * Internal: Metric entry with metadata
 * This is an implementation detail and not exposed publicly
 */
export interface BufferedMetric {
	metric: MetricDataPoint;
	addedAt: number;
	flushAttempts: number;
}