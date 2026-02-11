/**
 * Payment gateway adapter interface.
 * No SDK dependency — consumers implement this for their provider.
 */

import type {
  ChargeRequest,
  ChargeResult,
  RefundRequest,
  RefundResult,
  CustomerRecord,
} from './types.js';
import type { PaymentMethodId, CustomerId } from '../types.js';
import type { PaymentMethod, WebhookEvent } from '../types.js';

// ============================================================================
// GATEWAY ADAPTER INTERFACE
// ============================================================================

export interface PaymentGatewayAdapter {
  readonly name: string;

  // Charges
  createCharge(request: ChargeRequest): Promise<ChargeResult>;
  getCharge(chargeId: string): Promise<ChargeResult | null>;

  // Refunds
  createRefund(request: RefundRequest): Promise<RefundResult>;

  // Customers
  createCustomer(email: string, name?: string, metadata?: Record<string, string>): Promise<CustomerRecord>;
  getCustomer(customerId: string): Promise<CustomerRecord | null>;
  deleteCustomer(customerId: string): Promise<void>;

  // Payment methods
  attachPaymentMethod(paymentMethodId: PaymentMethodId, customerId: CustomerId): Promise<PaymentMethod>;
  detachPaymentMethod(paymentMethodId: PaymentMethodId): Promise<void>;
  listPaymentMethods(customerId: CustomerId): Promise<PaymentMethod[]>;

  // Webhooks
  verifyWebhookSignature(payload: string, signature: string, secret: string): boolean;
  parseWebhookEvent(payload: string): WebhookEvent;
}
