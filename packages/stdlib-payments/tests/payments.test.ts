// ============================================================================
// Payments Standard Library Tests
// Tests derived from ISL behavior specifications
// ============================================================================

import { describe, it, expect, beforeEach } from 'vitest';
import {
  createPayment,
  CreatePaymentInput,
  CreatePaymentConfig,
} from '../implementations/typescript/behaviors/create-payment';
import {
  capturePayment,
  CapturePaymentInput,
  CapturePaymentConfig,
} from '../implementations/typescript/behaviors/capture-payment';
import {
  refundPayment,
  RefundPaymentInput,
  RefundPaymentConfig,
} from '../implementations/typescript/behaviors/refund-payment';
import {
  processWebhook,
  ProcessWebhookInput,
  ProcessWebhookConfig,
} from '../implementations/typescript/behaviors/process-webhook';
import {
  PaymentStatus,
  PaymentErrorCode,
  RefundStatus,
  RefundErrorCode,
  IdempotencyKey,
  PaymentMethodToken,
  WebhookProvider,
  Currency,
} from '../implementations/typescript/types';
import { InMemoryPaymentRepository } from '../implementations/typescript/repositories/payment-repository';
import { InMemoryRefundRepository } from '../implementations/typescript/repositories/refund-repository';
import { InMemoryWebhookEventRepository } from '../implementations/typescript/repositories/webhook-repository';
import { InMemoryIdempotencyManager } from '../implementations/typescript/idempotency';
import { NoOpMetrics } from '../implementations/typescript/metrics';
import { createFraudDetector, MockFraudContextProvider } from '../implementations/typescript/fraud';
import { PaymentProviderAdapter, ProviderPaymentResult } from '../implementations/typescript/providers';

// ==========================================================================
// MOCK PROVIDER
// ==========================================================================

class MockPaymentProvider implements PaymentProviderAdapter {
  readonly name = 'MOCK';
  private nextResult: ProviderPaymentResult = {
    success: true,
    providerPaymentId: 'pi_mock_123',
  };
  
  setNextResult(result: ProviderPaymentResult): void {
    this.nextResult = result;
  }
  
  async getPaymentMethod(token: PaymentMethodToken) {
    if (token.startsWith('pm_invalid')) {
      return null;
    }
    return {
      type: 'card' as const,
      token,
      brand: 'VISA' as const,
      lastFour: '4242',
      expMonth: 12,
      expYear: 2030,
    };
  }
  
  async createPayment() {
    return this.nextResult;
  }
  
  async capturePayment() {
    return { success: true };
  }
  
  async refundPayment() {
    return { success: true, providerRefundId: 're_mock_123' };
  }
  
  verifyWebhookSignature(payload: string, signature: string): boolean {
    return signature === 'valid_signature';
  }
}

// ==========================================================================
// TEST FIXTURES
// ==========================================================================

function createTestConfig(): CreatePaymentConfig {
  return {
    repository: new InMemoryPaymentRepository(),
    idempotency: new InMemoryIdempotencyManager(),
    provider: new MockPaymentProvider(),
    fraudDetector: createFraudDetector(new MockFraudContextProvider()),
    metrics: new NoOpMetrics(),
    maxAmount: 999999,
    minAmount: 0.01,
    supportedCurrencies: ['USD', 'EUR', 'GBP'],
  };
}

function createTestInput(overrides?: Partial<CreatePaymentInput>): CreatePaymentInput {
  return {
    idempotencyKey: `idem-${Date.now()}-${Math.random()}` as IdempotencyKey,
    amount: 100.00,
    currency: 'USD' as Currency,
    paymentMethodToken: 'pm_test_valid_card' as PaymentMethodToken,
    capture: true,
    ...overrides,
  };
}

// ==========================================================================
// CREATE PAYMENT TESTS
// ==========================================================================

describe('CreatePayment', () => {
  let config: CreatePaymentConfig;
  
  beforeEach(() => {
    config = createTestConfig();
  });
  
  describe('Scenario: successful payment with auto-capture', () => {
    it('should create a captured payment', async () => {
      const input = createTestInput({
        idempotencyKey: 'idem-001' as IdempotencyKey,
        amount: 100.00,
        capture: true,
      });
      
      const initialCount = (config.repository as InMemoryPaymentRepository).count();
      
      const result = await createPayment(input, config);
      
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.amount).toBe(100.00);
        expect(result.data.status).toBe(PaymentStatus.CAPTURED);
        expect((config.repository as InMemoryPaymentRepository).count()).toBe(initialCount + 1);
      }
    });
  });
  
  describe('Scenario: auth-only payment', () => {
    it('should create an authorized payment without capture', async () => {
      const input = createTestInput({
        idempotencyKey: 'idem-auth-001' as IdempotencyKey,
        amount: 500.00,
        capture: false,
      });
      
      const result = await createPayment(input, config);
      
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.status).toBe(PaymentStatus.AUTHORIZED);
        expect(result.data.capturedAmount).toBe(0);
      }
    });
  });
  
  describe('Scenario: idempotent duplicate request', () => {
    it('should return existing payment for same idempotency key and params', async () => {
      const idempotencyKey = 'idem-dupe' as IdempotencyKey;
      const input = createTestInput({
        idempotencyKey,
        amount: 100.00,
      });
      
      // First request
      const first = await createPayment(input, config);
      expect(first.success).toBe(true);
      
      const initialCount = (config.repository as InMemoryPaymentRepository).count();
      
      // Second request with same key
      const second = await createPayment(input, config);
      
      expect(second.success).toBe(true);
      if (first.success && second.success) {
        expect(second.data.id).toBe(first.data.id);
        expect((config.repository as InMemoryPaymentRepository).count()).toBe(initialCount);
      }
    });
  });
  
  describe('Scenario: idempotency conflict with different params', () => {
    it('should reject request with same key but different amount', async () => {
      const idempotencyKey = 'idem-conflict' as IdempotencyKey;
      
      // First request
      const first = await createPayment(
        createTestInput({ idempotencyKey, amount: 100.00 }),
        config
      );
      expect(first.success).toBe(true);
      
      // Second request with different amount
      const second = await createPayment(
        createTestInput({ idempotencyKey, amount: 200.00 }),
        config
      );
      
      expect(second.success).toBe(false);
      if (!second.success) {
        expect(second.error.code).toBe(PaymentErrorCode.DUPLICATE_REQUEST);
      }
    });
  });
  
  describe('Scenario: invalid payment method', () => {
    it('should reject invalid payment method token', async () => {
      const input = createTestInput({
        paymentMethodToken: 'pm_invalid_token' as PaymentMethodToken,
      });
      
      const result = await createPayment(input, config);
      
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe(PaymentErrorCode.INVALID_CARD);
      }
    });
  });
  
  describe('Scenario: amount validation', () => {
    it('should reject amount below minimum', async () => {
      const input = createTestInput({ amount: 0.001 });
      
      const result = await createPayment(input, config);
      
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe(PaymentErrorCode.INVALID_AMOUNT);
      }
    });
    
    it('should reject amount above maximum', async () => {
      const input = createTestInput({ amount: 10000000 });
      
      const result = await createPayment(input, config);
      
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe(PaymentErrorCode.INVALID_AMOUNT);
      }
    });
  });
  
  describe('Scenario: unsupported currency', () => {
    it('should reject unsupported currency', async () => {
      const input = createTestInput({ currency: 'XYZ' as Currency });
      
      const result = await createPayment(input, config);
      
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe(PaymentErrorCode.CURRENCY_NOT_SUPPORTED);
      }
    });
  });
  
  describe('Scenario: card declined', () => {
    it('should handle provider decline', async () => {
      (config.provider as MockPaymentProvider).setNextResult({
        success: false,
        providerPaymentId: '',
        errorCode: PaymentErrorCode.CARD_DECLINED,
        errorMessage: 'Card was declined',
        retriable: false,
      });
      
      const input = createTestInput();
      const result = await createPayment(input, config);
      
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe(PaymentErrorCode.CARD_DECLINED);
      }
    });
  });
});

// ==========================================================================
// CAPTURE PAYMENT TESTS
// ==========================================================================

describe('CapturePayment', () => {
  let createConfig: CreatePaymentConfig;
  let captureConfig: CapturePaymentConfig;
  
  beforeEach(() => {
    createConfig = createTestConfig();
    captureConfig = {
      repository: createConfig.repository,
      idempotency: createConfig.idempotency,
      provider: createConfig.provider,
      metrics: createConfig.metrics,
      authorizationExpiryDays: 7,
    };
  });
  
  describe('Scenario: successful full capture', () => {
    it('should capture the full authorized amount', async () => {
      // Create auth-only payment
      const createResult = await createPayment(
        createTestInput({
          idempotencyKey: 'auth-for-capture' as IdempotencyKey,
          amount: 500.00,
          capture: false,
        }),
        createConfig
      );
      
      expect(createResult.success).toBe(true);
      if (!createResult.success) return;
      
      expect(createResult.data.status).toBe(PaymentStatus.AUTHORIZED);
      
      // Capture the payment
      const captureResult = await capturePayment(
        {
          paymentId: createResult.data.id,
          idempotencyKey: 'capture-001' as IdempotencyKey,
        },
        captureConfig
      );
      
      expect(captureResult.success).toBe(true);
      if (captureResult.success) {
        expect(captureResult.data.status).toBe(PaymentStatus.CAPTURED);
        expect(captureResult.data.capturedAmount).toBe(500.00);
        expect(captureResult.data.capturedAt).toBeDefined();
      }
    });
  });
  
  describe('Scenario: partial capture', () => {
    it('should capture partial amount', async () => {
      const createResult = await createPayment(
        createTestInput({
          idempotencyKey: 'auth-partial' as IdempotencyKey,
          amount: 1000.00,
          capture: false,
        }),
        createConfig
      );
      
      expect(createResult.success).toBe(true);
      if (!createResult.success) return;
      
      const captureResult = await capturePayment(
        {
          paymentId: createResult.data.id,
          idempotencyKey: 'capture-partial' as IdempotencyKey,
          amount: 750.00,
        },
        captureConfig
      );
      
      expect(captureResult.success).toBe(true);
      if (captureResult.success) {
        expect(captureResult.data.capturedAmount).toBe(750.00);
      }
    });
  });
  
  describe('Scenario: capture already captured payment', () => {
    it('should reject capture of already captured payment', async () => {
      const createResult = await createPayment(
        createTestInput({
          idempotencyKey: 'already-captured' as IdempotencyKey,
          amount: 100.00,
          capture: true, // Auto-capture
        }),
        createConfig
      );
      
      expect(createResult.success).toBe(true);
      if (!createResult.success) return;
      
      expect(createResult.data.status).toBe(PaymentStatus.CAPTURED);
      
      const captureResult = await capturePayment(
        {
          paymentId: createResult.data.id,
          idempotencyKey: 'capture-again' as IdempotencyKey,
        },
        captureConfig
      );
      
      expect(captureResult.success).toBe(false);
      if (!captureResult.success) {
        expect(captureResult.error.details?.currentStatus).toBe(PaymentStatus.CAPTURED);
      }
    });
  });
  
  describe('Scenario: capture exceeds authorization', () => {
    it('should reject capture exceeding authorized amount', async () => {
      const createResult = await createPayment(
        createTestInput({
          idempotencyKey: 'auth-exceed' as IdempotencyKey,
          amount: 100.00,
          capture: false,
        }),
        createConfig
      );
      
      expect(createResult.success).toBe(true);
      if (!createResult.success) return;
      
      const captureResult = await capturePayment(
        {
          paymentId: createResult.data.id,
          idempotencyKey: 'capture-exceed' as IdempotencyKey,
          amount: 150.00, // More than authorized
        },
        captureConfig
      );
      
      expect(captureResult.success).toBe(false);
      if (!captureResult.success) {
        expect(captureResult.error.details?.authorizedAmount).toBe(100.00);
        expect(captureResult.error.details?.requestedAmount).toBe(150.00);
      }
    });
  });
});

// ==========================================================================
// REFUND PAYMENT TESTS
// ==========================================================================

describe('RefundPayment', () => {
  let createConfig: CreatePaymentConfig;
  let refundConfig: RefundPaymentConfig;
  
  beforeEach(() => {
    createConfig = createTestConfig();
    refundConfig = {
      paymentRepository: createConfig.repository,
      refundRepository: new InMemoryRefundRepository(),
      idempotency: createConfig.idempotency,
      provider: createConfig.provider,
      metrics: createConfig.metrics,
      refundWindowDays: 180,
    };
  });
  
  describe('Scenario: successful full refund', () => {
    it('should refund the full captured amount', async () => {
      const createResult = await createPayment(
        createTestInput({
          idempotencyKey: 'refund-full-payment' as IdempotencyKey,
          amount: 100.00,
          capture: true,
        }),
        createConfig
      );
      
      expect(createResult.success).toBe(true);
      if (!createResult.success) return;
      
      const refundResult = await refundPayment(
        {
          paymentId: createResult.data.id,
          idempotencyKey: 'refund-full-001' as IdempotencyKey,
          reason: 'Customer request',
        },
        refundConfig
      );
      
      expect(refundResult.success).toBe(true);
      if (refundResult.success) {
        expect(refundResult.data.amount).toBe(100.00);
        expect(refundResult.data.status).toBe(RefundStatus.SUCCEEDED);
        
        // Verify payment status updated
        const payment = await createConfig.repository.findById(createResult.data.id);
        expect(payment?.status).toBe(PaymentStatus.REFUNDED);
        expect(payment?.refundedAmount).toBe(100.00);
      }
    });
  });
  
  describe('Scenario: successful partial refund', () => {
    it('should refund partial amount', async () => {
      const createResult = await createPayment(
        createTestInput({
          idempotencyKey: 'refund-partial-payment' as IdempotencyKey,
          amount: 500.00,
          capture: true,
        }),
        createConfig
      );
      
      expect(createResult.success).toBe(true);
      if (!createResult.success) return;
      
      const refundResult = await refundPayment(
        {
          paymentId: createResult.data.id,
          idempotencyKey: 'refund-partial-001' as IdempotencyKey,
          amount: 150.00,
          reason: 'Partial order cancellation',
        },
        refundConfig
      );
      
      expect(refundResult.success).toBe(true);
      if (refundResult.success) {
        expect(refundResult.data.amount).toBe(150.00);
        
        const payment = await createConfig.repository.findById(createResult.data.id);
        expect(payment?.status).toBe(PaymentStatus.PARTIALLY_REFUNDED);
        expect(payment?.refundedAmount).toBe(150.00);
      }
    });
  });
  
  describe('Scenario: refund exceeds available', () => {
    it('should reject refund exceeding available amount', async () => {
      const createResult = await createPayment(
        createTestInput({
          idempotencyKey: 'refund-exceed-payment' as IdempotencyKey,
          amount: 100.00,
          capture: true,
        }),
        createConfig
      );
      
      expect(createResult.success).toBe(true);
      if (!createResult.success) return;
      
      // First partial refund
      const firstRefund = await refundPayment(
        {
          paymentId: createResult.data.id,
          idempotencyKey: 'refund-first' as IdempotencyKey,
          amount: 75.00,
        },
        refundConfig
      );
      expect(firstRefund.success).toBe(true);
      
      // Second refund exceeding available
      const secondRefund = await refundPayment(
        {
          paymentId: createResult.data.id,
          idempotencyKey: 'refund-exceed' as IdempotencyKey,
          amount: 50.00, // Only 25 available
        },
        refundConfig
      );
      
      expect(secondRefund.success).toBe(false);
      if (!secondRefund.success) {
        expect(secondRefund.error.code).toBe(RefundErrorCode.AMOUNT_EXCEEDS_AVAILABLE);
        expect(secondRefund.error.details?.availableForRefund).toBe(25.00);
        expect(secondRefund.error.details?.alreadyRefunded).toBe(75.00);
        expect(secondRefund.error.details?.requested).toBe(50.00);
      }
    });
  });
  
  describe('Scenario: refund unauthorized payment', () => {
    it('should reject refund of non-captured payment', async () => {
      const createResult = await createPayment(
        createTestInput({
          idempotencyKey: 'refund-auth-payment' as IdempotencyKey,
          amount: 100.00,
          capture: false, // Auth only
        }),
        createConfig
      );
      
      expect(createResult.success).toBe(true);
      if (!createResult.success) return;
      
      expect(createResult.data.status).toBe(PaymentStatus.AUTHORIZED);
      
      const refundResult = await refundPayment(
        {
          paymentId: createResult.data.id,
          idempotencyKey: 'refund-auth' as IdempotencyKey,
        },
        refundConfig
      );
      
      expect(refundResult.success).toBe(false);
      if (!refundResult.success) {
        expect(refundResult.error.code).toBe(RefundErrorCode.PAYMENT_NOT_CAPTURED);
      }
    });
  });
});

// ==========================================================================
// WEBHOOK PROCESSING TESTS
// ==========================================================================

describe('ProcessWebhook', () => {
  let config: ProcessWebhookConfig;
  let provider: MockPaymentProvider;
  
  beforeEach(() => {
    provider = new MockPaymentProvider();
    config = {
      paymentRepository: new InMemoryPaymentRepository(),
      refundRepository: new InMemoryRefundRepository(),
      webhookRepository: new InMemoryWebhookEventRepository(),
      providers: new Map([[WebhookProvider.STRIPE, provider]]),
      metrics: new NoOpMetrics(),
      toleranceSeconds: 300, // 5 minutes
      maxRetries: 10,
    };
  });
  
  describe('Scenario: invalid signature rejected', () => {
    it('should reject webhook with invalid signature', async () => {
      const input: ProcessWebhookInput = {
        provider: WebhookProvider.STRIPE,
        eventId: 'evt_invalid_sig',
        eventType: 'payment_intent.succeeded',
        signature: 'invalid_signature_abc123',
        timestamp: new Date(),
        payload: '{}',
        headers: {},
      };
      
      const result = await processWebhook(input, config);
      
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('INVALID_SIGNATURE');
      }
    });
  });
  
  describe('Scenario: duplicate event handled idempotently', () => {
    it('should reject duplicate events', async () => {
      // Pre-seed a payment that the webhook will reference
      const mockPayment = {
        id: 'pay_webhook_test' as any,
        idempotencyKey: 'idem-webhook' as IdempotencyKey,
        amount: 100,
        currency: 'USD' as Currency,
        capturedAmount: 100,
        refundedAmount: 0,
        paymentMethod: {
          type: 'card' as const,
          token: 'pm_test' as PaymentMethodToken,
          brand: 'VISA' as const,
          lastFour: '4242',
          expMonth: 12,
          expYear: 2030,
        },
        status: PaymentStatus.AUTHORIZED,
        provider: 'MOCK',
        providerPaymentId: 'pi_123',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      await (config.paymentRepository as InMemoryPaymentRepository).save(mockPayment as any);
      
      const eventId = 'evt_duplicate';
      const input: ProcessWebhookInput = {
        provider: WebhookProvider.STRIPE,
        eventId,
        eventType: 'payment_intent.succeeded',
        signature: 'valid_signature',
        timestamp: new Date(),
        payload: JSON.stringify({
          data: { object: { id: 'pi_123' } },
        }),
        headers: {},
      };
      
      // First request
      const first = await processWebhook(input, config);
      expect(first.success).toBe(true);
      
      // Second request
      const second = await processWebhook(input, config);
      
      expect(second.success).toBe(false);
      if (!second.success) {
        expect(second.error.code).toBe('DUPLICATE_EVENT');
      }
    });
  });
  
  describe('Scenario: stale event rejected', () => {
    it('should reject events older than tolerance window', async () => {
      const input: ProcessWebhookInput = {
        provider: WebhookProvider.STRIPE,
        eventId: 'evt_stale',
        eventType: 'payment_intent.succeeded',
        signature: 'valid_signature',
        timestamp: new Date(Date.now() - 600000), // 10 minutes ago
        payload: '{}',
        headers: {},
      };
      
      const result = await processWebhook(input, config);
      
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('STALE_EVENT');
      }
    });
  });
  
  describe('Scenario: unknown provider rejected', () => {
    it('should reject webhooks from unknown providers', async () => {
      const input: ProcessWebhookInput = {
        provider: 'UNKNOWN' as WebhookProvider,
        eventId: 'evt_unknown',
        eventType: 'payment.succeeded',
        signature: 'valid_signature',
        timestamp: new Date(),
        payload: '{}',
        headers: {},
      };
      
      const result = await processWebhook(input, config);
      
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('UNKNOWN_PROVIDER');
      }
    });
  });
});

// ==========================================================================
// INVARIANT TESTS
// ==========================================================================

describe('Payment Invariants', () => {
  let config: CreatePaymentConfig;
  
  beforeEach(() => {
    config = createTestConfig();
  });
  
  it('captured_amount should never exceed amount', async () => {
    const result = await createPayment(
      createTestInput({ amount: 100.00, capture: true }),
      config
    );
    
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.capturedAmount).toBeLessThanOrEqual(result.data.amount);
    }
  });
  
  it('refunded_amount should never exceed captured_amount', async () => {
    const createConfig = createTestConfig();
    const refundConfig: RefundPaymentConfig = {
      paymentRepository: createConfig.repository,
      refundRepository: new InMemoryRefundRepository(),
      idempotency: createConfig.idempotency,
      provider: createConfig.provider,
      metrics: createConfig.metrics,
      refundWindowDays: 180,
    };
    
    const createResult = await createPayment(
      createTestInput({
        idempotencyKey: 'invariant-test' as IdempotencyKey,
        amount: 100.00,
        capture: true,
      }),
      createConfig
    );
    
    expect(createResult.success).toBe(true);
    if (!createResult.success) return;
    
    // Try to refund more than captured
    const refundResult = await refundPayment(
      {
        paymentId: createResult.data.id,
        idempotencyKey: 'refund-invariant' as IdempotencyKey,
        amount: 150.00, // More than captured
      },
      refundConfig
    );
    
    expect(refundResult.success).toBe(false);
    
    // Verify payment state unchanged
    const payment = await createConfig.repository.findById(createResult.data.id);
    expect(payment?.refundedAmount).toBeLessThanOrEqual(payment?.capturedAmount ?? 0);
  });
  
  it('idempotency key should be immutable', async () => {
    const result = await createPayment(
      createTestInput({ idempotencyKey: 'immutable-key' as IdempotencyKey }),
      config
    );
    
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.idempotencyKey).toBe('immutable-key');
    }
  });
});

// ==========================================================================
// PCI COMPLIANCE TESTS
// ==========================================================================

describe('PCI Compliance', () => {
  let config: CreatePaymentConfig;
  
  beforeEach(() => {
    config = createTestConfig();
  });
  
  it('should not store raw card numbers', async () => {
    const result = await createPayment(
      createTestInput({
        idempotencyKey: 'pci-test-key' as IdempotencyKey,
        paymentMethodToken: 'pm_test_card' as PaymentMethodToken,
      }),
      config
    );
    
    expect(result.success).toBe(true);
    if (result.success) {
      // Verify payment method is tokenized, not raw card number
      expect(result.data.paymentMethod.token).toBeDefined();
      // Card payment methods should have lastFour, not full card number
      const pm = result.data.paymentMethod as { lastFour?: string };
      expect(pm.lastFour).toBeDefined();
      expect(pm.lastFour!.length).toBe(4);
    }
  });
  
  it('should have PCI metadata on created payments', async () => {
    const result = await createPayment(createTestInput(), config);
    
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.pciMetadata).toBeDefined();
      expect(result.data.pciMetadata.tokenizationMethod).toBeDefined();
      expect(result.data.pciMetadata.tokenizedAt).toBeDefined();
      expect(result.data.pciMetadata.complianceLevel).toBeGreaterThanOrEqual(1);
    }
  });
});
