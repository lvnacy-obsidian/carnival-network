import { BaseObservabilityProvider } from './provider-abstract-base';
import { Log } from '../../../utils/logger';
import type { LogContext, MetricDataPoint, ObservabilityConfig } from '../../../types/public';

const webhookLogger: LogContext = {
	context: 'Observability Provider | Carnival Network | Webhook',
	path: '/.obsidian/plugins/carnival-network/services/observability'
};

function toISO(ts?: number) {
	return new Date(ts ?? Date.now()).toISOString();
}

async function computeHmac(secret: string, payload: string): Promise<string> {
	try {
		const webcrypto = (globalThis as unknown as { crypto?: { subtle?: SubtleCrypto } }).crypto?.subtle;
		if (webcrypto) {
			const enc = new TextEncoder();
			const subtle = webcrypto;
			const key = await subtle.importKey(
				'raw',
				enc.encode(secret),
				{ name: 'HMAC', hash: { name: 'SHA-256' } },
				false,
				['sign']
			);
			const sig = await subtle.sign('HMAC', key, enc.encode(payload));
			const bytes = new Uint8Array(sig);
			return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
		}
		return '';
	} catch {
		return '';
	}
}

export class WebhookProvider extends BaseObservabilityProvider {
	constructor() {
		super('Webhook');
	}

	async initialize(config: ObservabilityConfig): Promise<void> {
		await super.initialize(config);
		if (!config.endpoint) {
			throw new Error('Webhook endpoint (config.endpoint) is required for webhook provider');
		}
	}

	async sendMetrics(metrics: MetricDataPoint[]): Promise<void> {
		this.ensureInitialized();

		const endpoint = this.config?.endpoint ?? '';
		if (!endpoint) {
			throw new Error('Webhook provider: missing endpoint configuration');
		}

		const now = toISO();

		const payload = JSON.stringify({
			type: 'metrics',
			timestamp: now,
			source: 'carnival-network',
			metrics
		});

		// HMAC signing using apiKey or endpoint secret
		const cfgSecret = (this.config as unknown as { webhookSecret?: string })?.webhookSecret;
		const secret = cfgSecret ?? this.config?.apiKey;
		const sig = secret ? await computeHmac(secret, payload) : '';

		// Build headers after signature to avoid mutation after await
		const headers: Record<string, string> = {
			'Content-Type': 'application/json'
		};

		// Allow custom headers
		if (this.config?.customHeaders) {
			Object.assign(headers, this.config.customHeaders);
		}

		// Add API key as bearer if provided
		if (this.config?.apiKey) {
			headers['Authorization'] = `Bearer ${this.config.apiKey}`;
		}

		if (secret && sig) {
			headers['X-Carnival-Signature'] = `sha256=${sig}`;
			headers['X-Carnival-Ts'] = now;
		}

		try {
			const send = async () => {
				const res = await fetch(endpoint, {
					method: 'POST',
					headers,
					body: payload
				});

				if (!res.ok) {
					throw new Error(`Webhook endpoint returned ${res.status}`);
				}
			};

			await this.sendMetricsWithRetry(metrics, send);
		} catch (error) {
			Log.error(webhookLogger, 'Failed to POST metrics to webhook:', error);
			throw error;
		}
	}
}
