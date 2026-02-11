/**
 * @packageDocumentation
 * @isl-lang/stdlib-payments
 * 
 * Payment processing library with support for multiple gateways,
 * checkout flows, charges, refunds, and webhooks.
 */

// ============================================================================
// CORE TYPES
// ============================================================================

export * from './types';

// ============================================================================
// MONEY UTILITIES
// ============================================================================

export * from './money';

// ============================================================================
// ERRORS
// ============================================================================

export * from './errors';

// ============================================================================
// GATEWAY ADAPTERS
// ============================================================================

export * from './gateway/types';
export * from './gateway/adapter';
export * from './gateway/stripe';
export * from './gateway/paypal';
export * from './gateway/mock';

// ============================================================================
// CHECKOUT
// ============================================================================

export * from './checkout/types';
export * from './checkout/cart';
export * from './checkout/flow';
export * from './checkout/session';

// ============================================================================
// CHARGES
// ============================================================================

export * from './charges/types';
export * from './charges/processor';
export * from './charges/receipt';

// ============================================================================
// REFUNDS
// ============================================================================

export * from './refunds/types';
export * from './refunds/processor';
export * from './refunds/policy';

// ============================================================================
// WEBHOOKS
// ============================================================================

export * from './webhooks/types';
export * from './webhooks/verifier';
export * from './webhooks/handler';

// ============================================================================
// IDEMPOTENCY
// ============================================================================

export * from './idempotency';

// ============================================================================
// MAIN PAYMENTS CLASS
// ============================================================================

import { GatewayAdapter, GatewayConfig, GatewayProvider } from './types';
import { StripeGatewayAdapter } from './gateway/stripe';
import { PaypalGatewayAdapter } from './gateway/paypal';
import { MockGatewayAdapter } from './gateway/mock';
import { ChargesProcessor } from './charges/processor';
import { RefundsProcessor } from './refunds/processor';
import { RefundPolicyEngine } from './refunds/policy';
import { CheckoutSessionManager } from './checkout/session';
import { DefaultWebhookHandlerRegistry, PaymentIntentHandler, ChargeHandler, CheckoutSessionHandler } from './webhooks/handler';
import { WebhookVerifier } from './webhooks/verifier';
import { IdempotencyManager } from './idempotency';

/**
 * Main payments client
 */
export class PaymentsClient {
  private gateways: Map<GatewayProvider, GatewayAdapter> = new Map();
  private idempotency: IdempotencyManager;
  private charges: ChargesProcessor;
  private refunds: RefundsProcessor;
  private policyEngine: RefundPolicyEngine;
  private webhookRegistry: DefaultWebhookHandlerRegistry;

  constructor(private config: { defaultGateway: GatewayProvider }) {
    this.idempotency = new IdempotencyManager();
    this.policyEngine = new RefundPolicyEngine();
    this.webhookRegistry = new DefaultWebhookHandlerRegistry();
    
    // Register default webhook handlers
    this.webhookRegistry.register('payment_intent.succeeded', new PaymentIntentHandler());
    this.webhookRegistry.register('payment_intent.payment_failed', new PaymentIntentHandler());
    this.webhookRegistry.register('payment_intent.requires_action', new PaymentIntentHandler());
    this.webhookRegistry.register('charge.succeeded', new ChargeHandler());
    this.webhookRegistry.register('charge.failed', new ChargeHandler());
    this.webhookRegistry.register('charge.refunded', new ChargeHandler());
    this.webhookRegistry.register('charge.dispute.created', new ChargeHandler());
    this.webhookRegistry.register('checkout.session.completed', new CheckoutSessionHandler());
    this.webhookRegistry.register('checkout.session.expired', new CheckoutSessionHandler());
  }

  /**
   * Add a gateway
   */
  addGateway(config: GatewayConfig): void {
    let adapter: GatewayAdapter;

    switch (config.provider) {
      case GatewayProvider.STRIPE:
        adapter = new StripeGatewayAdapter(config as any);
        break;
      
      case GatewayProvider.PAYPAL:
        adapter = new PaypalGatewayAdapter(config as any);
        break;
      
      case GatewayProvider.MOCK:
        adapter = new MockGatewayAdapter(config as any);
        break;
      
      default:
        throw new Error(`Unsupported gateway: ${config.provider}`);
    }

    this.gateways.set(config.provider, adapter);

    // Initialize processors if this is the default gateway
    if (config.provider === this.config.defaultGateway) {
      this.charges = new ChargesProcessor(adapter, this.idempotency);
      this.refunds = new RefundsProcessor(adapter, this.idempotency);
    }
  }

  /**
   * Get a gateway adapter
   */
  getGateway(provider?: GatewayProvider): GatewayAdapter {
    const key = provider || this.config.defaultGateway;
    const gateway = this.gateways.get(key);
    
    if (!gateway) {
      throw new Error(`Gateway not configured: ${key}`);
    }

    return gateway;
  }

  /**
   * Get charges processor
   */
  getCharges(): ChargesProcessor {
    if (!this.charges) {
      throw new Error('Default gateway not configured');
    }
    return this.charges;
  }

  /**
   * Get refunds processor
   */
  getRefunds(): RefundsProcessor {
    if (!this.refunds) {
      throw new Error('Default gateway not configured');
    }
    return this.refunds;
  }

  /**
   * Get refund policy engine
   */
  getPolicyEngine(): RefundPolicyEngine {
    return this.policyEngine;
  }

  /**
   * Create a checkout session
   */
  createCheckoutSession(options: any, config: any): CheckoutSessionManager {
    const gateway = this.getGateway();
    return new CheckoutSessionManager(options, config, gateway);
  }

  /**
   * Get webhook registry
   */
  getWebhookRegistry(): DefaultWebhookHandlerRegistry {
    return this.webhookRegistry;
  }

  /**
   * Verify webhook signature
   */
  verifyWebhook(payload: string, signature: string, options: any) {
    return WebhookVerifier.verify(payload, signature, options);
  }

  /**
   * Get idempotency manager
   */
  getIdempotency(): IdempotencyManager {
    return this.idempotency;
  }
}

// ============================================================================
// FACTORY FUNCTIONS
// ============================================================================

/**
 * Create a new payments client
 */
export function createPaymentsClient(config: { defaultGateway: GatewayProvider }): PaymentsClient {
  return new PaymentsClient(config);
}

/**
 * Create a Stripe gateway adapter
 */
export function createStripeGateway(config: any): StripeGatewayAdapter {
  return new StripeGatewayAdapter(config);
}

/**
 * Create a PayPal gateway adapter
 */
export function createPaypalGateway(config: any): PaypalGatewayAdapter {
  return new PaypalGatewayAdapter(config);
}

/**
 * Create a mock gateway adapter
 */
export function createMockGateway(config: any): MockGatewayAdapter {
  return new MockGatewayAdapter(config);
}

// ============================================================================
// VERSION
// ============================================================================

export const VERSION = '1.0.0';
