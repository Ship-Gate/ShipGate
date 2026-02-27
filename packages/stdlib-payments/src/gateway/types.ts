/**
 * Gateway adapter types
 * @packageDocumentation
 */

import { GatewayAdapter, GatewayConfig, GatewayResponse, ChargeRequest, ChargeResponse, Payment, Refund, RefundRequest, CheckoutSession, GatewayProvider } from '../types';

// ============================================================================
// GATEWAY-SPECIFIC TYPES
// ============================================================================

export interface StripeConfig extends GatewayConfig {
  provider: GatewayProvider.STRIPE;
  apiKey: string;
  webhookSecret?: string;
  apiVersion?: string;
  connectAccountId?: string;
  appInfo?: {
    name: string;
    version?: string;
    url?: string;
  };
}

export interface PaypalConfig extends GatewayConfig {
  provider: GatewayProvider.PAYPAL;
  clientId: string;
  clientSecret: string;
  webhookSecret?: string;
  sandbox?: boolean;
}

export interface MockGatewayConfig extends GatewayConfig {
  provider: GatewayProvider.MOCK;
  latency?: {
    min?: number;
    max?: number;
  };
  failureRate?: number; // 0.0 to 1.0
  alwaysFail?: boolean;
  autoCapture?: boolean;
}

// ============================================================================
// GATEWAY REQUEST/RESPONSE TYPES
// ============================================================================

export interface CreateChargeRequest extends ChargeRequest {
  confirmationMethod?: 'automatic' | 'manual';
  setupFutureUsage?: 'off_session' | 'on_session';
  offSession?: boolean;
  statementDescriptor?: string;
  receiptEmail?: string;
  shipping?: {
    address: {
      line1: string;
      line2?: string;
      city: string;
      state?: string;
      postal_code: string;
      country: string;
    };
    name: string;
    carrier?: string;
    trackingNumber?: string;
  };
}

export interface CreateChargeResponse extends ChargeResponse {
  gatewayResponse?: any;
  livemode?: boolean;
  paymentIntent?: any;
  charges?: any[];
}

export interface CaptureRequest {
  amountToCapture?: bigint;
  statementDescriptor?: string;
}

export interface VoidRequest {
  reason?: string;
  cancellationReason?: 'duplicate' | 'fraudulent' | 'requested_by_customer' | 'abandoned';
}

export interface UpdatePaymentRequest {
  metadata?: Record<string, string>;
  description?: string;
}

export interface CreateRefundRequest extends RefundRequest {
  reason?: 'duplicate' | 'fraudulent' | 'requested_by_customer' | 'expired_uncaptured_charge';
  reverseTransfer?: boolean;
  refundApplicationFee?: boolean;
}

export interface CreateCheckoutRequest {
  mode: 'payment' | 'setup' | 'subscription';
  paymentMethodTypes?: string[];
  lineItems?: CheckoutLineItemRequest[];
  allowPromotionCodes?: boolean;
  billingAddressCollection?: 'auto' | 'required';
  customerCreation?: 'auto' | 'always';
  locale?: string;
  submitType?: 'auto' | 'book' | 'donate' | 'pay';
  clientReferenceId?: string;
  customerEmail?: string;
  paymentIntentData?: {
    setupFutureUsage?: 'off_session' | 'on_session';
    receiptEmail?: string;
    shipping?: any;
    description?: string;
    metadata?: Record<string, string>;
  };
  subscriptionData?: {
    trialFromPlan?: boolean;
    trialPeriodDays?: number;
    metadata?: Record<string, string>;
  };
}

export interface CheckoutLineItemRequest {
  name: string;
  description?: string;
  images?: string[];
  amount: bigint;
  currency: string;
  quantity: number;
  taxRates?: string[];
}

// ============================================================================
// WEBHOOK TYPES
// ============================================================================

export interface WebhookEvent {
  id: string;
  object: string;
  api_version?: string;
  created: number;
  data: {
    object: any;
    previous_attributes?: any;
  };
  livemode: boolean;
  pending_webhooks: number;
  request?: {
    id?: string;
    idempotency_key?: string;
  };
  type: string;
}

export interface WebhookVerification {
  signature: string;
  timestamp: string;
  payload: string;
  secret: string;
}

// ============================================================================
// GATEWAY CAPABILITIES
// ============================================================================

export interface GatewayCapabilities {
  supportedPaymentMethods: string[];
  supportedCurrencies: string[];
  supportsCheckout: boolean;
  supportsSubscriptions: boolean;
  supportsConnect: boolean;
  supportsDisputes: boolean;
  supportsFraudDetection: boolean;
  supports3DSecure: boolean;
  supportsApplePay: boolean;
  supportsGooglePay: boolean;
  requiresSeparateCapture: boolean;
  maxRefundDays?: number;
  minAmount?: Record<string, bigint>;
  maxAmount?: Record<string, bigint>;
}

// ============================================================================
// GATEWAY METADATA
// ============================================================================

export interface GatewayMetadata {
  name: string;
  version: string;
  capabilities: GatewayCapabilities;
  fees?: {
    transaction?: {
      fixed?: bigint;
      percentage?: number;
      currency?: string;
    };
    refund?: {
      fixed?: bigint;
      percentage?: number;
      currency?: string;
    };
    chargeback?: {
      fixed?: bigint;
      currency?: string;
    };
  };
  documentation?: {
    api?: string;
    webhooks?: string;
    sdk?: string;
  };
}

// ============================================================================
// GATEWAY FACTORY TYPES
// ============================================================================

export interface GatewayFactory {
  create(config: GatewayConfig): GatewayAdapter;
  getMetadata(provider: string): GatewayMetadata;
  validateConfig(config: GatewayConfig): Promise<boolean>;
}

export interface GatewayRegistry {
  register(provider: string, factory: GatewayFactory): void;
  create(config: GatewayConfig): Promise<GatewayAdapter>;
  getSupportedProviders(): string[];
  getMetadata(provider: string): GatewayMetadata | null;
}

// ============================================================================
// MIDDLEWARE TYPES
// ============================================================================

export interface GatewayMiddleware {
  name: string;
  beforeRequest?(request: any, context: GatewayContext): Promise<any>;
  afterResponse?(response: any, context: GatewayContext): Promise<any>;
  onError?(error: Error, context: GatewayContext): Promise<void>;
}

export interface GatewayContext {
  provider: string;
  operation: string;
  requestId: string;
  timestamp: Date;
  config: GatewayConfig;
  metadata?: Record<string, any>;
}

// ============================================================================
// MONITORING TYPES
// ============================================================================

export interface GatewayMetrics {
  operation: string;
  provider: string;
  duration: number;
  success: boolean;
  errorCode?: string;
  retryCount?: number;
  metadata?: Record<string, any>;
}

export interface GatewayMonitor {
  recordMetrics(metrics: GatewayMetrics): void;
  getMetrics(filter?: {
    provider?: string;
    operation?: string;
    from?: Date;
    to?: Date;
  }): GatewayMetrics[];
  clearMetrics(): void;
}
