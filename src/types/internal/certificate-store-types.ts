/**
 * ============================================================================
 * CERTIFICATE STORE
 * ============================================================================
 * 
 * Index of exports:
 * - Certificate - structure for a certificate
 * - CertificateInfo - structure for certificate information extracted from PEM
 * - CertificateValidationResult - structure for certificate validation results
 * - TrustedCertificate - structure for a trusted certificate with metadata
 */

export interface Certificate {
	id: string;
	name: string;
	type: 'ca' | 'client' | 'server';
	pem: string;
	fingerprint: string;
	validFrom: string;
	validTo: string;
	issuer: string;
	subject: string;
	trusted: boolean;
}

/**
 * Certificate information extracted from PEM
 */
export interface CertificateInfo {
	commonName: string;
	subjectAltNames: string[];
	fingerprint: string;
	issuer: string;
	validFrom: Date;
	validTo: Date;
	serialNumber: string;
	selfSigned: boolean;
	pemData: string;
}

export interface CertificateValidationResult {
	valid: boolean;
	trusted: boolean;
	errors: string[];
	certificate?: Certificate;
}

/**
 * Trusted certificate with additional metadata
 */
export interface TrustedCertificate extends Certificate {
	trustLevel: 'full' | 'conditional' | 'revoked';
	addedAt: Date;
	notes?: string;
	validEndpoints: string[];
}