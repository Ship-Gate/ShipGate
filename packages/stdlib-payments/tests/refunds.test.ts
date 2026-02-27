/**
 * Refunds tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { RefundsProcessor } from '../src/refunds/processor';
import { RefundPolicyEngine } from '../src/refunds/policy';
import { MockGatewayAdapter } from '../src/gateway/mock';
import { IdempotencyManager } from '../src/idempotency';
import { Payment, PaymentStatus } from '../src/types';

describe('RefundsProcessor', () => {
  let processor: RefundsProcessor;
  let gateway: MockGatewayAdapter;
  let idempotency: IdempotencyManager;
  let mockPayment: Payment;

  beforeEach(() => {
    gateway = new MockGatewayAdapter({ provider: 'mock' });
    idempotency = new IdempotencyManager();
    processor = new RefundsProcessor(gateway, idempotency);

    // Create a mock payment
    mockPayment = {
      id: 'pay_123',
      amount: 10000n, // $100.00
      currency: 'USD',
      status: PaymentStatus.CAPTURED,
      paymentMethodId: 'pm_123',
      createdAt: new Date(),
      capturedAmount: 10000n,
      gatewayProvider: 'mock' as any,
      gatewayPaymentId: 'pay_123',
    };
  });

  describe('refund calculation', () => {
    it('should calculate full refund amount', async () => {
      const calc = await processor.calculateRefund(mockPayment.id);
      expect(calc.maxRefundable).toBe(10000n);
      expect(calc.alreadyRefunded).toBe(0n);
      expect(calc.availableToRefund).toBe(10000n);
    });

    it('should calculate partial refund amount', async () => {
      const calc = await processor.calculateRefund(mockPayment.id, 5000n);
      expect(calc.maxRefundable).toBe(10000n);
      expect(calc.availableToRefund).toBe(10000n);
    });

    it('should calculate refund with fees', async () => {
      const calc = await processor.calculateRefund(mockPayment.id);
      expect(calc.fees.total).toBeGreaterThan(0n);
      expect(calc.netAmount).toBeLessThan(calc.maxRefundable);
    });
  });

  describe('refund eligibility', () => {
    it('should check eligible payment', async () => {
      const eligibility = await processor.checkEligibility(mockPayment.id);
      expect(eligibility.eligible).toBe(true);
      expect(eligibility.maxAmount).toBe(10000n);
    });

    it('should reject unauthorized payment', async () => {
      const unauthorizedPayment = {
        ...mockPayment,
        status: PaymentStatus.AUTHORIZED,
      };

      // Mock the gateway to return unauthorized payment
      gateway.simulatePaymentStatusChange(mockPayment.id, PaymentStatus.AUTHORIZED);

      const eligibility = await processor.checkEligibility(mockPayment.id);
      expect(eligibility.eligible).toBe(false);
      expect(eligibility.reason).toBeDefined();
    });

    it('should check time limits', async () => {
      // Create an old payment
      const oldPayment = {
        ...mockPayment,
        createdAt: new Date(Date.now() - 100 * 24 * 60 * 60 * 1000), // 100 days ago
      };

      const eligibility = await processor.checkEligibility(oldPayment.id);
      expect(eligibility.conditions.some(c => c.type === 'time_limit')).toBe(true);
    });
  });

  describe('refund creation', () => {
    it('should create full refund', async () => {
      const response = await processor.createRefund({
        paymentId: mockPayment.id,
        reason: 'requested_by_customer',
      });

      expect(response.refund.paymentId).toBe(mockPayment.id);
      expect(response.refund.amount).toBe(10000n);
      expect(response.refund.status).toBe('succeeded');
    });

    it('should create partial refund', async () => {
      const response = await processor.createRefund({
        paymentId: mockPayment.id,
        amount: 5000n,
        reason: 'requested_by_customer',
      });

      expect(response.refund.amount).toBe(5000n);
    });

    it('should handle idempotency', async () => {
      const request = {
        paymentId: mockPayment.id,
        amount: 5000n,
        reason: 'requested_by_customer',
        idempotencyKey: 'idemp_123',
      };

      const response1 = await processor.createRefund(request);
      const response2 = await processor.createRefund(request);

      expect(response1.refund.id).toBe(response2.refund.id);
    });
  });
});

describe('RefundPolicyEngine', () => {
  let engine: RefundPolicyEngine;
  let mockPayment: Payment;

  beforeEach(() => {
    engine = new RefundPolicyEngine();
    
    mockPayment = {
      id: 'pay_123',
      amount: 10000n,
      currency: 'USD',
      status: PaymentStatus.CAPTURED,
      paymentMethodId: 'pm_123',
      createdAt: new Date(),
      capturedAmount: 10000n,
      gatewayProvider: 'mock' as any,
      gatewayPaymentId: 'pay_123',
    };
  });

  describe('policy management', () => {
    it('should create custom policy', () => {
      const policy = engine.createPolicy({
        name: '30-Day Policy',
        timeLimit: 30,
        maxRefundRatio: 0.8,
        requireReason: true,
        automaticApproval: false,
        conditions: [],
      });

      expect(policy.name).toBe('30-Day Policy');
      expect(policy.timeLimit).toBe(30);
      expect(policy.maxRefundRatio).toBe(0.8);
    });

    it('should update policy', () => {
      const policy = engine.createPolicy({
        name: 'Test Policy',
        timeLimit: 30,
        conditions: [],
      });

      const updated = engine.updatePolicy(policy.id, {
        timeLimit: 60,
      });

      expect(updated.timeLimit).toBe(60);
    });

    it('should delete policy', () => {
      const policy = engine.createPolicy({
        name: 'Test Policy',
        conditions: [],
      });

      engine.deletePolicy(policy.id);
      expect(() => engine.getPolicy(policy.id)).toThrow();
    });

    it('should not modify default policy', () => {
      expect(() => engine.updatePolicy('default', { timeLimit: 60 })).toThrow();
      expect(() => engine.deletePolicy('default')).toThrow();
    });
  });

  describe('policy evaluation', () => {
    it('should evaluate default policy', async () => {
      const eligibility = await engine.evaluateEligibility(mockPayment);
      expect(eligibility.eligible).toBe(true);
      expect(eligibility.policy).toBeDefined();
    });

    it('should check time limit condition', async () => {
      const policy = engine.createPolicy({
        name: '7-Day Policy',
        timeLimit: 7,
        conditions: [],
      });

      // Recent payment should pass
      const recentPayment = {
        ...mockPayment,
        createdAt: new Date(),
      };

      const eligibility = await engine.evaluateEligibility(recentPayment, undefined, policy.id);
      expect(eligibility.conditions.some(c => c.type === 'time_limit' && c.satisfied)).toBe(true);
    });

    it('should check amount limit', async () => {
      const policy = engine.createPolicy({
        name: '50% Policy',
        maxRefundRatio: 0.5,
        conditions: [],
      });

      const eligibility = await engine.evaluateEligibility(mockPayment, 7500n, policy.id);
      expect(eligibility.maxAmount).toBe(5000n); // 50% of $100, but limited to requested amount
    });

    it('should require approval for large amounts', async () => {
      const policy = engine.createPolicy({
        name: 'Approval Policy',
        requireApproval: true,
        conditions: [],
      });

      const eligibility = await engine.evaluateEligibility(mockPayment, undefined, policy.id);
      expect(eligibility.requiresApproval).toBe(true);
    });
  });

  describe('condition evaluation', () => {
    it('should evaluate customer tier condition', async () => {
      const policy = engine.createPolicy({
        name: 'VIP Policy',
        conditions: [
          {
            type: 'customer_tier',
            operator: 'in',
            value: ['gold', 'platinum'],
          },
        ],
      });

      // VIP customer should pass
      const eligibility = await engine.evaluateEligibility(
        mockPayment,
        undefined,
        policy.id,
        { customerTier: 'gold' }
      );

      expect(eligibility.conditions.some(c => c.type === 'customer_tier' && c.satisfied)).toBe(true);
    });

    it('should evaluate product category condition', async () => {
      const policy = engine.createPolicy({
        name: 'No Refund on Electronics',
        conditions: [
          {
            type: 'product_category',
            operator: 'not_equals',
            value: 'electronics',
          },
        ],
      });

      // Electronics should fail
      const eligibility = await engine.evaluateEligibility(
        mockPayment,
        undefined,
        policy.id,
        { productCategory: 'electronics' }
      );

      expect(eligibility.conditions.some(c => c.type === 'product_category' && !c.satisfied)).toBe(true);
    });
  });
});
