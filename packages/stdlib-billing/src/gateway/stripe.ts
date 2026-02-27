/**
 * Stripe gateway adapter — interface-only, no SDK dependency.
 * Consumers must provide their own HTTP client or Stripe SDK instance.
 */

import type { PaymentGatewayAdapter } from './adapter.js';

/**
 * Configuration required to build a Stripe adapter.
 * The actual implementation is left to the consumer.
 */
export interface StripeAdapterConfig {
  secretKey: string;
  webhookSecret?: string;
  apiVersion?: string;
}

/**
 * Type-safe marker for a Stripe-flavoured adapter.
 * Consumers implement PaymentGatewayAdapter and pass their Stripe SDK calls through.
 */
export type StripeGatewayAdapter = PaymentGatewayAdapter & {
  readonly name: 'stripe';
};
