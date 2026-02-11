/**
 * Mock gateway adapter for testing
 * @packageDocumentation
 */

import { 
  ChargeRequest, 
  ChargeResponse, 
  Payment, 
  Refund, 
  RefundRequest, 
  CheckoutSession,
  PaymentId,
  PaymentStatus,
  RefundStatus,
  CheckoutStatus,
  Currency,
  GatewayProvider
} from '../types';
import { BaseGatewayAdapter } from './adapter';
import { MockGatewayConfig } from './types';
import { PaymentError, GatewayError } from '../errors';

// ============================================================================
// MOCK GATEWAY ADAPTER
// ============================================================================

export class MockGatewayAdapter extends BaseGatewayAdapter {
  private config: MockGatewayConfig;
  private payments = new Map<string, Payment>();
  private refunds = new Map<string, Refund>();
  private sessions = new Map<string, CheckoutSession>();
  private paymentCounter = 1;
  private refundCounter = 1;
  private sessionCounter = 1;

  constructor(config: MockGatewayConfig) {
    super(config);
    this.config = config;
  }

  protected validateConfig(): void {
    // No validation needed for mock
  }

  // ============================================================================
  // CHARGE OPERATIONS
  // ============================================================================

  protected async doCreateCharge(request: ChargeRequest): Promise<ChargeResponse> {
    await this.simulateLatency();
    
    if (this.shouldFail()) {
      throw new PaymentError('Mock charge failure', 'mock_charge_failed', 'gateway_error');
    }

    const paymentId = `pay_mock_${this.paymentCounter++}`;
    const payment: Payment = {
      id: paymentId,
      customerId: request.customerId,
      amount: request.amount,
      currency: request.currency,
      status: request.capture === false ? PaymentStatus.AUTHORIZED : PaymentStatus.CAPTURED,
      paymentMethodId: request.paymentMethodId,
      description: request.description,
      metadata: request.metadata,
      createdAt: new Date(),
      completedAt: request.capture !== false ? new Date() : undefined,
      capturedAmount: request.capture !== false ? request.amount : 0n,
      authorizedAt: request.capture === false ? new Date() : undefined,
      gatewayProvider: GatewayProvider.MOCK,
      gatewayPaymentId: paymentId,
    };

    this.payments.set(paymentId, payment);

    // Simulate 3D Secure requirement for some cards
    const requiresAction = request.paymentMethodId.includes('3ds') || Math.random() < 0.1;

    return {
      payment,
      requiresAction,
      nextAction: requiresAction ? {
        type: 'redirect_to_url',
        redirectUrl: `https://mock-3ds.example.com/authorize/${paymentId}`,
      } : undefined,
    };
  }

  protected async doCaptureCharge(paymentId: PaymentId, amount?: bigint): Promise<Payment> {
    await this.simulateLatency();
    
    if (this.shouldFail()) {
      throw new PaymentError('Mock capture failure', 'mock_capture_failed', 'gateway_error');
    }

    const payment = this.payments.get(paymentId);
    if (!payment) {
      throw new PaymentError('Payment not found', 'payment_not_found', 'validation_error', { paymentId });
    }

    if (payment.status !== PaymentStatus.AUTHORIZED) {
      throw new PaymentError('Payment is not in authorized state', 'invalid_status', 'validation_error', { paymentId });
    }

    const captureAmount = amount || payment.amount;
    if (captureAmount > payment.amount) {
      throw new PaymentError('Capture amount exceeds authorized amount', 'invalid_amount', 'validation_error', { paymentId });
    }

    payment.status = PaymentStatus.CAPTURED;
    payment.capturedAmount = captureAmount;
    payment.completedAt = new Date();

    return payment;
  }

  protected async doVoidCharge(paymentId: PaymentId): Promise<Payment> {
    await this.simulateLatency();
    
    if (this.shouldFail()) {
      throw new PaymentError('Mock void failure', 'mock_void_failed', 'gateway_error');
    }

    const payment = this.payments.get(paymentId);
    if (!payment) {
      throw new PaymentError('Payment not found', 'payment_not_found', 'validation_error', { paymentId });
    }

    if (payment.status !== PaymentStatus.AUTHORIZED) {
      throw new PaymentError('Payment is not in authorized state', 'invalid_status', 'validation_error', { paymentId });
    }

    payment.status = PaymentStatus.CANCELLED;

    return payment;
  }

  // ============================================================================
  // REFUND OPERATIONS
  // ============================================================================

  protected async doCreateRefund(request: RefundRequest): Promise<Refund> {
    await this.simulateLatency();
    
    if (this.shouldFail()) {
      throw new PaymentError('Mock refund failure', 'mock_refund_failed', 'gateway_error');
    }

    const payment = this.payments.get(request.paymentId);
    if (!payment) {
      throw new PaymentError('Payment not found', 'payment_not_found', 'validation_error');
    }

    if (payment.status !== PaymentStatus.CAPTURED && payment.status !== PaymentStatus.COMPLETED) {
      throw new PaymentError('Payment is not in a refundable state', 'payment_not_refundable', 'validation_error');
    }

    const refundAmount = request.amount || payment.amount;
    const alreadyRefunded = payment.refundAmount || 0n;
    
    if (alreadyRefunded + refundAmount > payment.capturedAmount!) {
      throw new PaymentError('Refund amount exceeds refundable amount', 'refund_amount_exceeds_payment', 'validation_error');
    }

    const refundId = `ref_mock_${this.refundCounter++}`;
    const refund: Refund = {
      id: refundId,
      paymentId: request.paymentId,
      amount: refundAmount,
      currency: payment.currency,
      status: RefundStatus.SUCCEEDED,
      reason: request.reason,
      metadata: request.metadata,
      createdAt: new Date(),
      completedAt: new Date(),
      gatewayRefundId: refundId,
    };

    this.refunds.set(refundId, refund);

    // Update payment
    payment.refundAmount = alreadyRefunded + refundAmount;
    payment.refundedAt = new Date();
    payment.status = payment.refundAmount >= payment.capturedAmount! ? PaymentStatus.REFUNDED : PaymentStatus.PARTIALLY_REFUNDED;

    return refund;
  }

  // ============================================================================
  // PAYMENT RETRIEVAL
  // ============================================================================

  protected async doRetrievePayment(paymentId: PaymentId): Promise<Payment> {
    await this.simulateLatency();
    
    const payment = this.payments.get(paymentId);
    if (!payment) {
      throw new PaymentError('Payment not found', 'payment_not_found', 'validation_error');
    }

    return payment;
  }

  // ============================================================================
  // CHECKOUT SESSION
  // ============================================================================

  protected async doCreateCheckoutSession(session: Omit<CheckoutSession, 'id' | 'gatewaySessionId' | 'createdAt' | 'completedAt'>): Promise<CheckoutSession> {
    await this.simulateLatency();
    
    if (this.shouldFail()) {
      throw new PaymentError('Mock session creation failure', 'mock_session_failed', 'gateway_error');
    }

    const sessionId = `cs_mock_${this.sessionCounter++}`;
    const checkoutSession: CheckoutSession = {
      ...session,
      id: sessionId,
      gatewaySessionId: sessionId,
      createdAt: new Date(),
    };

    this.sessions.set(sessionId, checkoutSession);

    return checkoutSession;
  }

  // ============================================================================
  // WEBHOOK VERIFICATION
  // ============================================================================

  protected doVerifyWebhookSignature(payload: string, signature: string, secret: string): boolean {
    // Mock verification - always return true if signature starts with 'mock_'
    return signature.startsWith('mock_') || signature === 'valid';
  }

  // ============================================================================
  // MOCK UTILITIES
  // ============================================================================

  private async simulateLatency(): Promise<void> {
    const latency = this.config.latency;
    if (latency) {
      const min = latency.min || 100;
      const max = latency.max || 500;
      const delay = Math.random() * (max - min) + min;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  private shouldFail(): boolean {
    if (this.config.alwaysFail) {
      return true;
    }
    
    if (this.config.failureRate) {
      return Math.random() < this.config.failureRate;
    }
    
    return false;
  }

  // ============================================================================
  // TEST HELPERS
  // ============================================================================

  /**
   * Get all stored payments (for testing)
   */
  getStoredPayments(): Map<string, Payment> {
    return new Map(this.payments);
  }

  /**
   * Get all stored refunds (for testing)
   */
  getStoredRefunds(): Map<string, Refund> {
    return new Map(this.refunds);
  }

  /**
   * Get all stored sessions (for testing)
   */
  getStoredSessions(): Map<string, CheckoutSession> {
    return new Map(this.sessions);
  }

  /**
   * Clear all stored data (for testing)
   */
  clearStoredData(): void {
    this.payments.clear();
    this.refunds.clear();
    this.sessions.clear();
    this.paymentCounter = 1;
    this.refundCounter = 1;
    this.sessionCounter = 1;
  }

  /**
   * Simulate a payment status change (for testing webhooks)
   */
  simulatePaymentStatusChange(paymentId: PaymentId, newStatus: PaymentStatus): void {
    const payment = this.payments.get(paymentId);
    if (payment) {
      payment.status = newStatus;
      
      if (newStatus === PaymentStatus.COMPLETED || newStatus === PaymentStatus.CAPTURED) {
        payment.completedAt = new Date();
      } else if (newStatus === PaymentStatus.FAILED) {
        payment.failedAt = new Date();
        payment.failureReason = 'Simulated failure';
      }
    }
  }

  /**
   * Simulate a refund status change (for testing webhooks)
   */
  simulateRefundStatusChange(refundId: string, newStatus: RefundStatus): void {
    const refund = this.refunds.get(refundId);
    if (refund) {
      refund.status = newStatus;
      
      if (newStatus === RefundStatus.SUCCEEDED) {
        refund.completedAt = new Date();
      } else if (newStatus === RefundStatus.FAILED) {
        refund.failureReason = 'Simulated refund failure';
      }
    }
  }

  /**
   * Simulate a checkout session status change (for testing webhooks)
   */
  simulateCheckoutStatusChange(sessionId: string, newStatus: CheckoutStatus): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.status = newStatus;
      
      if (newStatus === CheckoutStatus.COMPLETE) {
        session.completedAt = new Date();
      }
    }
  }

  /**
   * Set custom failure behavior
   */
  setFailureBehavior(options: { alwaysFail?: boolean; failureRate?: number }): void {
    if (options.alwaysFail !== undefined) {
      this.config.alwaysFail = options.alwaysFail;
    }
    if (options.failureRate !== undefined) {
      this.config.failureRate = options.failureRate;
    }
  }

  /**
   * Create a test payment method ID with specific behavior
   */
  createTestPaymentMethodId(options: { 
    type?: 'card' | 'bank' | 'paypal';
    requires3DS?: boolean;
    willFail?: boolean;
  }): string {
    const parts = ['pm_mock'];
    
    if (options.type) {
      parts.push(options.type);
    }
    
    if (options.requires3DS) {
      parts.push('3ds');
    }
    
    if (options.willFail) {
      parts.push('fail');
    }
    
    return parts.join('_');
  }
}
