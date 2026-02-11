/**
 * Base gateway adapter implementation
 * @packageDocumentation
 */

import { 
  GatewayAdapter, 
  GatewayConfig, 
  GatewayResponse, 
  ChargeRequest, 
  ChargeResponse, 
  Payment, 
  Refund, 
  RefundRequest, 
  CheckoutSession,
  PaymentId,
  GatewayProvider,
  PaymentStatus,
  RefundStatus,
  CheckoutStatus
} from '../types';
import { PaymentError, GatewayError, ErrorFactory } from '../errors';
import { GatewayContext, GatewayMiddleware, GatewayMetrics } from './types';

// ============================================================================
// BASE ADAPTER
// ============================================================================

export abstract class BaseGatewayAdapter implements GatewayAdapter {
  protected config: GatewayConfig;
  protected middlewares: GatewayMiddleware[] = [];
  protected metrics: GatewayMetrics[] = [];

  constructor(config: GatewayConfig) {
    this.config = config;
    this.validateConfig();
  }

  // ============================================================================
  // ABSTRACT METHODS
  // ============================================================================

  protected abstract validateConfig(): void;
  protected abstract doCreateCharge(request: ChargeRequest): Promise<GatewayResponse<ChargeResponse>>;
  protected abstract doCaptureCharge(paymentId: PaymentId, amount?: bigint): Promise<GatewayResponse<Payment>>;
  protected abstract doVoidCharge(paymentId: PaymentId): Promise<GatewayResponse<Payment>>;
  protected abstract doCreateRefund(request: RefundRequest): Promise<GatewayResponse<Refund>>;
  protected abstract doRetrievePayment(paymentId: PaymentId): Promise<GatewayResponse<Payment>>;
  protected abstract doCreateCheckoutSession(session: Omit<CheckoutSession, 'id' | 'gatewaySessionId' | 'createdAt' | 'completedAt'>): Promise<GatewayResponse<CheckoutSession>>;
  protected abstract doVerifyWebhookSignature(payload: string, signature: string, secret: string): boolean;

  // ============================================================================
  // PUBLIC METHODS
  // ============================================================================

  async createCharge(request: ChargeRequest): Promise<GatewayResponse<ChargeResponse>> {
    return this.executeWithMiddleware('createCharge', request, () => this.doCreateCharge(request));
  }

  async captureCharge(paymentId: PaymentId, amount?: bigint): Promise<GatewayResponse<Payment>> {
    return this.executeWithMiddleware('captureCharge', { paymentId, amount }, () => this.doCaptureCharge(paymentId, amount));
  }

  async voidCharge(paymentId: PaymentId): Promise<GatewayResponse<Payment>> {
    return this.executeWithMiddleware('voidCharge', { paymentId }, () => this.doVoidCharge(paymentId));
  }

  async createRefund(request: RefundRequest): Promise<GatewayResponse<Refund>> {
    return this.executeWithMiddleware('createRefund', request, () => this.doCreateRefund(request));
  }

  async retrievePayment(paymentId: PaymentId): Promise<GatewayResponse<Payment>> {
    return this.executeWithMiddleware('retrievePayment', { paymentId }, () => this.doRetrievePayment(paymentId));
  }

  async createCheckoutSession(session: Omit<CheckoutSession, 'id' | 'gatewaySessionId' | 'createdAt' | 'completedAt'>): Promise<GatewayResponse<CheckoutSession>> {
    return this.executeWithMiddleware('createCheckoutSession', session, () => this.doCreateCheckoutSession(session));
  }

  verifyWebhookSignature(payload: string, signature: string, secret: string): boolean {
    return this.doVerifyWebhookSignature(payload, signature, secret);
  }

  // ============================================================================
  // MIDDLEWARE MANAGEMENT
  // ============================================================================

  addMiddleware(middleware: GatewayMiddleware): void {
    this.middlewares.push(middleware);
  }

  removeMiddleware(name: string): void {
    this.middlewares = this.middlewares.filter(m => m.name !== name);
  }

  // ============================================================================
  // EXECUTION WITH MIDDLEWARE
  // ============================================================================

  protected async executeWithMiddleware<T>(
    operation: string,
    request: any,
    fn: () => Promise<GatewayResponse<T>>
  ): Promise<GatewayResponse<T>> {
    const context: GatewayContext = {
      provider: this.config.provider,
      operation,
      requestId: this.generateRequestId(),
      timestamp: new Date(),
      config: this.config,
    };

    let processedRequest = request;
    let response: GatewayResponse<T>;
    const startTime = Date.now();

    try {
      // Apply before request middlewares
      for (const middleware of this.middlewares) {
        if (middleware.beforeRequest) {
          processedRequest = await middleware.beforeRequest(processedRequest, context);
        }
      }

      // Execute the operation
      response = await fn();

      // Apply after response middlewares
      for (const middleware of this.middlewares) {
        if (middleware.afterResponse) {
          response = await middleware.afterResponse(response, context);
        }
      }

      // Record metrics
      this.recordMetrics({
        operation,
        provider: this.config.provider,
        duration: Date.now() - startTime,
        success: response.success,
        metadata: { requestId: context.requestId },
      });

      return response;

    } catch (error) {
      // Apply error middlewares
      for (const middleware of this.middlewares) {
        if (middleware.onError) {
          await middleware.onError(error as Error, context);
        }
      }

      // Record error metrics
      this.recordMetrics({
        operation,
        provider: this.config.provider,
        duration: Date.now() - startTime,
        success: false,
        errorCode: error instanceof PaymentError ? error.code : 'unknown',
        metadata: { requestId: context.requestId },
      });

      // Convert to GatewayResponse
      if (error instanceof PaymentError) {
        return {
          success: false,
          error: {
            code: error.code,
            message: error.message,
            type: error.type,
          },
        };
      }

      // Wrap unknown errors
      return {
        success: false,
        error: {
          code: 'unknown_error',
          message: error instanceof Error ? error.message : 'Unknown error occurred',
        },
      };
    }
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  protected generateRequestId(): string {
    return `${this.config.provider}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  protected recordMetrics(metrics: GatewayMetrics): void {
    this.metrics.push(metrics);
    
    // Keep only last 1000 metrics
    if (this.metrics.length > 1000) {
      this.metrics = this.metrics.slice(-1000);
    }
  }

  getMetrics(): GatewayMetrics[] {
    return [...this.metrics];
  }

  clearMetrics(): void {
    this.metrics = [];
  }

  // ============================================================================
  // STATUS MAPPING HELPERS
  // ============================================================================

  protected mapPaymentStatus(status: string): PaymentStatus {
    const statusMap: Record<string, PaymentStatus> = {
      // Stripe statuses
      'requires_payment_method': PaymentStatus.PENDING,
      'requires_confirmation': PaymentStatus.PENDING,
      'requires_action': PaymentStatus.REQUIRES_ACTION,
      'processing': PaymentStatus.PROCESSING,
      'requires_capture': PaymentStatus.AUTHORIZED,
      'succeeded': PaymentStatus.CAPTURED,
      'canceled': PaymentStatus.CANCELLED,
      
      // PayPal statuses
      'created': PaymentStatus.PENDING,
      'approved': PaymentStatus.AUTHORIZED,
      'completed': PaymentStatus.CAPTURED,
      'failed': PaymentStatus.FAILED,
      
      // Generic mappings
      'pending': PaymentStatus.PENDING,
      'authorized': PaymentStatus.AUTHORIZED,
      'captured': PaymentStatus.CAPTURED,
      'completed': PaymentStatus.COMPLETED,
      'failed': PaymentStatus.FAILED,
      'cancelled': PaymentStatus.CANCELLED,
      'disputed': PaymentStatus.DISPUTED,
    };

    return statusMap[status] || PaymentStatus.PENDING;
  }

  protected mapRefundStatus(status: string): RefundStatus {
    const statusMap: Record<string, RefundStatus> = {
      'pending': RefundStatus.PENDING,
      'succeeded': RefundStatus.SUCCEEDED,
      'failed': RefundStatus.FAILED,
      'cancelled': RefundStatus.CANCELLED,
      'processing': RefundStatus.PROCESSING,
    };

    return statusMap[status] || RefundStatus.PENDING;
  }

  protected mapCheckoutStatus(status: string): CheckoutStatus {
    const statusMap: Record<string, CheckoutStatus> = {
      'open': CheckoutStatus.OPEN,
      'expired': CheckoutStatus.EXPIRED,
      'complete': CheckoutStatus.COMPLETE,
      'processing': CheckoutStatus.PROCESSING,
    };

    return statusMap[status] || CheckoutStatus.OPEN;
  }

  // ============================================================================
  // ERROR HANDLING
  // ============================================================================

  protected handleError(error: any, paymentId?: PaymentId): GatewayResponse<never> {
    if (error instanceof PaymentError) {
      return {
        success: false,
        error: {
          code: error.code,
          message: error.message,
          type: error.type,
          param: error.param,
        },
      };
    }

    // Try to extract gateway error information
    if (error.type && error.message) {
      return ErrorFactory.fromGatewayError(this.config.provider, error, paymentId);
    }

    // Unknown error
    return {
      success: false,
      error: {
        code: 'unknown_error',
        message: error.message || 'Unknown error occurred',
      },
    };
  }
}

// ============================================================================
// MOCK GATEWAY ADAPTER
// ============================================================================

export class MockGatewayAdapter extends BaseGatewayAdapter {
  private payments = new Map<string, Payment>();
  private refunds = new Map<string, Refund>();
  private sessions = new Map<string, CheckoutSession>();
  private paymentCounter = 1;
  private refundCounter = 1;
  private sessionCounter = 1;

  protected validateConfig(): void {
    // Mock adapter doesn't need validation
  }

  protected async doCreateCharge(request: ChargeRequest): Promise<GatewayResponse<ChargeResponse>> {
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

    return {
      success: true,
      data: {
        payment,
        requiresAction: false,
      },
    };
  }

  protected async doCaptureCharge(paymentId: PaymentId, amount?: bigint): Promise<GatewayResponse<Payment>> {
    const payment = this.payments.get(paymentId);
    if (!payment) {
      return {
        success: false,
        error: {
          code: 'payment_not_found',
          message: 'Payment not found',
        },
      };
    }

    if (payment.status !== PaymentStatus.AUTHORIZED) {
      return {
        success: false,
        error: {
          code: 'invalid_status',
          message: 'Payment is not in authorized state',
        },
      };
    }

    const captureAmount = amount || payment.amount;
    if (captureAmount > payment.amount) {
      return {
        success: false,
        error: {
          code: 'invalid_amount',
          message: 'Capture amount exceeds authorized amount',
        },
      };
    }

    payment.status = PaymentStatus.CAPTURED;
    payment.capturedAmount = captureAmount;
    payment.completedAt = new Date();

    return {
      success: true,
      data: payment,
    };
  }

  protected async doVoidCharge(paymentId: PaymentId): Promise<GatewayResponse<Payment>> {
    const payment = this.payments.get(paymentId);
    if (!payment) {
      return {
        success: false,
        error: {
          code: 'payment_not_found',
          message: 'Payment not found',
        },
      };
    }

    if (payment.status !== PaymentStatus.AUTHORIZED) {
      return {
        success: false,
        error: {
          code: 'invalid_status',
          message: 'Payment is not in authorized state',
        },
      };
    }

    payment.status = PaymentStatus.CANCELLED;

    return {
      success: true,
      data: payment,
    };
  }

  protected async doCreateRefund(request: RefundRequest): Promise<GatewayResponse<Refund>> {
    const payment = this.payments.get(request.paymentId);
    if (!payment) {
      return {
        success: false,
        error: {
          code: 'payment_not_found',
          message: 'Payment not found',
        },
      };
    }

    if (payment.status !== PaymentStatus.CAPTURED) {
      return {
        success: false,
        error: {
          code: 'payment_not_refundable',
          message: 'Payment is not in a refundable state',
        },
      };
    }

    const refundAmount = request.amount || payment.amount;
    const alreadyRefunded = payment.refundAmount || 0n;
    
    if (alreadyRefunded + refundAmount > payment.capturedAmount!) {
      return {
        success: false,
        error: {
          code: 'refund_amount_exceeds_payment',
          message: 'Refund amount exceeds refundable amount',
        },
      };
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

    return {
      success: true,
      data: refund,
    };
  }

  protected async doRetrievePayment(paymentId: PaymentId): Promise<GatewayResponse<Payment>> {
    const payment = this.payments.get(paymentId);
    if (!payment) {
      return {
        success: false,
        error: {
          code: 'payment_not_found',
          message: 'Payment not found',
        },
      };
    }

    return {
      success: true,
      data: payment,
    };
  }

  protected async doCreateCheckoutSession(session: Omit<CheckoutSession, 'id' | 'gatewaySessionId' | 'createdAt' | 'completedAt'>): Promise<GatewayResponse<CheckoutSession>> {
    const sessionId = `cs_mock_${this.sessionCounter++}`;
    const checkoutSession: CheckoutSession = {
      ...session,
      id: sessionId,
      gatewaySessionId: sessionId,
      createdAt: new Date(),
    };

    this.sessions.set(sessionId, checkoutSession);

    return {
      success: true,
      data: checkoutSession,
    };
  }

  protected doVerifyWebhookSignature(payload: string, signature: string, secret: string): boolean {
    // Mock verification - always return true
    return true;
  }
}
