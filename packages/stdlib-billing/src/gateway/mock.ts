/**
 * Mock payment gateway adapter for testing.
 * Stores everything in-memory. No external calls.
 */

import type { PaymentGatewayAdapter } from './adapter.js';
import type {
  ChargeRequest,
  ChargeResult,
  RefundRequest,
  RefundResult,
  CustomerRecord,
} from './types.js';
import type { PaymentMethodId, CustomerId, PaymentMethod, WebhookEvent } from '../types.js';
import { PaymentMethodType } from '../types.js';

export interface MockGatewayOptions {
  /** If true, all charges will fail. */
  failCharges?: boolean;
  /** Specific charge IDs that should fail on refund. */
  failRefundChargeIds?: Set<string>;
}

export class MockGateway implements PaymentGatewayAdapter {
  readonly name = 'mock';

  private charges = new Map<string, ChargeResult>();
  private refunds = new Map<string, RefundResult>();
  private customers = new Map<string, CustomerRecord>();
  private paymentMethods = new Map<string, PaymentMethod>();
  private customerPaymentMethods = new Map<string, Set<string>>();

  private chargeCounter = 0;
  private refundCounter = 0;
  private customerCounter = 0;

  private options: MockGatewayOptions;

  constructor(options: MockGatewayOptions = {}) {
    this.options = options;
  }

  // --------------------------------------------------------------------------
  // CHARGES
  // --------------------------------------------------------------------------

  async createCharge(request: ChargeRequest): Promise<ChargeResult> {
    const id = `ch_mock_${++this.chargeCounter}`;
    const now = new Date();

    if (this.options.failCharges) {
      const result: ChargeResult = {
        id,
        status: 'failed',
        amountCents: request.amountCents,
        currency: request.currency,
        paymentMethodId: request.paymentMethodId,
        createdAt: now,
        failureCode: 'card_declined',
        failureMessage: 'Mock gateway: charges configured to fail',
      };
      this.charges.set(id, result);
      return result;
    }

    const result: ChargeResult = {
      id,
      status: 'succeeded',
      amountCents: request.amountCents,
      currency: request.currency,
      paymentMethodId: request.paymentMethodId,
      createdAt: now,
    };
    this.charges.set(id, result);
    return result;
  }

  async getCharge(chargeId: string): Promise<ChargeResult | null> {
    return this.charges.get(chargeId) ?? null;
  }

  // --------------------------------------------------------------------------
  // REFUNDS
  // --------------------------------------------------------------------------

  async createRefund(request: RefundRequest): Promise<RefundResult> {
    const charge = this.charges.get(request.chargeId);
    if (!charge) {
      throw new Error(`Charge not found: ${request.chargeId}`);
    }

    if (this.options.failRefundChargeIds?.has(request.chargeId)) {
      const id = `re_mock_${++this.refundCounter}`;
      const result: RefundResult = {
        id,
        chargeId: request.chargeId,
        amountCents: request.amountCents ?? charge.amountCents,
        currency: charge.currency,
        status: 'failed',
        createdAt: new Date(),
      };
      this.refunds.set(id, result);
      return result;
    }

    const id = `re_mock_${++this.refundCounter}`;
    const result: RefundResult = {
      id,
      chargeId: request.chargeId,
      amountCents: request.amountCents ?? charge.amountCents,
      currency: charge.currency,
      status: 'succeeded',
      createdAt: new Date(),
    };
    this.refunds.set(id, result);
    return result;
  }

  // --------------------------------------------------------------------------
  // CUSTOMERS
  // --------------------------------------------------------------------------

  async createCustomer(
    email: string,
    name?: string,
    metadata?: Record<string, string>,
  ): Promise<CustomerRecord> {
    const id = `cus_mock_${++this.customerCounter}`;
    const record: CustomerRecord = { id, email, name, metadata };
    this.customers.set(id, record);
    return record;
  }

  async getCustomer(customerId: string): Promise<CustomerRecord | null> {
    return this.customers.get(customerId) ?? null;
  }

  async deleteCustomer(customerId: string): Promise<void> {
    this.customers.delete(customerId);
  }

  // --------------------------------------------------------------------------
  // PAYMENT METHODS
  // --------------------------------------------------------------------------

  async attachPaymentMethod(
    paymentMethodId: PaymentMethodId,
    customerId: CustomerId,
  ): Promise<PaymentMethod> {
    const pm: PaymentMethod = {
      id: paymentMethodId,
      customerId,
      type: PaymentMethodType.CARD,
      card: {
        brand: 'visa',
        last4: '4242',
        expMonth: 12,
        expYear: 2030,
      },
      provider: 'internal',
      createdAt: new Date(),
    };
    this.paymentMethods.set(paymentMethodId, pm);

    if (!this.customerPaymentMethods.has(customerId)) {
      this.customerPaymentMethods.set(customerId, new Set());
    }
    this.customerPaymentMethods.get(customerId)!.add(paymentMethodId);

    return pm;
  }

  async detachPaymentMethod(paymentMethodId: PaymentMethodId): Promise<void> {
    const pm = this.paymentMethods.get(paymentMethodId);
    if (pm?.customerId) {
      this.customerPaymentMethods.get(pm.customerId)?.delete(paymentMethodId);
    }
    this.paymentMethods.delete(paymentMethodId);
  }

  async listPaymentMethods(customerId: CustomerId): Promise<PaymentMethod[]> {
    const ids = this.customerPaymentMethods.get(customerId);
    if (!ids) return [];
    return Array.from(ids)
      .map((id) => this.paymentMethods.get(id))
      .filter((pm): pm is PaymentMethod => pm !== undefined);
  }

  // --------------------------------------------------------------------------
  // WEBHOOKS
  // --------------------------------------------------------------------------

  verifyWebhookSignature(_payload: string, _signature: string, _secret: string): boolean {
    return true;
  }

  parseWebhookEvent(payload: string): WebhookEvent {
    const data = JSON.parse(payload) as Record<string, unknown>;
    return {
      id: `evt_mock_${Date.now()}`,
      type: (data['type'] as string) ?? 'mock.event',
      data,
      createdAt: new Date(),
      livemode: false,
    };
  }

  // --------------------------------------------------------------------------
  // TEST HELPERS
  // --------------------------------------------------------------------------

  /** Get all charges for inspection. */
  getAllCharges(): ChargeResult[] {
    return Array.from(this.charges.values());
  }

  /** Get all refunds for inspection. */
  getAllRefunds(): RefundResult[] {
    return Array.from(this.refunds.values());
  }

  /** Reset all state. */
  reset(): void {
    this.charges.clear();
    this.refunds.clear();
    this.customers.clear();
    this.paymentMethods.clear();
    this.customerPaymentMethods.clear();
    this.chargeCounter = 0;
    this.refundCounter = 0;
    this.customerCounter = 0;
  }
}
