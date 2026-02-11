/**
 * Webhook signature verifier with timing-safe compare
 * @packageDocumentation
 */

import { GatewayProvider } from '../types';
import { 
  WebhookSignature, 
  WebhookVerificationOptions, 
  WebhookVerificationResult 
} from './types';
import { WebhookError } from '../errors';
import * as crypto from 'crypto';

// ============================================================================
// WEBHOOK VERIFIER
// ============================================================================

export class WebhookVerifier {
  /**
   * Verify webhook signature
   */
  static async verify(
    payload: string,
    signature: string,
    options: WebhookVerificationOptions
  ): Promise<WebhookVerificationResult> {
    try {
      switch (options.provider) {
        case GatewayProvider.STRIPE:
          return this.verifyStripe(payload, signature, options);
        
        case GatewayProvider.PAYPAL:
          return this.verifyPaypal(payload, signature, options);
        
        case GatewayProvider.MOCK:
          return this.verifyMock(payload, signature, options);
        
        default:
          return {
            valid: false,
            error: `Unsupported provider: ${options.provider}`,
          };
      }
    } catch (error) {
      return {
        valid: false,
        error: error instanceof Error ? error.message : 'Verification failed',
      };
    }
  }

  // ============================================================================
  // STRIPE VERIFICATION
  // ============================================================================

  private static verifyStripe(
    payload: string,
    signature: string,
    options: WebhookVerificationOptions
  ): WebhookVerificationResult {
    if (!options.secret) {
      return {
        valid: false,
        error: 'Webhook secret is required',
      };
    }

    // Parse signature header
    const elements = signature.split(',');
    let timestamp = '';
    let signedPayload = '';

    for (const element of elements) {
      const [key, value] = element.trim().split('=');
      if (key === 't') {
        timestamp = value;
      } else if (key.startsWith('v')) {
        signedPayload = value;
      }
    }

    if (!timestamp || !signedPayload) {
      return {
        valid: false,
        error: 'Invalid signature format',
      };
    }

    // Check timestamp tolerance
    const tolerance = options.tolerance || 300; // 5 minutes
    const now = Math.floor((options.clock?.() || new Date()).getTime() / 1000);
    const timestampNum = parseInt(timestamp);
    
    if (Math.abs(now - timestampNum) > tolerance) {
      return {
        valid: false,
        error: `Timestamp outside tolerance: ${Math.abs(now - timestampNum)}s > ${tolerance}s`,
        timestamp: new Date(timestampNum * 1000),
      };
    }

    // Construct signed payload
    const expectedPayload = `${timestamp}.${payload}`;

    // Generate expected signature
    const expectedSignature = crypto
      .createHmac('sha256', options.secret)
      .update(expectedPayload, 'utf8')
      .digest('hex');

    // Compare signatures securely
    const valid = this.timingSafeEqual(
      Buffer.from(signedPayload, 'hex'),
      Buffer.from(expectedSignature, 'hex')
    );

    return {
      valid,
      timestamp: new Date(timestampNum * 1000),
    };
  }

  // ============================================================================
  // PAYPAL VERIFICATION
  // ============================================================================

  private static verifyPaypal(
    payload: string,
    signature: string,
    options: WebhookVerificationOptions
  ): WebhookVerificationResult {
    if (!options.secret) {
      return {
        valid: false,
        error: 'Webhook secret is required',
      };
    }

    try {
      // PayPal signature is base64-encoded JSON
      const signatureData = JSON.parse(Buffer.from(signature, 'base64').toString());
      
      // Verify algorithm
      if (signatureData.alg !== 'SHA256withRSA') {
        return {
          valid: false,
          error: `Unsupported algorithm: ${signatureData.alg}`,
        };
      }

      // Get certificate ID and fetch public key
      const certId = signatureData.cert_id;
      const publicKey = this.getPayPalPublicKey(certId);
      
      if (!publicKey) {
        return {
          valid: false,
          error: 'Could not retrieve PayPal public key',
        };
      }

      // Create verifier
      const verifier = crypto.createVerify('RSA-SHA256');
      verifier.update(payload, 'utf8');
      
      // Verify signature
      const valid = verifier.verify(
        publicKey,
        signatureData.signature,
        'base64'
      );

      return { valid };

    } catch (error) {
      return {
        valid: false,
        error: 'Invalid PayPal signature format',
      };
    }
  }

  // ============================================================================
  // MOCK VERIFICATION
  // ============================================================================

  private static verifyMock(
    payload: string,
    signature: string,
    options: WebhookVerificationOptions
  ): WebhookVerificationResult {
    // Mock verification - accept if signature starts with 'mock_'
    const valid = signature.startsWith('mock_') || signature === 'valid';
    
    return {
      valid,
      timestamp: new Date(),
    };
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  /**
   * Timing-safe string comparison
   * Prevents timing attacks by taking constant time regardless of match
   */
  private static timingSafeEqual(a: Buffer, b: Buffer): boolean {
    if (a.length !== b.length) {
      return false;
    }

    let result = 0;
    for (let i = 0; i < a.length; i++) {
      result |= a[i] ^ b[i];
    }

    return result === 0;
  }

  /**
   * Get PayPal public key (mock implementation)
   */
  private static getPayPalPublicKey(certId: string): string | null {
    // In a real implementation, this would:
    // 1. Fetch the certificate from PayPal's API
    // 2. Extract the public key
    // 3. Cache it for future use
    
    // Mock public key for demonstration
    if (certId === 'MOCK_CERT_ID') {
      return `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAwR2KJtJ8H9K8tw9kQhG
... (mock key)
-----END PUBLIC KEY-----`;
    }

    return null;
  }

  /**
   * Extract signature from headers
   */
  static extractSignature(headers: Record<string, string>): string | null {
    // Try common header names
    const signatureHeaders = [
      'stripe-signature',
      'paypal-transmission-sig',
      'webhook-signature',
      'x-webhook-signature',
      'signature',
    ];

    for (const header of signatureHeaders) {
      const value = headers[header] || headers[header.toLowerCase()];
      if (value) {
        return value;
      }
    }

    return null;
  }

  /**
   * Extract timestamp from signature
   */
  static extractTimestamp(signature: string): number | null {
    try {
      const elements = signature.split(',');
      for (const element of elements) {
        const [key, value] = element.trim().split('=');
        if (key === 't') {
          return parseInt(value);
        }
      }
    } catch {
      // Ignore errors
    }

    return null;
  }

  /**
   * Generate test signature (for testing)
   */
  static generateTestSignature(
    payload: string,
    secret: string,
    provider: GatewayProvider = GatewayProvider.MOCK
  ): string {
    switch (provider) {
      case GatewayProvider.STRIPE:
        const timestamp = Math.floor(Date.now() / 1000).toString();
        const signedPayload = `${timestamp}.${payload}`;
        const signature = crypto
          .createHmac('sha256', secret)
          .update(signedPayload, 'utf8')
          .digest('hex');
        return `t=${timestamp},v1=${signature}`;
      
      case GatewayProvider.MOCK:
        return 'mock_valid_signature';
      
      default:
        return 'test_signature';
    }
  }
}

// ============================================================================
// WEBHOOK SIGNATURE MIDDLEWARE
// ============================================================================

export class WebhookSignatureMiddleware {
  constructor(private options: WebhookVerificationOptions) {}

  /**
   * Express middleware for webhook verification
   */
  verify() {
    return async (req: any, res: any, next: any) => {
      try {
        const signature = WebhookVerifier.extractSignature(req.headers);
        
        if (!signature) {
          return res.status(401).json({
            error: 'Missing signature',
          });
        }

        const result = await WebhookVerifier.verify(
          JSON.stringify(req.body),
          signature,
          this.options
        );

        if (!result.valid) {
          return res.status(401).json({
            error: result.error || 'Invalid signature',
          });
        }

        // Attach verification result to request
        req.verified = true;
        req.signatureTimestamp = result.timestamp;
        
        next();

      } catch (error) {
        res.status(400).json({
          error: 'Signature verification failed',
        });
      }
    };
  }

  /**
   * Generic verification function
   */
  async verifyRequest(
    payload: string,
    headers: Record<string, string>
  ): Promise<WebhookVerificationResult> {
    const signature = WebhookVerifier.extractSignature(headers);
    
    if (!signature) {
      return {
        valid: false,
        error: 'Missing signature',
      };
    }

    return WebhookVerifier.verify(payload, signature, this.options);
  }
}
