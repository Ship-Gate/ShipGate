/**
 * Stripe gateway adapter implementation
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
  Currency
} from '../types';
import { BaseGatewayAdapter } from './adapter';
import { StripeConfig, CreateChargeRequest, CreateCheckoutRequest } from './types';
import { GatewayError, CardError, ValidationError } from '../errors';

// ============================================================================
// STRIPE ADAPTER
// ============================================================================

export class StripeGatewayAdapter extends BaseGatewayAdapter {
  private apiKey: string;
  private webhookSecret?: string;

  constructor(config: StripeConfig) {
    super(config);
    this.apiKey = config.apiKey;
    this.webhookSecret = config.webhookSecret;
  }

  protected validateConfig(): void {
    if (!this.apiKey) {
      throw new ValidationError('API key is required', 'apiKey', null, 'required');
    }

    if (!this.apiKey.startsWith('sk_')) {
      throw new ValidationError('Invalid Stripe API key format', 'apiKey', this.apiKey, 'format');
    }
  }

  // ============================================================================
  // CHARGE OPERATIONS
  // ============================================================================

  protected async doCreateCharge(request: ChargeRequest): Promise<GatewayResponse<ChargeResponse>> {
    // Convert to Stripe PaymentIntent format
    const stripeRequest: CreateChargeRequest = {
      ...request,
      confirmation_method: request.capture === false ? 'manual' : 'automatic',
      setup_future_usage: request.metadata?.setup_future_usage as any,
      statement_descriptor: request.metadata?.statement_descriptor,
      receipt_email: request.metadata?.receipt_email,
    };

    // Call Stripe API (mock implementation)
    const paymentIntent = await this.createPaymentIntent(stripeRequest);

    // Convert back to our format
    const payment = this.mapStripePayment(paymentIntent);
    const requiresAction = paymentIntent.status === 'requires_action';

    const response: ChargeResponse = {
      payment,
      requiresAction,
      nextAction: requiresAction ? {
        type: 'redirect_to_url',
        redirectUrl: paymentIntent.next_action?.redirect_to_url?.url,
      } : undefined,
    };

    return {
      success: true,
      data: response,
    };
  }

  protected async doCaptureCharge(paymentId: PaymentId, amount?: bigint): Promise<GatewayResponse<Payment>> {
    const paymentIntent = await this.capturePaymentIntent(paymentId, amount);
    const payment = this.mapStripePayment(paymentIntent);
    
    return {
      success: true,
      data: payment,
    };
  }

  protected async doVoidCharge(paymentId: PaymentId): Promise<GatewayResponse<Payment>> {
    const paymentIntent = await this.cancelPaymentIntent(paymentId);
    const payment = this.mapStripePayment(paymentIntent);
    
    return {
      success: true,
      data: payment,
    };
  }

  // ============================================================================
  // REFUND OPERATIONS
  // ============================================================================

  protected async doCreateRefund(request: RefundRequest): Promise<GatewayResponse<Refund>> {
    const stripeRefund = await this.createStripeRefund(request);
    const refund = this.mapStripeRefund(stripeRefund);
    
    return {
      success: true,
      data: refund,
    };
  }

  // ============================================================================
  // PAYMENT RETRIEVAL
  // ============================================================================

  protected async doRetrievePayment(paymentId: PaymentId): Promise<Payment> {
    const paymentIntent = await this.retrievePaymentIntent(paymentId);
    return this.mapStripePayment(paymentIntent);
  }

  // ============================================================================
  // CHECKOUT SESSION
  // ============================================================================

  protected async doCreateCheckoutSession(session: Omit<CheckoutSession, 'id' | 'gatewaySessionId' | 'createdAt' | 'completedAt'>): Promise<GatewayResponse<CheckoutSession>> {
    const stripeSession = await this.createStripeCheckoutSession(session);
    const checkoutSession = this.mapStripeCheckoutSession(stripeSession);
    
    return {
      success: true,
      data: checkoutSession,
    };
  }

  // ============================================================================
  // WEBHOOK VERIFICATION
  // ============================================================================

  protected doVerifyWebhookSignature(payload: string, signature: string, secret: string): boolean {
    if (!secret) {
      throw new ValidationError('Webhook secret is required for signature verification', 'webhookSecret', null, 'required');
    }

    // Import crypto for signature verification
    const crypto = require('crypto');

    try {
      // Extract timestamp and signature from the header
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
        return false;
      }

      // Check timestamp tolerance (5 minutes)
      const tolerance = 300; // 5 minutes in seconds
      const now = Math.floor(Date.now() / 1000);
      if (Math.abs(now - parseInt(timestamp)) > tolerance) {
        return false;
      }

      // Construct signed payload
      const signedPayloadString = `${timestamp}.${payload}`;

      // Generate expected signature
      const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(signedPayloadString, 'utf8')
        .digest('hex');

      // Compare signatures securely
      return crypto.timingSafeEqual(
        Buffer.from(signedPayload, 'hex'),
        Buffer.from(expectedSignature, 'hex')
      );

    } catch (error) {
      return false;
    }
  }

  // ============================================================================
  // STRIPE API METHODS (MOCK IMPLEMENTATIONS)
  // ============================================================================

  private async createPaymentIntent(request: CreateChargeRequest): Promise<any> {
    // Mock Stripe API response
    // In a real implementation, this would use Stripe's SDK
    return {
      id: `pi_${Math.random().toString(36).substr(2, 9)}`,
      object: 'payment_intent',
      amount: Number(request.amount),
      currency: request.currency.toLowerCase(),
      status: request.confirmation_method === 'manual' ? 'requires_confirmation' : 'succeeded',
      confirmation_method: request.confirmation_method,
      payment_method: request.paymentMethodId,
      customer: request.customerId,
      description: request.description,
      metadata: request.metadata,
      created: Math.floor(Date.now() / 1000),
      charges: {
        data: request.confirmation_method === 'automatic' ? [{
          id: `ch_${Math.random().toString(36).substr(2, 9)}`,
          amount: Number(request.amount),
          currency: request.currency.toLowerCase(),
          status: 'succeeded',
          created: Math.floor(Date.now() / 1000),
        }] : [],
      },
    };
  }

  private async capturePaymentIntent(paymentId: PaymentId, amount?: bigint): Promise<any> {
    // Mock Stripe capture
    return {
      id: paymentId,
      status: 'succeeded',
      amount_captured: amount ? Number(amount) : undefined,
      charges: {
        data: [{
          id: `ch_${Math.random().toString(36).substr(2, 9)}`,
          amount: amount ? Number(amount) : undefined,
          status: 'succeeded',
          captured: true,
        }],
      },
    };
  }

  private async cancelPaymentIntent(paymentId: PaymentId): Promise<any> {
    // Mock Stripe cancel
    return {
      id: paymentId,
      status: 'canceled',
      cancellation_reason: 'requested_by_customer',
    };
  }

  private async createStripeRefund(request: RefundRequest): Promise<any> {
    // Mock Stripe refund
    return {
      id: `re_${Math.random().toString(36).substr(2, 9)}`,
      object: 'refund',
      amount: Number(request.amount || 0),
      currency: 'usd', // Would get from payment
      payment_intent: request.paymentId,
      reason: request.reason || 'requested_by_customer',
      status: 'succeeded',
      created: Math.floor(Date.now() / 1000),
    };
  }

  private async retrievePaymentIntent(paymentId: PaymentId): Promise<any> {
    // Mock Stripe retrieve
    return {
      id: paymentId,
      status: 'succeeded',
      amount: 2000,
      currency: 'usd',
      created: Math.floor(Date.now() / 1000),
    };
  }

  private async createStripeCheckoutSession(session: Omit<CheckoutSession, 'id' | 'gatewaySessionId' | 'createdAt' | 'completedAt'>): Promise<any> {
    // Mock Stripe Checkout Session
    return {
      id: `cs_${Math.random().toString(36).substr(2, 9)}`,
      object: 'checkout.session',
      mode: 'payment',
      payment_status: 'unpaid',
      status: 'open',
      url: `https://checkout.stripe.com/pay/${Math.random().toString(36).substr(2, 9)}`,
      success_url: session.successUrl,
      cancel_url: session.cancelUrl,
      customer: session.customerId,
      payment_intent: null,
      created: Math.floor(Date.now() / 1000),
      expires_at: Math.floor(session.expiresAt.getTime() / 1000),
    };
  }

  // ============================================================================
  // MAPPING HELPERS
  // ============================================================================

  private mapStripePayment(paymentIntent: any): Payment {
    const charge = paymentIntent.charges?.data?.[0];
    
    return {
      id: paymentIntent.id,
      customerId: paymentIntent.customer,
      amount: BigInt(paymentIntent.amount),
      currency: paymentIntent.currency.toUpperCase() as Currency,
      status: this.mapPaymentStatus(paymentIntent.status),
      paymentMethodId: paymentIntent.payment_method,
      description: paymentIntent.description,
      metadata: paymentIntent.metadata,
      createdAt: new Date(paymentIntent.created * 1000),
      completedAt: charge?.captured ? new Date(charge.created * 1000) : undefined,
      failedAt: paymentIntent.status === 'requires_payment_method' ? new Date(paymentIntent.created * 1000) : undefined,
      failureReason: paymentIntent.last_payment_error?.message,
      refundAmount: paymentIntent.amount_refunded ? BigInt(paymentIntent.amount_refunded) : undefined,
      refundedAt: paymentIntent.amount_refunded && paymentIntent.amount_refunded > 0 ? new Date() : undefined,
      capturedAmount: paymentIntent.amount_captured ? BigInt(paymentIntent.amount_captured) : 0n,
      authorizedAt: paymentIntent.status === 'requires_capture' ? new Date(paymentIntent.created * 1000) : undefined,
      gatewayProvider: 'stripe' as any,
      gatewayPaymentId: paymentIntent.id,
    };
  }

  private mapStripeRefund(refund: any): Refund {
    return {
      id: refund.id,
      paymentId: refund.payment_intent,
      amount: BigInt(refund.amount),
      currency: refund.currency.toUpperCase() as Currency,
      status: this.mapRefundStatus(refund.status),
      reason: refund.reason,
      metadata: refund.metadata,
      createdAt: new Date(refund.created * 1000),
      completedAt: refund.status === 'succeeded' ? new Date(refund.created * 1000) : undefined,
      gatewayRefundId: refund.id,
    };
  }

  private mapStripeCheckoutSession(session: any): CheckoutSession {
    return {
      id: session.id,
      status: this.mapCheckoutStatus(session.status),
      currency: session.currency?.toUpperCase() as Currency || 'USD',
      amount: session.amount_total ? BigInt(session.amount_total) : undefined,
      customerId: session.customer,
      successUrl: session.success_url,
      cancelUrl: session.cancel_url,
      expiresAt: new Date(session.expires_at * 1000),
      createdAt: new Date(session.created * 1000),
      gatewayProvider: 'stripe' as any,
      gatewaySessionId: session.id,
      metadata: session.metadata,
    };
  }
}
