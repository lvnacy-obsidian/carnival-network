/**
 * ============================================================================
 * CERTIFICATE STORE
 * ============================================================================
 * 
 * Index of exports:
 * - Certificate - structure for a certificate
 * - CertificateValidationResult - structure for certificate validation results
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

export interface CertificateValidationResult {
	valid: boolean;
	trusted: boolean;
	errors: string[];
	certificate?: Certificate;
}