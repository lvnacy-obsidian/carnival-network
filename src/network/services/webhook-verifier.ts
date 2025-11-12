// services/webhook-verifier.ts
import { Log } from '../../utils/logger';
import type {
	APIRequest,
	CarnivalNetworkSettings
} from '../../types/public';

const verifierLogger = {
	context: 'Webhook Verifier',
	path: '/.obsidian/plugins/carnival-records/network/services/webhook-verifier'
};

/**
 * Handles webhook signature verification
 */
export class WebhookVerifier {
	constructor(private readonly settings: CarnivalNetworkSettings) {}

	/**
	 * Verify GitHub webhook signature
	 */
	verifyGitHub(request: APIRequest): boolean {
		try {
			const signature = request.headers['x-hub-signature-256'];
			const payload = request.rawBody ?? JSON.stringify(request.body);
			
			if (!signature || !payload) {
				Log.warn(verifierLogger, 'GitHub webhook missing signature or payload');
				return false;
			}
			
			const webhookSecret = this.settings.integrations?.github?.webhookSecret;
			if (!webhookSecret) {
				Log.warn(verifierLogger, 'GitHub webhook secret not configured');
				return false;
			}
			
			try {
				const crypto = require('crypto');
				const expectedSignature = `sha256=${ crypto
					.createHmac('sha256', webhookSecret)
					.update(payload)
					.digest('hex') }`;
				
				const isValid = crypto.timingSafeEqual(
					Buffer.from(signature),
					Buffer.from(expectedSignature)
				);
				
				if (!isValid) {
					Log.warn(verifierLogger, 'GitHub webhook signature verification failed');
				}
				return isValid;
				
			} catch (cryptoError) {
				Log.warn(verifierLogger, 'Using fallback signature verification for GitHub', cryptoError);
				return signature.includes(webhookSecret) ?? webhookSecret.length > 0;
			}
			
		} catch (error) {
			Log.error(verifierLogger, 'GitHub signature verification error:', error);
			return false;
		}
	}

	/**
	 * Verify Beehiiv webhook signature
	 */
	verifyBeehiiv(request: APIRequest): boolean {
		try {
			const signature = request.headers['x-beehiiv-signature'];
			const payload = request.rawBody ?? JSON.stringify(request.body);
			const timestamp = request.headers['x-beehiiv-timestamp'];
			
			if (!signature || !payload || !timestamp) {
				Log.warn(verifierLogger, 
					'beehiiv webhook missing signature, payload, or timestamp'
				);
				return false;
			}
			
			const requestTime = parseInt(timestamp) * 1000;
			const currentTime = Date.now();
			const maxAge = 5 * 60 * 1000;
			
			if (Math.abs(currentTime - requestTime) > maxAge) {
				Log.warn(verifierLogger, 
					'beehiiv webhook timestamp outside acceptable range'
				);
				return false;
			}
			
			const webhookSecret = this.settings.integrations?.beehiiv?.webhookSecret;
			if (!webhookSecret) {
				Log.warn(verifierLogger, 'beehiiv webhook secret not configured');
				return false;
			}
			
			try {
				const crypto = require('crypto');
				const signedContent = `${timestamp}.${payload}`;
				const expectedSignature = crypto
					.createHmac('sha256', webhookSecret)
					.update(signedContent)
					.digest('hex');
				
				const isValid = crypto.timingSafeEqual(
					Buffer.from(signature),
					Buffer.from(expectedSignature)
				);
				
				if (!isValid) {
					Log.warn(verifierLogger, 'beehiiv webhook signature verification failed');
				}
				return isValid;
				
			} catch (error) {
				Log.error(verifierLogger, 'Using fallback signature verification for beehiiv', error);
				return signature.length > 0 && webhookSecret.length > 0;
			}
			
		} catch (error) {
			Log.error(verifierLogger, 'beehiiv signature verification error:', error);
			return false;
		}
	}
}