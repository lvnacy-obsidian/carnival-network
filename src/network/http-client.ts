
/* Small HTTP client wrapper with timeout, retry, and TLS/mTLS support (where possible) */
/* eslint-disable @typescript-eslint/no-explicit-any */

import type {
	FetchOptions,
	TLSConfig
} from '../types';

/**
 * Create TLS agent with certificate validation and mTLS support
 */
async function createTLSAgent(
	tlsConfig: TLSConfig,
	url: string
): Promise<any> {
	
	// Only available in Node.js environment
	if (typeof process === 'undefined' || !process.versions?.node) {
		return null;
	}

	try {
		// Dynamic imports for Node.js modules
		const https = await import('https');
		const fs = await import('fs');
		const { URL } = await import('url');
		
		const parsedUrl = new URL(url);
		const agentOptions: any = {
		// Certificate validation
			rejectUnauthorized: tlsConfig.validateCert !== false && !tlsConfig.allowSelfSigned,
			// Server name indication
			servername: tlsConfig.serverName ?? parsedUrl.hostname,
		};

		// Custom CA certificate
		if (tlsConfig.caCertPath) {
			agentOptions.ca = fs.readFileSync(tlsConfig.caCertPath);
		} else if (tlsConfig.caCertContent) {
			agentOptions.ca = tlsConfig.caCertContent;
		}

		// Client certificate for mTLS
		if (tlsConfig.clientCertPath) {
			agentOptions.cert = fs.readFileSync(tlsConfig.clientCertPath);
		} else if (tlsConfig.clientCertContent) {
			agentOptions.cert = tlsConfig.clientCertContent;
		}

		// Client private key for mTLS
		if (tlsConfig.clientKeyPath) {
			agentOptions.key = fs.readFileSync(tlsConfig.clientKeyPath);
		} else if (tlsConfig.clientKeyContent) {
			agentOptions.key = tlsConfig.clientKeyContent;
		}

		return new https.Agent(agentOptions);
	} catch (error) {
		throw new Error(`Failed to create TLS agent: ${ error }`);
	}
}

function delay(ms: number) {
	return new Promise(resolve => setTimeout(resolve, ms));
}

export async function fetchWithRetry(
	url: string,
	opts: FetchOptions = {},
	retries = 2,
	backoffBaseMs = 200
): Promise<Response> {

	let attempt = 0;
	const timeout = opts.timeoutMs ?? timeoutMsFromOpts(opts) ?? 5000;

	while (true) {
		try {
			return await fetchWithTimeout(url, opts, timeout);
		} catch (err) {
			attempt++;
			const isAbort = (err as any)?.name === 'AbortError';

			// For abort/timeouts and network errors, retry up to retries
			if (attempt > retries) {
				throw err;
			}

			const backoff = backoffBaseMs * Math.pow(2, attempt - 1);
			await delay(backoff);
		}
	}
}

/**
 * Enhanced fetch with timeout and TLS/mTLS support
 */
export async function fetchWithTimeout(
	url: string,
	opts: FetchOptions = {},
	timeoutMs = 5000
): Promise<Response> {

	const controller = new AbortController();
	const { signal } = controller;
	const id = setTimeout(() => controller.abort(), timeoutMs);

	const fetchOpts: any = { ...(opts || {}), signal };
	
	// Apply TLS configuration for HTTPS requests
	if (opts.tlsConfig && url.startsWith('https://')) {
		try {
			const tlsAgent = await createTLSAgent(opts.tlsConfig, url);
			if (tlsAgent) {
				fetchOpts.agent = tlsAgent;
			}
		} catch (error) {
		// Log TLS setup errors but don't fail the request
			console.warn('TLS agent setup failed, falling back to default:', error);
		}
	}

	try {
		const response = await fetch(url, fetchOpts);
		return response;
	} finally {
		clearTimeout(id);
	}
}

function timeoutMsFromOpts(opts: FetchOptions | undefined): number | undefined {

	if (!opts) {
		return undefined;
	}

	// allow passing timeoutMs in headers or custom field if needed
	return (opts as any).timeoutMs;
}

/**
 * Validate TLS certificate and provide detailed error information
 */
export function validateTLSCertificate(cert: any, hostname: string): { valid: boolean; error?: string } {
	if (!cert) {
		return { valid: false, error: 'No certificate provided' };
	}

	try {
		const now = new Date();
		const validFrom = new Date(cert.valid_from);
		const validTo = new Date(cert.valid_to);

		if (now < validFrom) {
			return { valid: false, error: `Certificate not yet valid (valid from ${validFrom.toISOString()})` };
		}

		if (now > validTo) {
			return { valid: false, error: `Certificate expired (expired ${validTo.toISOString()})` };
		}

		// Check subject alternative names
		if (cert.subjectaltname) {
			const altNames = cert.subjectaltname.split(', ');
			const dnsNames = altNames
				.filter((name: string) => name.startsWith('DNS:'))
				.map((name: string) => name.substring(4));
		
			if (!dnsNames.includes(hostname) && !dnsNames.includes(`*.${hostname.split('.').slice(1).join('.')}`)) {
				return {
					valid: false,
					error: `Certificate hostname mismatch. Expected: ${hostname}, Found: ${dnsNames.join(', ')}`
				};
			}

		}

		return { valid: true };
	} catch (error) {
		return { valid: false, error: `Certificate validation failed: ${ error }` };
	}
}