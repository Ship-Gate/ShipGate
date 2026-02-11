/**
 * Gateway types — shared across adapter implementations.
 */

import type { Currency, PaymentMethodId, CustomerId } from '../types.js';
import { Money } from '../money.js';

export type ChargeStatus = 'succeeded' | 'pending' | 'failed' | 'requires_action';

export interface ChargeRequest {
  amountCents: bigint;
  currency: Currency;
  paymentMethodId: PaymentMethodId;
  customerId: CustomerId;
  description?: string;
  metadata?: Record<string, string>;
  idempotencyKey?: string;
}

export interface ChargeResult {
  id: string;
  status: ChargeStatus;
  amountCents: bigint;
  currency: Currency;
  paymentMethodId: PaymentMethodId;
  createdAt: Date;
  failureCode?: string;
  failureMessage?: string;
}

export interface RefundRequest {
  chargeId: string;
  amountCents?: bigint;
  reason?: 'duplicate' | 'fraudulent' | 'requested_by_customer';
  metadata?: Record<string, string>;
}

export interface RefundResult {
  id: string;
  chargeId: string;
  amountCents: bigint;
  currency: Currency;
  status: 'succeeded' | 'pending' | 'failed';
  createdAt: Date;
}

export interface CustomerRecord {
  id: string;
  email: string;
  name?: string;
  metadata?: Record<string, string>;
}
