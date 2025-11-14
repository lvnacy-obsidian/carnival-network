import type {
	BufferStats,
	MetricDataPoint,
    ObservabilityAlert,
    ObservabilityDashboard,
	ProviderMetrics
} from '../../../types/public';

/**
 * Dashboard builder for observability monitoring
 */
export class ObservabilityDashboardBuilder {
	/**
	 * Build complete dashboard from service state
	 */
	static buildDashboard(data: {
		bufferStats: BufferStats;
		providerName?: string;
		providerMetrics?: ProviderMetrics;
		deadLetterQueue?: {
			queueSize: number;
			metricsInQueue: number;
			oldestEntry?: number;
		};
		circuitState?: string;
		isProviderHealthy?: boolean;
		recentMetrics?: MetricDataPoint[];
	}): ObservabilityDashboard {
		const alerts = this.generateAlerts(data);
		const health = this.determineHealth(data, alerts);
		const bufferHealth = this.assessBufferHealth(data.bufferStats);
		
		return {
			health,
			buffer: {
				stats: data.bufferStats,
				healthStatus: bufferHealth.status,
				recommendation: bufferHealth.recommendation
			},
			provider: data.providerName ? {
				name: data.providerName,
				healthy: data.isProviderHealthy ?? false,
				metrics: data.providerMetrics,
				deadLetterQueue: data.deadLetterQueue,
				circuitState: data.circuitState
			} : null,
			recentMetrics: data.recentMetrics || [],
			alerts,
			performance: this.calculatePerformance(data)
		};
	}
	
	/**
	 * Determine overall health status
	 */
	private static determineHealth(
		data: {
			bufferStats: BufferStats;
			providerMetrics?: ProviderMetrics;
			circuitState?: string;
			isProviderHealthy?: boolean;
		},
		alerts: ObservabilityAlert[]
	): ObservabilityDashboard['health'] {
		const criticalAlerts = alerts.filter(a => a.severity === 'critical');
		const errorAlerts = alerts.filter(a => a.severity === 'error');
		
		// Critical: System is not functioning
		if (criticalAlerts.length > 0) {
			return {
				status: 'down',
				message: criticalAlerts[0].message,
				timestamp: new Date().toISOString()
			};
		}
		
		// Degraded: System is functioning but with issues
		if (errorAlerts.length > 0 || data.circuitState === 'OPEN') {
			return {
				status: 'degraded',
				message: errorAlerts[0]?.message || 'Circuit breaker is open',
				timestamp: new Date().toISOString()
			};
		}
		
		// Degraded: Buffer is near capacity
		if (data.bufferStats.utilizationPercent > 90) {
			return {
				status: 'degraded',
				message: `Buffer at ${data.bufferStats.utilizationPercent.toFixed(1)}% capacity`,
				timestamp: new Date().toISOString()
			};
		}
		
		// Healthy: All systems operational
		return {
			status: 'healthy',
			message: 'All observability systems operational',
			timestamp: new Date().toISOString()
		};
	}
	
	/**
	 * Assess buffer health
	 */
	private static assessBufferHealth(stats: BufferStats): {
		status: 'healthy' | 'warning' | 'critical';
		recommendation?: string;
	} {
		const utilization = stats.utilizationPercent;
		const dropRate = stats.totalAdded > 0 
			? (stats.totalDropped / stats.totalAdded) * 100 
			: 0;
		
		// Critical: Buffer is full or high drop rate
		if (utilization > 95 || dropRate > 10) {
			return {
				status: 'critical',
				recommendation: utilization > 95
					? 'Buffer near capacity. Increase maxBufferSize or reduce flushInterval.'
					: 'High metric drop rate. Check provider connectivity and increase buffer size.'
			};
		}
		
		// Warning: Buffer getting full or some drops
		if (utilization > 80 || dropRate > 1) {
			return {
				status: 'warning',
				recommendation: utilization > 80
					? 'Buffer usage high. Monitor capacity and consider increasing size.'
					: 'Some metrics being dropped. Verify provider is responding normally.'
			};
		}
		
		// Healthy
		return {
			status: 'healthy'
		};
	}
	
	/**
	 * Generate alerts based on system state
	 */
	private static generateAlerts(data: {
		bufferStats: BufferStats;
		providerMetrics?: ProviderMetrics;
		deadLetterQueue?: {
			queueSize: number;
			metricsInQueue: number;
			oldestEntry?: number;
		};
		circuitState?: string;
		isProviderHealthy?: boolean;
	}): ObservabilityAlert[] {
		const alerts: ObservabilityAlert[] = [];
		const now = Date.now();
		
		// Buffer capacity alerts
		if (data.bufferStats.utilizationPercent > 95) {
			alerts.push({
				severity: 'critical',
				message: `Buffer at ${data.bufferStats.utilizationPercent.toFixed(1)}% capacity (${data.bufferStats.currentSize}/${data.bufferStats.maxSize})`,
				timestamp: new Date().toISOString(),
				component: 'buffer',
				actionable: 'Increase maxBufferSize or reduce flushInterval'
			});
		} else if (data.bufferStats.utilizationPercent > 80) {
			alerts.push({
				severity: 'warning',
				message: `Buffer usage high: ${data.bufferStats.utilizationPercent.toFixed(1)}%`,
				timestamp: new Date().toISOString(),
				component: 'buffer',
				actionable: 'Monitor buffer capacity'
			});
		}
		
		// Metric drop alerts
		const dropRate = data.bufferStats.totalAdded > 0
			? (data.bufferStats.totalDropped / data.bufferStats.totalAdded) * 100
			: 0;
		
		if (dropRate > 10) {
			alerts.push({
				severity: 'error',
				message: `High metric drop rate: ${dropRate.toFixed(1)}% (${data.bufferStats.totalDropped}/${data.bufferStats.totalAdded})`,
				timestamp: new Date().toISOString(),
				component: 'buffer',
				actionable: 'Check provider connectivity and buffer size'
			});
		} else if (dropRate > 1 && dropRate <= 10) {
			alerts.push({
				severity: 'warning',
				message: `Metrics being dropped: ${dropRate.toFixed(1)}%`,
				timestamp: new Date().toISOString(),
				component: 'buffer'
			});
		}
		
		// Metric age alerts
		if (data.bufferStats.oldestMetricAge && data.bufferStats.oldestMetricAge > 5 * 60 * 1000) {
			alerts.push({
				severity: 'warning',
				message: `Oldest metric is ${Math.floor(data.bufferStats.oldestMetricAge / 60000)} minutes old`,
				timestamp: new Date().toISOString(),
				component: 'buffer',
				actionable: 'Metrics not being flushed. Check provider status.'
			});
		}
		
		// Provider health alerts
		if (data.isProviderHealthy === false) {
			alerts.push({
				severity: 'error',
				message: 'Observability provider is unhealthy',
				timestamp: new Date().toISOString(),
				component: 'provider',
				actionable: 'Check provider configuration and connectivity'
			});
		}
		
		// Circuit breaker alerts
		if (data.circuitState === 'OPEN') {
			alerts.push({
				severity: 'error',
				message: 'Provider circuit breaker is open',
				timestamp: new Date().toISOString(),
				component: 'provider',
				actionable: 'Provider is failing. Will retry after cooldown period.'
			});
		}
		
		// Dead letter queue alerts
		if (data.deadLetterQueue) {
			const { queueSize, metricsInQueue } = data.deadLetterQueue;
			
			if (metricsInQueue > 1000) {
				alerts.push({
					severity: 'error',
					message: `Dead letter queue has ${metricsInQueue} failed metrics`,
					timestamp: new Date().toISOString(),
					component: 'provider',
					actionable: 'Process dead letter queue or investigate provider failures'
				});
			} else if (metricsInQueue > 100) {
				alerts.push({
					severity: 'warning',
					message: `Dead letter queue growing: ${metricsInQueue} metrics`,
					timestamp: new Date().toISOString(),
					component: 'provider'
				});
			}
		}
		
		// Success rate alerts
		if (data.providerMetrics) {
			const { successRate, failed } = data.providerMetrics;
			
			if (successRate < 50 && failed > 10) {
				alerts.push({
					severity: 'critical',
					message: `Provider success rate critically low: ${successRate}%`,
					timestamp: new Date().toISOString(),
					component: 'provider',
					actionable: 'Check provider endpoint and credentials'
				});
			} else if (successRate < 90 && failed > 5) {
				alerts.push({
					severity: 'warning',
					message: `Provider success rate: ${successRate}%`,
					timestamp: new Date().toISOString(),
					component: 'provider'
				});
			}
		}
		
		return alerts.sort((a, b) => {
			// Sort by severity
			const severityOrder = { critical: 0, error: 1, warning: 2, info: 3 };
			return severityOrder[a.severity] - severityOrder[b.severity];
		});
	}
	
	/**
	 * Calculate performance metrics
	 */
	private static calculatePerformance(data: {
		bufferStats: BufferStats;
		providerMetrics?: ProviderMetrics;
	}): ObservabilityDashboard['performance'] {
		// Estimate metrics per second
		const metricsPerSecond = data.bufferStats.totalFlushed > 0
			? data.bufferStats.totalFlushed / (Date.now() / 1000)
			: 0;
		
		// Calculate flush success rate
		const flushSuccessRate = data.providerMetrics?.successRate || 100;
		
		return {
			flushLatency: [], // Would be populated from actual timing data
			flushSuccessRate,
			metricsPerSecond
		};
	}
	
	/**
	 * Format dashboard for console/log output
	 */
	static formatForConsole(dashboard: ObservabilityDashboard): string {
		const lines: string[] = [];
		
		lines.push('═══════════════════════════════════════════════════════');
		lines.push('📊 CARNIVAL NETWORK OBSERVABILITY DASHBOARD');
		lines.push('═══════════════════════════════════════════════════════');
		lines.push('');
		
		// Health status
		const healthEmoji = dashboard.health.status === 'healthy' ? '✅' : 
		                    dashboard.health.status === 'degraded' ? '⚠️' : '❌';
		lines.push(`${healthEmoji} Status: ${dashboard.health.status.toUpperCase()}`);
		lines.push(`   ${dashboard.health.message}`);
		lines.push('');
		
		// Buffer stats
		lines.push('📦 BUFFER');
		lines.push(`   Size: ${dashboard.buffer.stats.currentSize}/${dashboard.buffer.stats.maxSize} (${dashboard.buffer.stats.utilizationPercent.toFixed(1)}%)`);
		lines.push(`   Added: ${dashboard.buffer.stats.totalAdded}`);
		lines.push(`   Flushed: ${dashboard.buffer.stats.totalFlushed}`);
		lines.push(`   Dropped: ${dashboard.buffer.stats.totalDropped}`);
		if (dashboard.buffer.stats.oldestMetricAge) {
			lines.push(`   Oldest: ${Math.floor(dashboard.buffer.stats.oldestMetricAge / 1000)}s ago`);
		}
		if (dashboard.buffer.recommendation) {
			lines.push(`   ⚠️  ${dashboard.buffer.recommendation}`);
		}
		lines.push('');
		
		// Provider stats
		if (dashboard.provider) {
			lines.push('🔌 PROVIDER');
			lines.push(`   Name: ${dashboard.provider.name}`);
			lines.push(`   Healthy: ${dashboard.provider.healthy ? '✅' : '❌'}`);
			if (dashboard.provider.circuitState) {
				lines.push(`   Circuit: ${dashboard.provider.circuitState}`);
			}
			if (dashboard.provider.metrics) {
				const m = dashboard.provider.metrics;
				lines.push(`   Success: ${m.succeeded} (${m.successRate}%)`);
				lines.push(`   Failed: ${m.failed}`);
				if (m.inDeadLetter > 0) {
					lines.push(`   Dead Letter: ${m.inDeadLetter}`);
				}
			}
			lines.push('');
		}
		
		// Alerts
		if (dashboard.alerts.length > 0) {
			lines.push('🚨 ALERTS');
			for (const alert of dashboard.alerts) {
				const emoji = alert.severity === 'critical' ? '🔴' :
				              alert.severity === 'error' ? '🟠' :
				              alert.severity === 'warning' ? '🟡' : '🔵';
				lines.push(`   ${emoji} ${alert.message}`);
				if (alert.actionable) {
					lines.push(`      → ${alert.actionable}`);
				}
			}
			lines.push('');
		}
		
		lines.push('═══════════════════════════════════════════════════════');
		
		return lines.join('\n');
	}
	
	/**
	 * Format dashboard for JSON output
	 */
	static formatForJSON(dashboard: ObservabilityDashboard): string {
		return JSON.stringify(dashboard, null, 2);
	}
}