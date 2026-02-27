/**
 * Webhook tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { WebhookVerifier } from '../src/webhooks/verifier';
import { GatewayProvider } from '../src/types';
import { DefaultWebhookHandlerRegistry, PaymentIntentHandler } from '../src/webhooks/handler';
import { WebhookEvent, WebhookEventType } from '../src/webhooks/types';

describe('WebhookVerifier', () => {
  const secret = 'whsec_test_secret';

  describe('Stripe verification', () => {
    it('should verify valid Stripe signature', async () => {
      const payload = JSON.stringify({ test: 'data' });
      const signature = WebhookVerifier.generateTestSignature(
        payload,
        secret,
        GatewayProvider.STRIPE
      );

      const result = await WebhookVerifier.verify(payload, signature, {
        provider: GatewayProvider.STRIPE,
        secret,
      });

      expect(result.valid).toBe(true);
      expect(result.timestamp).toBeDefined();
    });

    it('should reject invalid signature', async () => {
      const payload = JSON.stringify({ test: 'data' });
      const signature = 'invalid_signature';

      const result = await WebhookVerifier.verify(payload, signature, {
        provider: GatewayProvider.STRIPE,
        secret,
      });

      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should extract signature from headers', () => {
      const headers = {
        'stripe-signature': 't=123,v1=abc',
        'content-type': 'application/json',
      };

      const signature = WebhookVerifier.extractSignature(headers);
      expect(signature).toBe('t=123,v1=abc');
    });
  });

  describe('Mock verification', () => {
    it('should verify mock signature', async () => {
      const payload = JSON.stringify({ test: 'data' });
      const signature = 'mock_valid_signature';

      const result = await WebhookVerifier.verify(payload, signature, {
        provider: GatewayProvider.MOCK,
        secret,
      });

      expect(result.valid).toBe(true);
    });
  });
});

describe('WebhookHandlerRegistry', () => {
  let registry: DefaultWebhookHandlerRegistry;

  beforeEach(() => {
    registry = new DefaultWebhookHandlerRegistry();
  });

  it('should register and handle events', async () => {
    const handler = new PaymentIntentHandler();
    registry.register('payment_intent.succeeded', handler);

    const event: WebhookEvent = {
      id: 'evt_123',
      provider: GatewayProvider.STRIPE,
      type: 'payment_intent.succeeded',
      eventType: 'payment_intent.succeeded',
      data: {
        object: {
          id: 'pi_123',
          status: 'succeeded',
          amount: 2000,
        },
      },
      timestamp: new Date(),
      processed: false,
      retryCount: 0,
    };

    const result = await registry.handle(event);
    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
  });

  it('should return error for unhandled event', async () => {
    const event: WebhookEvent = {
      id: 'evt_123',
      provider: GatewayProvider.STRIPE,
      type: 'unknown.event',
      eventType: 'unknown.event',
      data: {},
      timestamp: new Date(),
      processed: false,
      retryCount: 0,
    };

    const result = await registry.handle(event);
    expect(result.success).toBe(false);
    expect(result.error).toContain('No handler registered');
  });
});
