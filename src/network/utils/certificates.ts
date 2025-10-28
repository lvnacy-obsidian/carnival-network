import type { CertificateInfo } from '../../types';

/**
 * Extract domain from certificate
 */
export function extractDomainFromCert(pemData: string): string | null {
	const commonNameMatch = pemData.match(/CN=([^,\n]+)/);
	return commonNameMatch ? commonNameMatch[1].trim() : null;
}

/**
 * Get certificate expiry status
 */
export function getCertificateExpiryStatus(cert: CertificateInfo): 'valid' | 'expiring-soon' | 'expired' {
	const now = new Date();
	const thirtyDaysFromNow = new Date(now.getTime() + (30 * 24 * 60 * 60 * 1000));

	if (cert.validTo < now) {
		return 'expired';
	}

	if (cert.validTo < thirtyDaysFromNow) {
		return 'expiring-soon';
	}

	return 'valid';
}

/**
 * Check if certificate is expired
 */
export function isCertificateExpired(cert: CertificateInfo): boolean {
	return new Date() > cert.validTo;
}

/**
 * Quick certificate validation
 */
export function isValidCertificate(pemData: string): boolean {
	return pemData.includes('BEGIN CERTIFICATE') && 
		pemData.includes('END CERTIFICATE');
}