// ============================================================================
// Payment Provider Adapters
// ============================================================================

import {
  PaymentMethod,
  PaymentMethodToken,
  Currency,
  PaymentErrorCode,
  CardBrand,
} from './types';

// ==========================================================================
// PROVIDER INTERFACE
// ==========================================================================

export interface PaymentProviderAdapter {
  readonly name: string;
  
  getPaymentMethod(token: PaymentMethodToken): Promise<PaymentMethod | null>;
  
  createPayment(input: ProviderCreatePaymentInput): Promise<ProviderPaymentResult>;
  
  capturePayment(input: ProviderCapturePaymentInput): Promise<ProviderCaptureResult>;
  
  refundPayment(input: ProviderRefundPaymentInput): Promise<ProviderRefundResult>;
  
  verifyWebhookSignature(payload: string, signature: string): boolean;
}

export interface ProviderCreatePaymentInput {
  amount: number;
  currency: Currency;
  paymentMethodToken: PaymentMethodToken;
  capture: boolean;
  idempotencyKey: string;
  metadata?: Record<string, string>;
}

export interface ProviderPaymentResult {
  success: boolean;
  providerPaymentId: string;
  errorCode?: PaymentErrorCode;
  errorMessage?: string;
  retriable?: boolean;
  retryAfter?: number;
  requiresAction?: boolean;
  actionUrl?: string;
}

export interface ProviderCapturePaymentInput {
  providerPaymentId: string;
  amount: number;
  idempotencyKey: string;
}

export interface ProviderCaptureResult {
  success: boolean;
  errorCode?: PaymentErrorCode;
  errorMessage?: string;
  retriable?: boolean;
  retryAfter?: number;
}

export interface ProviderRefundPaymentInput {
  providerPaymentId: string;
  amount: number;
  idempotencyKey: string;
  reason?: string;
}

export interface ProviderRefundResult {
  success: boolean;
  providerRefundId?: string;
  errorCode?: string;
  errorMessage?: string;
  retriable?: boolean;
  retryAfter?: number;
}

// ==========================================================================
// STRIPE PROVIDER
// ==========================================================================

// Stripe API response types
interface StripePaymentMethod {
  type: string;
  card?: {
    brand: string;
    last4: string;
    exp_month: number;
    exp_year: number;
    fingerprint?: string;
  };
}

interface StripePaymentIntent {
  id: string;
  status: string;
  next_action?: {
    redirect_to_url?: {
      url: string;
    };
  };
}

interface StripeError {
  type: string;
  code?: string;
  message?: string;
}

interface StripeErrorResponse {
  error: StripeError;
}

interface StripeRefund {
  id: string;
}

export interface StripeConfig {
  secretKey: string;
  webhookSecret: string;
  apiVersion?: string;
}

export class StripeProvider implements PaymentProviderAdapter {
  readonly name = 'STRIPE';
  private readonly config: StripeConfig;
  
  constructor(config: StripeConfig) {
    this.config = config;
  }
  
  async getPaymentMethod(token: PaymentMethodToken): Promise<PaymentMethod | null> {
    try {
      const response = await this.makeRequest(`/v1/payment_methods/${token}`, 'GET');
      
      if (!response.ok) {
        return null;
      }
      
      const data = await response.json() as StripePaymentMethod;
      
      if (data.type === 'card' && data.card) {
        return {
          type: 'card',
          token,
          brand: this.mapCardBrand(data.card.brand),
          lastFour: data.card.last4,
          expMonth: data.card.exp_month,
          expYear: data.card.exp_year,
          fingerprint: data.card.fingerprint,
        };
      }
      
      return null;
    } catch {
      return null;
    }
  }
  
  async createPayment(input: ProviderCreatePaymentInput): Promise<ProviderPaymentResult> {
    try {
      const response = await this.makeRequest('/v1/payment_intents', 'POST', {
        amount: Math.round(input.amount * 100), // Stripe uses cents
        currency: input.currency.toLowerCase(),
        payment_method: input.paymentMethodToken,
        confirm: true,
        capture_method: input.capture ? 'automatic' : 'manual',
        metadata: input.metadata,
      }, input.idempotencyKey);
      
      if (!response.ok) {
        const errorData = await response.json() as StripeErrorResponse;
        return this.mapStripeError(errorData.error);
      }
      
      const data = await response.json() as StripePaymentIntent;
      
      if (data.status === 'requires_action') {
        return {
          success: false,
          providerPaymentId: data.id,
          errorCode: PaymentErrorCode.AUTHENTICATION_REQUIRED,
          errorMessage: 'Additional authentication required',
          requiresAction: true,
          actionUrl: data.next_action?.redirect_to_url?.url,
        };
      }
      
      return {
        success: true,
        providerPaymentId: data.id,
      };
    } catch (error) {
      return {
        success: false,
        providerPaymentId: '',
        errorCode: PaymentErrorCode.PROVIDER_UNAVAILABLE,
        errorMessage: error instanceof Error ? error.message : 'Provider error',
        retriable: true,
        retryAfter: 30,
      };
    }
  }
  
  async capturePayment(input: ProviderCapturePaymentInput): Promise<ProviderCaptureResult> {
    try {
      const response = await this.makeRequest(
        `/v1/payment_intents/${input.providerPaymentId}/capture`,
        'POST',
        { amount_to_capture: Math.round(input.amount * 100) },
        input.idempotencyKey
      );
      
      if (!response.ok) {
        const data = await response.json() as StripeErrorResponse;
        return {
          success: false,
          errorCode: PaymentErrorCode.PROCESSING_ERROR,
          errorMessage: data.error?.message ?? 'Capture failed',
          retriable: true,
        };
      }
      
      return { success: true };
    } catch (error) {
      return {
        success: false,
        errorCode: PaymentErrorCode.PROVIDER_UNAVAILABLE,
        errorMessage: error instanceof Error ? error.message : 'Provider error',
        retriable: true,
        retryAfter: 30,
      };
    }
  }
  
  async refundPayment(input: ProviderRefundPaymentInput): Promise<ProviderRefundResult> {
    try {
      const response = await this.makeRequest('/v1/refunds', 'POST', {
        payment_intent: input.providerPaymentId,
        amount: Math.round(input.amount * 100),
        reason: input.reason ?? 'requested_by_customer',
      }, input.idempotencyKey);
      
      if (!response.ok) {
        const errorData = await response.json() as StripeErrorResponse;
        return {
          success: false,
          errorCode: errorData.error?.code,
          errorMessage: errorData.error?.message ?? 'Refund failed',
          retriable: errorData.error?.type === 'api_error',
        };
      }
      
      const data = await response.json() as StripeRefund;
      
      return {
        success: true,
        providerRefundId: data.id,
      };
    } catch (error) {
      return {
        success: false,
        errorMessage: error instanceof Error ? error.message : 'Provider error',
        retriable: true,
        retryAfter: 30,
      };
    }
  }
  
  verifyWebhookSignature(payload: string, signature: string): boolean {
    // Stripe signature verification
    // In production, use the official Stripe SDK
    const crypto = require('crypto');
    const parts = signature.split(',');
    const timestamp = parts.find(p => p.startsWith('t='))?.slice(2);
    const sig = parts.find(p => p.startsWith('v1='))?.slice(3);
    
    if (!timestamp || !sig) {
      return false;
    }
    
    const signedPayload = `${timestamp}.${payload}`;
    const expectedSig = crypto
      .createHmac('sha256', this.config.webhookSecret)
      .update(signedPayload)
      .digest('hex');
    
    return crypto.timingSafeEqual(
      Buffer.from(sig),
      Buffer.from(expectedSig)
    );
  }
  
  private async makeRequest(
    path: string,
    method: string,
    body?: Record<string, unknown>,
    idempotencyKey?: string
  ): Promise<Response> {
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${this.config.secretKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Stripe-Version': this.config.apiVersion ?? '2023-10-16',
    };
    
    if (idempotencyKey) {
      headers['Idempotency-Key'] = idempotencyKey;
    }
    
    const response = await fetch(`https://api.stripe.com${path}`, {
      method,
      headers,
      body: body ? new URLSearchParams(this.flattenObject(body)).toString() : undefined,
    });
    
    return response;
  }
  
  private flattenObject(obj: Record<string, unknown>, prefix = ''): Record<string, string> {
    const result: Record<string, string> = {};
    
    for (const [key, value] of Object.entries(obj)) {
      const newKey = prefix ? `${prefix}[${key}]` : key;
      
      if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
        Object.assign(result, this.flattenObject(value as Record<string, unknown>, newKey));
      } else if (value !== undefined) {
        result[newKey] = String(value);
      }
    }
    
    return result;
  }
  
  private mapCardBrand(brand: string): CardBrand {
    const brandMap: Record<string, CardBrand> = {
      'visa': CardBrand.VISA,
      'mastercard': CardBrand.MASTERCARD,
      'amex': CardBrand.AMEX,
      'discover': CardBrand.DISCOVER,
      'diners': CardBrand.DINERS,
      'jcb': CardBrand.JCB,
      'unionpay': CardBrand.UNIONPAY,
    };
    return brandMap[brand.toLowerCase()] ?? CardBrand.UNKNOWN;
  }
  
  private mapStripeError(error: { type: string; code?: string; message?: string }): ProviderPaymentResult {
    const errorMap: Record<string, PaymentErrorCode> = {
      'card_declined': PaymentErrorCode.CARD_DECLINED,
      'insufficient_funds': PaymentErrorCode.INSUFFICIENT_FUNDS,
      'invalid_card_number': PaymentErrorCode.INVALID_CARD,
      'expired_card': PaymentErrorCode.EXPIRED_CARD,
      'rate_limit': PaymentErrorCode.RATE_LIMITED,
    };
    
    return {
      success: false,
      providerPaymentId: '',
      errorCode: errorMap[error.code ?? ''] ?? PaymentErrorCode.PROCESSING_ERROR,
      errorMessage: error.message ?? 'Payment failed',
      retriable: error.type === 'api_error',
    };
  }
}

// ==========================================================================
// BRAINTREE PROVIDER
// ==========================================================================

export interface BraintreeConfig {
  merchantId: string;
  publicKey: string;
  privateKey: string;
  webhookSecret: string;
  environment: 'sandbox' | 'production';
}

export class BraintreeProvider implements PaymentProviderAdapter {
  readonly name = 'BRAINTREE';
  private readonly config: BraintreeConfig;
  
  constructor(config: BraintreeConfig) {
    this.config = config;
  }
  
  async getPaymentMethod(token: PaymentMethodToken): Promise<PaymentMethod | null> {
    // Braintree implementation
    // In production, use the official Braintree SDK
    return null;
  }
  
  async createPayment(_input: ProviderCreatePaymentInput): Promise<ProviderPaymentResult> {
    // Braintree implementation
    return {
      success: false,
      providerPaymentId: '',
      errorCode: PaymentErrorCode.PROVIDER_UNAVAILABLE,
      errorMessage: 'Braintree not implemented',
    };
  }
  
  async capturePayment(_input: ProviderCapturePaymentInput): Promise<ProviderCaptureResult> {
    return { success: false, errorMessage: 'Braintree not implemented' };
  }
  
  async refundPayment(_input: ProviderRefundPaymentInput): Promise<ProviderRefundResult> {
    return { success: false, errorMessage: 'Braintree not implemented' };
  }
  
  verifyWebhookSignature(_payload: string, _signature: string): boolean {
    return false;
  }
}

// ==========================================================================
// ADYEN PROVIDER
// ==========================================================================

export interface AdyenConfig {
  apiKey: string;
  merchantAccount: string;
  webhookHmacKey: string;
  environment: 'test' | 'live';
}

export class AdyenProvider implements PaymentProviderAdapter {
  readonly name = 'ADYEN';
  private readonly config: AdyenConfig;
  
  constructor(config: AdyenConfig) {
    this.config = config;
  }
  
  async getPaymentMethod(_token: PaymentMethodToken): Promise<PaymentMethod | null> {
    return null;
  }
  
  async createPayment(_input: ProviderCreatePaymentInput): Promise<ProviderPaymentResult> {
    return {
      success: false,
      providerPaymentId: '',
      errorCode: PaymentErrorCode.PROVIDER_UNAVAILABLE,
      errorMessage: 'Adyen not implemented',
    };
  }
  
  async capturePayment(_input: ProviderCapturePaymentInput): Promise<ProviderCaptureResult> {
    return { success: false, errorMessage: 'Adyen not implemented' };
  }
  
  async refundPayment(_input: ProviderRefundPaymentInput): Promise<ProviderRefundResult> {
    return { success: false, errorMessage: 'Adyen not implemented' };
  }
  
  verifyWebhookSignature(_payload: string, _signature: string): boolean {
    return false;
  }
}

// ==========================================================================
// SQUARE PROVIDER
// ==========================================================================

export interface SquareConfig {
  accessToken: string;
  locationId: string;
  webhookSignatureKey: string;
  environment: 'sandbox' | 'production';
}

export class SquareProvider implements PaymentProviderAdapter {
  readonly name = 'SQUARE';
  private readonly config: SquareConfig;
  
  constructor(config: SquareConfig) {
    this.config = config;
  }
  
  async getPaymentMethod(_token: PaymentMethodToken): Promise<PaymentMethod | null> {
    return null;
  }
  
  async createPayment(_input: ProviderCreatePaymentInput): Promise<ProviderPaymentResult> {
    return {
      success: false,
      providerPaymentId: '',
      errorCode: PaymentErrorCode.PROVIDER_UNAVAILABLE,
      errorMessage: 'Square not implemented',
    };
  }
  
  async capturePayment(_input: ProviderCapturePaymentInput): Promise<ProviderCaptureResult> {
    return { success: false, errorMessage: 'Square not implemented' };
  }
  
  async refundPayment(_input: ProviderRefundPaymentInput): Promise<ProviderRefundResult> {
    return { success: false, errorMessage: 'Square not implemented' };
  }
  
  verifyWebhookSignature(_payload: string, _signature: string): boolean {
    return false;
  }
}

// ==========================================================================
// PROVIDER FACTORY
// ==========================================================================

export type ProviderConfig = 
  | { type: 'stripe'; config: StripeConfig }
  | { type: 'braintree'; config: BraintreeConfig }
  | { type: 'adyen'; config: AdyenConfig }
  | { type: 'square'; config: SquareConfig };

export function createProvider(provider: ProviderConfig): PaymentProviderAdapter {
  switch (provider.type) {
    case 'stripe':
      return new StripeProvider(provider.config);
    case 'braintree':
      return new BraintreeProvider(provider.config);
    case 'adyen':
      return new AdyenProvider(provider.config);
    case 'square':
      return new SquareProvider(provider.config);
    default:
      throw new Error(`Unknown provider type`);
  }
}
