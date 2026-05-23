/**
 * Certificate Trust Store Management
 * 
 * Provides centralized certificate management for the HTTP Registry Service,
 * including certificate validation, trust store operations, and certificate
 * lifecycle management.
 */


import { Log } from '../../utils/logger';
import type {
	CertificateInfo,
	TrustedCertificate
} from '../../types/internal';
import type {
	LogContext,
	TLSConfig
} from '../../types/public';

/**
 * Certificate Trust Store
 * 
 * Manages trusted certificates for registry communication
 */
export class CertificateManager {
	private trustedCertificates: Map<string, TrustedCertificate> = new Map();
	private revokedCertificates: Set<string> = new Set();
	private certStoreLogger: LogContext;

	constructor() {
		this.loadDefaultTrustedCAs();
		this.certStoreLogger = {
			context: 'Certificate Manager',
			path: `config_root/plugins/carnival-network/src/network/certificate-manager`
		};
	}

	private loadDefaultTrustedCAs(): void {
		// Load well-known CAs for HTTPS connections
		// These are common root CAs that we trust by default
		const defaultTrustedCAs = this.getWellKnownCAs();
		
		for (const ca of defaultTrustedCAs) {
			try {
				const cert = this.parseCertificate(ca.pemData);
				if (cert) {
					this.trustCertificate(
						cert, 
						ca.validEndpoints, 
						'full', 
						`Default CA: ${ca.name}`
					);
				}
			} catch (error) {
				Log.warn(this.certStoreLogger, `Failed to load default CA ${ca.name}:`, error);
			}
		}
		
		Log.log(this.certStoreLogger, `Certificate store initialized with ${defaultTrustedCAs.length} default CAs`);
	}

	/**
	 * Parse certificate from PEM data
	 */
	parseCertificate(pemData: string): CertificateInfo | null {
		try {
		// In a real implementation, this would use crypto libraries
		// For now, provide a framework for certificate parsing
			const cert = this.parsePEMCertificate(pemData);
			return cert;
		} catch (error) {
			Log.error(this.certStoreLogger, 'Failed to parse certificate:', error);
			return null;
		}
	}

	/**
	 * Add certificate to trust store
	 */
	trustCertificate(
		cert: CertificateInfo, 
		endpoints: string[], 
		trustLevel: 'full' | 'conditional' = 'full',
		notes?: string
	): void {
		const trustedCert: TrustedCertificate = {
			id: cert.fingerprint,
			name: cert.commonName,
			type: 'ca',
			pem: cert.pemData,
			fingerprint: cert.fingerprint,
			validFrom: cert.validFrom.toISOString(),
			validTo: cert.validTo.toISOString(),
			issuer: cert.issuer,
			subject: cert.commonName,
			trusted: trustLevel === 'full',
			trustLevel,
			addedAt: new Date(),
			notes,
			validEndpoints: endpoints
		};

		this.trustedCertificates.set(cert.fingerprint, trustedCert);
		Log.log(this.certStoreLogger, `Added certificate to trust store: ${cert.commonName} (${cert.fingerprint.substring(0, 16)}...)`);
	}

	/**
	 * Remove certificate from trust store
	 */
	revokeCertificate(fingerprint: string, reason?: string): void {
		const cert = this.trustedCertificates.get(fingerprint);
		if (cert) {
			cert.trustLevel = 'revoked';
			cert.trusted = false;
			this.revokedCertificates.add(fingerprint);
			Log.warn(this.certStoreLogger, `Revoked certificate: ${cert.name} - ${reason ?? 'No reason provided'}`);
		}
	}

	/**
	 * Check if certificate is trusted for endpoint
	 */
	isCertificateTrusted(fingerprint: string, endpoint: string): boolean {
		const cert = this.trustedCertificates.get(fingerprint);
		if (!cert) {
			return false;
		}

		if (cert.trustLevel === 'revoked') {
			return false;
		}

		if (this.revokedCertificates.has(fingerprint)) {
			return false;
		}

		// Check if certificate is valid for this endpoint
		return cert.validEndpoints.some(validEndpoint => 
			this.matchesEndpoint(endpoint, validEndpoint)
		);
	}

	/**
	 * Get all trusted certificates
	 */
	getTrustedCertificates(): TrustedCertificate[] {
		return Array.from(this.trustedCertificates.values())
			.filter(cert => cert.trustLevel !== 'revoked');
	}

	/**
	 * Get certificate information
	 */
	getCertificateInfo(fingerprint: string): TrustedCertificate | null {
		return this.trustedCertificates.get(fingerprint) ?? null;
	}

	/**
	 * Validate certificate chain
	 */
	validateCertificateChain(certChain: string[]): {
		valid: boolean;
		errors: string[];
		trustedRoot?: TrustedCertificate;
	} {
		const errors: string[] = [];
		
		if (certChain.length === 0) {
			return { valid: false, errors: ['No certificates in chain'] };
		}

		try {
		// Parse all certificates in chain
			const parsedCerts = certChain.map(pem => this.parseCertificate(pem)).filter(Boolean) as CertificateInfo[];
		
			if (parsedCerts.length !== certChain.length) {
				errors.push('Failed to parse some certificates in chain');
			}

			// Check leaf certificate
			const leafCert = parsedCerts[0];
			if (!leafCert) {
				return { valid: false, errors: ['Failed to parse leaf certificate'] };
			}

			// Validate certificate dates
			const now = new Date();
			if (now < leafCert.validFrom) {
				errors.push(`Certificate not yet valid (valid from ${leafCert.validFrom.toISOString()})`);
			}
			if (now > leafCert.validTo) {
				errors.push(`Certificate expired (expired ${leafCert.validTo.toISOString()})`);
			}

			// Check if we have a trusted root in our store
			let trustedRoot: TrustedCertificate | undefined;
			for (const cert of parsedCerts) {
				const trusted = this.trustedCertificates.get(cert.fingerprint);
				if (trusted?.trustLevel === 'full') {
					trustedRoot = trusted;
					break;
				}
			}

			// If no trusted root, check if leaf is directly trusted
			if (!trustedRoot) {
				const directTrust = this.trustedCertificates.get(leafCert.fingerprint);
				if (directTrust && directTrust.trustLevel !== 'revoked') {
					trustedRoot = directTrust;
				}
			}

			const valid = errors.length === 0 && !!trustedRoot;
			return { valid, errors, trustedRoot };

		} catch (error) {
			return { 
				valid: false, 
				errors: [`Certificate chain validation failed: ${ error }`] 
			};
		}
	}

	/**
	 * Create TLS configuration with trust store
	 */
	createTLSConfig(baseConfig: TLSConfig = {}): TLSConfig {
		const trustedCerts = this.getTrustedCertificates();
		const caBundlePEM = trustedCerts
			.filter(cert => cert.trustLevel === 'full')
			.map(cert => cert.pem)
			.join('\n');

		return {
			enabled: baseConfig.enabled ?? true,
			validateCert: baseConfig.validateCert ?? true,
			allowSelfSigned: baseConfig.allowSelfSigned ?? false,
			caCertContent: caBundlePEM || baseConfig.caCertContent
		};
	}

	/**
	 * Export trust store for backup/transfer
	 */
	exportTrustStore(): string {
		const exportData = {
			version: '1.0',
			exportedAt: new Date().toISOString(),
			trustedCertificates: Array.from(this.trustedCertificates.values()),
			revokedCertificates: Array.from(this.revokedCertificates)
		};

		return JSON.stringify(exportData, null, 2);
	}

	/**
	 * Import trust store from backup
	 */
	importTrustStore(importData: string): { imported: number; errors: string[] } {
		const errors: string[] = [];
		let imported = 0;

		try {
			const data = JSON.parse(importData);
			
			if (data.version !== '1.0') {
				errors.push(`Unsupported version: ${data.version}`);
				return { imported, errors };
			}

			// Import trusted certificates
			if (Array.isArray(data.trustedCertificates)) {
				for (const cert of data.trustedCertificates) {
					try {
						this.trustedCertificates.set(cert.fingerprint, cert);
						imported++;
					} catch (error) {
						errors.push(`Failed to import certificate ${cert.commonName}: ${ error }`);
					}
				}
			}

			// Import revoked certificates
			if (Array.isArray(data.revokedCertificates)) {
				for (const fingerprint of data.revokedCertificates) {
					this.revokedCertificates.add(fingerprint);
				}
			}

			Log.log(this.certStoreLogger, `Imported ${imported} certificates with ${errors.length} errors`);

		} catch (error) {
			errors.push(`Failed to parse import data: ${ error }`);
		}

		return { imported, errors };
	}

	/**
	 * Get certificate health status
	 */
	getCertificateHealth(): {
		total: number;
		expiringSoon: number;
		expired: number;
		revoked: number;
		healthy: number;
	} {
		const now = new Date();
		const thirtyDaysFromNow = new Date(now.getTime() + (30 * 24 * 60 * 60 * 1000));

		let expiringSoon = 0;
		let expired = 0;
		let revoked = 0;
		let healthy = 0;

		for (const cert of this.trustedCertificates.values()) {
			const validTo = new Date(cert.validTo);

			if (cert.trustLevel === 'revoked') {
				revoked++;
			} else if (validTo < now) {
				expired++;
			} else if (validTo < thirtyDaysFromNow) {
				expiringSoon++;
			} else {
				healthy++;
			}
		}

		return {
			total: this.trustedCertificates.size,
			expiringSoon,
			expired,
			revoked,
			healthy
		};
	}

	/**
	 * Get well-known CA certificates for bootstrapping trust
	 */
	private getWellKnownCAs(): Array<{ name: string, pemData: string, validEndpoints: string[] }> {
		return [
			{
				name: 'Let\'s Encrypt Root X1',
				validEndpoints: ['*'],
				pemData: `-----BEGIN CERTIFICATE-----
MIIFazCCA1OgAwIBAgIRAIIQz7DSQONZRGPgu2OCiwAwDQYJKoZIhvcNAQELBQAw
TzELMAkGA1UEBhMCVVMxKTAnBgNVBAoTIEludGVybmV0IFNlY3VyaXR5IFJlc2Vh
cmNoIEdyb3VwMRUwEwYDVQQDEwxJU1JHIFJvb3QgWDEwHhcNMTUwNjA0MTEwNDM4
WhcNMzUwNjA0MTEwNDM4WjBPMQswCQYDVQQGEwJVUzEpMCcGA1UEChMgSW50ZXJu
ZXQgU2VjdXJpdHkgUmVzZWFyY2ggR3JvdXAxFTATBgNVBAMTDElTUkcgUm9vdCBY
MTCCAiIwDQYJKoZIhvcNAQEBBQADggIPADCCAgoCggIBAK3oJHP0FDfzm54rVygc
h77ct984kIxuPOZXoHj3dcKi/vVqbvYATyjb3miGbESTtrFj/RQSa78f0uoxmyF+
0TM8ukj13Xnfs7j/EvEhmkvBioZxaUpmZmyPfjxwv60pIgbz5MDmgK7iS4+3mX6U
A5/TR5d8mUgjU+g4rk8Kb4Mu0UlXjIB0ttov0DiNewNwIRt18jA8+o+u3dpjq+sW
T8KOEUt+zwvo/7V3LvSye0rgTBIlDHCNAymg4VMk7BPZ7hm/ELNKjD+Jo2FR3qyH
B5T0Y3HsLuJvW5iB4YlcNHlsdu87kGJ55tukmi8mxdAQ4Q7e2RCOFvu396j3x+UC
B5iPNgiV5+I3lg02dZ77DnKxHZu8A/lJBdiB3QW0KtZB6awBdpUKD9jf1b0SHzUv
KBds0pjBqAlkd25HN7rOrFleaJ1/ctaJxQZBKT5ZPt0m9STJEadao0xAH0ahmbWn
OlFuhjuefXKnEgV4We0+UXgVCwOPjdAvBbI+e0ocS3MFEvzG6uBQE3xDk3SzynTn
jh8BCNAw1FtxNrQHusEwMFxIt4I7mKZ9YIqioymCzLq9gwQbooMDQaHWBfEbwrbw
qHyGO0aoSCqI3Haadr8faqU9GY/rOPNk3sgrDQoo//fb4hVC1CLQJ13hef4Y53CI
rU7m2Ys6xt0nUW7/vGT1M0NPAgMBAAGjQjBAMA4GA1UdDwEB/wQEAwIBBjAPBgNV
HRMBAf8EBTADAQH/MB0GA1UdDgQWBBR5tFnme7bl5AFzgAiIyBpY9umbbjANBgkq
hkiG9w0BAQsFAAOCAgEAVR9YqbyyqFDQDLHYGmkgJykIrGF1XIpu+ILlaS/V9lZL
ubhzEFnTIZd+50xx+7LSYK05qAvqFyFWhfFQDlnrzuBZ6brJFe+GnY+EgPbk6ZGQ
3BebYhtF8GaV0nxvwuo77x/Py9auJ/GpsMiu/X1+mvoiBOv/2X/qkSsisRcOj/KK
NFtY2PwByVS5uCbMiogziUwthDyC3+6WVwW6LLv3xLfHTjuCvjHIInNzktHCgKQ5
ORAzI4JMPJ+GslWYHb4phowim57iaztXOoJwTdwJx4nLCgdNbOhdjsnvzqvHu7Ur
TkXWStAmzOVyyghqpZXjFaH3pO3JLF+l+/+sKAIuvtd7u+Nxe5AW0wdeRlN8NwdC
jNPElpzVmbUq4JUagEiuTDkHzsxHpFKVK7q4+63SM1N95R1NbdWhscdCb+ZAJzVc
oyi3B43njTOQ5yOf+1CceWxG1bQVs5ZufpsMljq4Ui0/1lvh+wjChP4kqKOJ2qxq
4RgqsahDYVvTH9w7jXbyLeiNdd8XM2w9U/t7y0Ff/9yi0GE44Za4rF2LN9d11TPA
mRGunUHBcnWEvgJBQl9nJEiU0Zsnvgc/ubhPgXRR4Xq37Z0j4r7g1SgEEzwxA57d
emyPxgcYxn/eR44/KJ4EBs+lVDR3veyJm+kXQ99b21/+jh5Xos1AnX5iItreGCc=
-----END CERTIFICATE-----`
			},
			{
				name: 'DigiCert Global Root CA',
				validEndpoints: ['*'],
				pemData: `-----BEGIN CERTIFICATE-----
MIIDrzCCApegAwIBAgIQCDvgVpBCRrGhdWrJWZHHSjANBgkqhkiG9w0BAQUFADBh
MQswCQYDVQQGEwJVUzEVMBMGA1UEChMMRGlnaUNlcnQgSW5jMRkwFwYDVQQLExB3
d3cuZGlnaWNlcnQuY29tMSAwHgYDVQQDExdEaWdpQ2VydCBHbG9iYWwgUm9vdCBD
QTAeFw0wNjExMTAwMDAwMDBaFw0zMTExMTAwMDAwMDBaMGExCzAJBgNVBAYTAlVT
MRUwEwYDVQQKEwxEaWdpQ2VydCBJbmMxGTAXBgNVBAsTEHd3dy5kaWdpY2VydC5j
b20xIDAeBgNVBAMTF0RpZ2lDZXJ0IEdsb2JhbCBSb290IENBMIIBIjANBgkqhkiG
9w0BAQEFAAOCAQ8AMIIBCgKCAQEA4jvhEXLeqKTTo1eqUKKPC3eQyaKl7hLOllsB
CSDMAZOnTjC3U/dDxGkAV53ijSLdhwZAAIEJzs4bg7/fzTtxRuLWZscFs3YnFo97
nh6Vfe63SKMI2tavegw5BmV/Sl0fvBf4q77uKNd0f3p4mVmFaG5cIzJLv07A6Fpt
43C/dxC//AH2hdmoRBBYMql1GNXRor5H4idq9Joz+EkIYIvUX7Q6hL+hqkpMfT7P
T19sdl6gSzeRntwi5m3OFBqOasv+zbMUZBfHWymeMr/y7vrTC0LUq7dBMtoM1O/4
gdW7jVg/tRvoSSiicNoxBN33shbyTApOB6jtSj1etX+jkMOvJwIDAQABo2MwYTAO
BgNVHQ8BAf8EBAMCAYYwDwYDVR0TAQH/BAUwAwEB/zAdBgNVHQ4EFgQUA95QNVbR
TLtm8KPiGxvDl7I90VUwHwYDVR0jBBgwFoAUA95QNVbRTLtm8KPiGxvDl7I90VUw
DQYJKoZIhvcNAQEFBQADggEBAMucN6pIExIK+t1EnE9SsPTfrgT1eXkIoyQY/Esr
hMAtudXH/vTBH1jLuG2cenTnmCmrEbXjcKChzUyImZOMkXDiqw8cvpOp/2PV5Adg
06O/nVsJ8dWO41P0jmP6P6fbtGbfYmbW0W5BjfIttep3Sp+dWOIrWcBAI+0tKIJF
PnlUkiaY4IBIqDfv8NZ5YBberOgOzW6sRBc4L0na4UU+Krk2U886UAb3LujEV0ls
YSEY1QSteDwsOoBrp+uvFRTp2InBuThs4pFsiv9kuXclVzDAGySj4dzp30d8tbQk
CAUw7C29C79Fv1C5qfPrmAESrciIxpg0X40KPMbp1ZWVbd4=
-----END CERTIFICATE-----`
			},
			{
				name: 'GlobalSign Root CA',
				validEndpoints: ['*'],
				pemData: `-----BEGIN CERTIFICATE-----
MIIDdTCCAl2gAwIBAgILBAAAAAABFUtaw5QwDQYJKoZIhvcNAQEFBQAwVzELMAkG
A1UEBhMCQkUxGTAXBgNVBAoTEEdsb2JhbFNpZ24gbnYtc2ExEDAOBgNVBAsTB1Jv
b3QgQ0ExGzAZBgNVBAMTEkdsb2JhbFNpZ24gUm9vdCBDQTAeFw05ODA5MDExMjAw
MDBaFw0yODAxMjgxMjAwMDBaMFcxCzAJBgNVBAYTAkJFMRkwFwYDVQQKExBHbG9i
YWxTaWduIG52LXNhMRAwDgYDVQQLEwdSb290IENBMRswGQYDVQQDExJHbG9iYWxT
aWduIFJvb3QgQ0EwggEiMA0GCSqGSIb3DQEBAQUAA4IBDwAwggEKAoIBAQDaDuaZ
jc6j40+Kfvvxi4Mla+pIH/EqsLmVEQS98GPR4mdmzxzdzxtIK+6NiY6arymAZavp
xy0Sy6scTHAHoT0KMM0VjU/43dSMUBUc71DuxC73/OlS8pF94G3VNTCOXkNz8kHp
1Wrjsok6Vjk4bwY8iGlbKk3Fp1S4bInMm/k8yuX9ifUSPJJ4ltbcdG6TRGHRjcdG
snUOhugZitVtbNV4FpWi6cgKOOvyJBNPc1STE4U6G7weNLWLBYy5d4ux2x8gkasJ
U26Qzns3dLlwR5EiUWMWea6xrkEmCMgZK9FGqkjWZCrXgzT/LCrBbBlDSgeF59N8
9iFo7+ryUp9/k5DPAgMBAAGjQjBAMA4GA1UdDwEB/wQEAwIBBjAPBgNVHRMBAf8E
BTADAQH/MB0GA1UdDgQWBBRge2YaRQ2XyolQL30EzTSo//z9SzANBgkqhkiG9w0B
AQUFAAOCAQEA1nPnfE920I2/7LqivjTFKDK1fPxsnCwrvQmeU79rXqoRSLblCKOz
yj1hTdNGCbM+w6DjY1Ub8rrvrTnhQ7k4o+YviiY776BQVvnGCv04zcQLcFGUl5gE
38NflNUVyRRBnMRddWQVDf9VMOyGj/8N7yy5Y0b2qvzfvGn9LhJIZJrglfCm7ymP
AbEVtQwdpf5pLGkkeB6zpxxxYu7KyJesF12KwvhHhm4qxFYxldBniYUr+WymXUad
DKqC5JlR3XC321Y9YeRq4VzW9v493kHMB65jUr9TU/Qr6cf9tveCX4XSQRjbgbME
HMUfpIBvFSDJ3gyICh3WZlXi/EjJKSZp4A==
-----END CERTIFICATE-----`
			}
		];
	}

	/**
	 * Private: Parse PEM certificate (framework)
	 */
	private parsePEMCertificate(pemData: string): CertificateInfo {
		// This is a framework implementation
		// In a real implementation, use a proper certificate parsing library
		const commonName = this.extractFromPEM(pemData, 'CN=');
		const fingerprint = this.calculateFingerprint(pemData);
		
		return {
			commonName: commonName ?? 'Unknown',
			subjectAltNames: this.extractSANFromPEM(pemData),
			fingerprint,
			issuer: this.extractFromPEM(pemData, 'Issuer: ') ?? 'Unknown',
			validFrom: new Date(), // Would extract from certificate
			validTo: new Date(Date.now() + (365 * 24 * 60 * 60 * 1000)), // Would extract from certificate
			serialNumber: 'unknown',
			selfSigned: pemData.includes('self-signed') || commonName === this.extractFromPEM(pemData, 'Issuer: '),
			pemData
		};
	}

	private extractFromPEM(pem: string, prefix: string): string | null {
		const match = pem.match(new RegExp(`${ prefix }([^,\n]+)`));
		return match ? match[1].trim() : null;
	}

	private extractSANFromPEM(pem: string): string[] {
		// Extract Subject Alternative Names
		const sanMatch = pem.match(/DNS:([^,\s]+)/g);
		return sanMatch ? sanMatch.map(dns => dns.replace('DNS:', '')) : [];
	}

	private calculateFingerprint(pemData: string): string {
		// Simple hash for demonstration - use proper SHA-256 in real implementation
		let hash = 0;
		for (let i = 0; i < pemData.length; i++) {
			const char = pemData.charCodeAt(i);
			hash = ((hash << 5) - hash) + char;
			hash = hash & hash;
		}
		return Math.abs(hash).toString(16).padStart(16, '0');
	}

	private matchesEndpoint(endpoint: string, pattern: string): boolean {
		// Simple endpoint matching - could be enhanced with wildcards
		return endpoint.includes(pattern) || pattern.includes('*');
	}
}

/**
 * Global certificate store instance
 */
export const certificateManager = new CertificateManager();