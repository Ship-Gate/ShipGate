/**
 * PayPal gateway adapter implementation
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
  GatewayResponse
} from '../types';
import { BaseGatewayAdapter } from './adapter';
import { PaypalConfig } from './types';
import { GatewayError, ValidationError } from '../errors';

// ============================================================================
// PAYPAL ADAPTER
// ============================================================================

export class PaypalGatewayAdapter extends BaseGatewayAdapter {
  private clientId: string;
  private clientSecret: string;
  private webhookSecret?: string;
  private baseUrl: string;

  constructor(config: PaypalConfig) {
    super(config);
    this.clientId = config.clientId;
    this.clientSecret = config.clientSecret;
    this.webhookSecret = config.webhookSecret;
    this.baseUrl = config.sandbox 
      ? 'https://api-m.sandbox.paypal.com'
      : 'https://api-m.paypal.com';
  }

  protected validateConfig(): void {
    if (!this.clientId) {
      throw new ValidationError('Client ID is required', 'clientId', null, 'required');
    }

    if (!this.clientSecret) {
      throw new ValidationError('Client secret is required', 'clientSecret', null, 'required');
    }
  }

  // ============================================================================
  // CHARGE OPERATIONS
  // ============================================================================

  protected async doCreateCharge(request: ChargeRequest): Promise<GatewayResponse<ChargeResponse>> {
    // Create PayPal order
    const order = await this.createOrder(request);
    
    // Convert to our Payment format
    const payment = this.mapPaypalOrder(order);

    const response: ChargeResponse = {
      payment,
      requiresAction: order.status === 'CREATED',
      nextAction: order.status === 'CREATED' ? {
        type: 'redirect_to_url',
        redirectUrl: order.links?.find((l: any) => l.rel === 'approve')?.href,
      } : undefined,
    };

    return {
      success: true,
      data: response,
    };
  }

  protected async doCaptureCharge(paymentId: PaymentId, amount?: bigint): Promise<GatewayResponse<Payment>> {
    const capture = await this.captureOrder(paymentId, amount);
    const payment = this.mapPaypalCapture(capture);
    
    return {
      success: true,
      data: payment,
    };
  }

  protected async doVoidCharge(paymentId: PaymentId): Promise<GatewayResponse<Payment>> {
    const order = await this.voidOrder(paymentId);
    const payment = this.mapPaypalOrder(order);
    
    return {
      success: true,
      data: payment,
    };
  }

  // ============================================================================
  // REFUND OPERATIONS
  // ============================================================================

  protected async doCreateRefund(request: RefundRequest): Promise<GatewayResponse<Refund>> {
    const refund = await this.createPaypalRefund(request);
    const refundData = this.mapPaypalRefund(refund);
    
    return {
      success: true,
      data: refundData,
    };
  }

  // ============================================================================
  // PAYMENT RETRIEVAL
  // ============================================================================

  protected async doRetrievePayment(paymentId: PaymentId): Promise<Payment> {
    const order = await this.retrieveOrder(paymentId);
    return this.mapPaypalOrder(order);
  }

  // ============================================================================
  // CHECKOUT SESSION
  // ============================================================================

  protected async doCreateCheckoutSession(session: Omit<CheckoutSession, 'id' | 'gatewaySessionId' | 'createdAt' | 'completedAt'>): Promise<GatewayResponse<CheckoutSession>> {
    const order = await this.createOrderFromSession(session);
    const checkoutSession = this.mapPaypalCheckoutSession(order);
    
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

    try {
      // PayPal uses a different signature format
      // The signature is a base64-encoded JSON object
      const signatureData = JSON.parse(Buffer.from(signature, 'base64').toString());
      
      // Verify the algorithm
      if (signatureData.alg !== 'SHA256withRSA') {
        return false;
      }

      // Import crypto for signature verification
      const crypto = require('crypto');
      
      // Create verifier
      const verifier = crypto.createVerify('RSA-SHA256');
      verifier.update(payload, 'utf8');
      
      // Verify with public key (from PayPal API or stored)
      // In a real implementation, you'd fetch the public key from PayPal's cert URL
      const publicKey = this.getPaypalPublicKey();
      
      return verifier.verify(publicKey, signatureData.signature, 'base64');
      
    } catch (error) {
      return false;
    }
  }

  // ============================================================================
  // PAYPAL API METHODS (MOCK IMPLEMENTATIONS)
  // ============================================================================

  private async createOrder(request: ChargeRequest): Promise<any> {
    // Mock PayPal order creation
    const orderId = `ORDER-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
    
    return {
      id: orderId,
      status: 'CREATED',
      intent: 'CAPTURE',
      purchase_units: [{
        reference_id: request.paymentMethodId,
        amount: {
          currency_code: request.currency,
          value: (Number(request.amount) / 100).toFixed(2),
        },
        description: request.description,
        custom_id: request.metadata?.custom_id,
      }],
      payer: {
        name: { given_name: 'John', surname: 'Doe' },
        email_address: 'customer@example.com',
        payer_id: 'CUSTOMER-PAYER-ID',
      },
      create_time: new Date().toISOString(),
      links: [
        {
          href: `${this.baseUrl}/v2/checkout/orders/${orderId}`,
          rel: 'self',
          method: 'GET',
        },
        {
          href: `${this.baseUrl}/v2/checkout/orders/${orderId}/capture`,
          rel: 'capture',
          method: 'POST',
        },
        {
          href: `https://www.sandbox.paypal.com/checkoutnow?token=${orderId}`,
          rel: 'approve',
          method: 'GET',
        },
      ],
    };
  }

  private async captureOrder(orderId: PaymentId, amount?: bigint): Promise<any> {
    // Mock PayPal capture
    return {
      id: orderId,
      status: 'COMPLETED',
      purchase_units: [{
        payments: {
          captures: [{
            id: `CAPTURE-${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
            status: 'COMPLETED',
            amount: {
              currency_code: 'USD',
              value: amount ? (Number(amount) / 100).toFixed(2) : '10.00',
            },
            final_capture: true,
            create_time: new Date().toISOString(),
            update_time: new Date().toISOString(),
          }],
        },
      }],
    };
  }

  private async voidOrder(orderId: PaymentId): Promise<any> {
    // Mock PayPal void
    return {
      id: orderId,
      status: 'VOIDED',
      purchase_units: [{
        payments: {
          captures: [],
        },
      }],
    };
  }

  private async createPaypalRefund(request: RefundRequest): Promise<any> {
    // Mock PayPal refund
    return {
      id: `REFUND-${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
      status: 'COMPLETED',
      amount: {
        currency_code: 'USD',
        value: (Number(request.amount || 1000) / 100).toFixed(2),
      },
      note_to_payer: request.reason,
      create_time: new Date().toISOString(),
      update_time: new Date().toISOString(),
    };
  }

  private async retrieveOrder(orderId: PaymentId): Promise<any> {
    // Mock PayPal retrieve
    return {
      id: orderId,
      status: 'APPROVED',
      intent: 'CAPTURE',
      purchase_units: [{
        payments: {
          captures: [{
            id: `CAPTURE-${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
            status: 'COMPLETED',
            amount: {
              currency_code: 'USD',
              value: '10.00',
            },
          }],
        },
      }],
      create_time: new Date().toISOString(),
    };
  }

  private async createOrderFromSession(session: Omit<CheckoutSession, 'id' | 'gatewaySessionId' | 'createdAt' | 'completedAt'>): Promise<any> {
    // Create order from checkout session data
    const orderId = `ORDER-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
    
    return {
      id: orderId,
      status: 'CREATED',
      intent: 'CAPTURE',
      purchase_units: [{
        amount: {
          currency_code: session.currency,
          value: session.amount ? (Number(session.amount) / 100).toFixed(2) : '0.00',
        },
      }],
      application_context: {
        return_url: session.successUrl,
        cancel_url: session.cancelUrl,
      },
      create_time: new Date().toISOString(),
      links: [
        {
          href: `https://www.sandbox.paypal.com/checkoutnow?token=${orderId}`,
          rel: 'approve',
          method: 'GET',
        },
      ],
    };
  }

  // ============================================================================
  // MAPPING HELPERS
  // ============================================================================

  private mapPaypalOrder(order: any): Payment {
    const capture = order.purchase_units?.[0]?.payments?.captures?.[0];
    
    return {
      id: order.id,
      customerId: order.payer?.payer_id,
      amount: BigInt(Math.round(parseFloat(order.purchase_units?.[0]?.amount?.value || '0') * 100)),
      currency: order.purchase_units?.[0]?.amount?.currency_code?.toUpperCase() as Currency || 'USD',
      status: this.mapPaymentStatus(order.status),
      paymentMethodId: order.purchase_units?.[0]?.reference_id,
      description: order.purchase_units?.[0]?.description,
      metadata: {
        paypal_payer_id: order.payer?.payer_id,
        paypal_email: order.payer?.email_address,
      },
      createdAt: new Date(order.create_time),
      completedAt: capture?.status === 'COMPLETED' ? new Date(capture.create_time) : undefined,
      failedAt: order.status === 'FAILED' ? new Date(order.create_time) : undefined,
      capturedAmount: capture ? BigInt(Math.round(parseFloat(capture.amount.value) * 100)) : 0n,
      gatewayProvider: 'paypal' as any,
      gatewayPaymentId: order.id,
    };
  }

  private mapPaypalCapture(capture: any): Payment {
    const captureData = capture.purchase_units?.[0]?.payments?.captures?.[0];
    
    return {
      id: capture.id,
      amount: BigInt(Math.round(parseFloat(captureData.amount.value) * 100)),
      currency: captureData.amount.currency_code?.toUpperCase() as Currency || 'USD',
      status: this.mapPaymentStatus(capture.status),
      paymentMethodId: capture.purchase_units?.[0]?.reference_id,
      createdAt: new Date(capture.create_time || new Date()),
      completedAt: new Date(captureData.create_time),
      capturedAmount: BigInt(Math.round(parseFloat(captureData.amount.value) * 100)),
      gatewayProvider: 'paypal' as any,
      gatewayPaymentId: capture.id,
    };
  }

  private mapPaypalRefund(refund: any): Refund {
    return {
      id: refund.id,
      paymentId: refund.parent_payment || 'unknown',
      amount: BigInt(Math.round(parseFloat(refund.amount.value) * 100)),
      currency: refund.amount.currency_code?.toUpperCase() as Currency || 'USD',
      status: this.mapRefundStatus(refund.status),
      reason: refund.note_to_payer,
      createdAt: new Date(refund.create_time),
      completedAt: refund.status === 'COMPLETED' ? new Date(refund.update_time) : undefined,
      gatewayRefundId: refund.id,
    };
  }

  private mapPaypalCheckoutSession(order: any): CheckoutSession {
    return {
      id: order.id,
      status: this.mapCheckoutStatus(order.status),
      currency: order.purchase_units?.[0]?.amount?.currency_code?.toUpperCase() as Currency || 'USD',
      amount: BigInt(Math.round(parseFloat(order.purchase_units?.[0]?.amount?.value || '0') * 100)),
      successUrl: order.application_context?.return_url,
      cancelUrl: order.application_context?.cancel_url,
      expiresAt: new Date(Date.now() + 3 * 60 * 60 * 1000), // 3 hours from now
      createdAt: new Date(order.create_time),
      gatewayProvider: 'paypal' as any,
      gatewaySessionId: order.id,
    };
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  private getPaypalPublicKey(): string {
    // In a real implementation, you would:
    // 1. Fetch the certificate from PayPal's API
    // 2. Extract the public key
    // 3. Cache it for future use
    
    // Mock public key for demonstration
    return `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAwR2KJtJ8H9K8tw9kQhG
... (mock key)
-----END PUBLIC KEY-----`;
  }
}
