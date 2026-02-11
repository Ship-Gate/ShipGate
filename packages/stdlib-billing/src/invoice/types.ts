/**
 * Invoice-specific types.
 */

import { Money } from '../money.js';
import type {
  InvoiceId,
  CustomerId,
  SubscriptionId,
  PriceId,
  Currency,
  InvoiceStatus,
  CollectionMethod,
  BillingProvider,
  BillingReason,
  DiscountInfo,
  Address,
} from '../types.js';

// ============================================================================
// LINE ITEM
// ============================================================================

export interface LineItem {
  id: string;
  description: string;
  quantity: number;
  /** Unit price in minor-unit cents (bigint). */
  unitAmount: Money;
  /** Total = unitAmount * quantity. */
  amount: Money;
  periodStart?: Date;
  periodEnd?: Date;
  proration?: boolean;
  priceId?: PriceId;
  metadata?: Record<string, string>;
}

// ============================================================================
// TAX LINE
// ============================================================================

export interface TaxLine {
  description: string;
  /** Tax rate as a percentage, e.g. 8.25 */
  rate: number;
  /** Computed tax amount. */
  amount: Money;
  inclusive: boolean;
}

// ============================================================================
// INVOICE
// ============================================================================

export interface Invoice {
  id: InvoiceId;
  number?: string;
  customerId: CustomerId;
  subscriptionId?: SubscriptionId;
  status: InvoiceStatus;

  subtotal: Money;
  tax: Money;
  discount: Money;
  total: Money;

  amountDue: Money;
  amountPaid: Money;
  amountRemaining: Money;

  currency: Currency;

  lineItems: LineItem[];
  taxLines: TaxLine[];

  periodStart?: Date;
  periodEnd?: Date;
  dueDate?: Date;

  paid: boolean;
  paidAt?: Date;

  collectionMethod: CollectionMethod;
  attemptCount: number;

  billingReason?: BillingReason;
  metadata?: Record<string, string>;

  providerInvoiceId?: string;
  provider: BillingProvider;

  createdAt: Date;
  finalizedAt?: Date;
  voidedAt?: Date;
}

// ============================================================================
// INPUT / OUTPUT
// ============================================================================

export interface CreateInvoiceInput {
  customerId: CustomerId;
  subscriptionId?: SubscriptionId;
  currency: Currency;
  lineItems: Array<{
    description: string;
    quantity: number;
    /** Unit price in minor-unit cents. */
    unitAmountCents: bigint;
  }>;
  taxLines?: Array<{
    description: string;
    rate: number;
    inclusive?: boolean;
  }>;
  discountPercent?: number;
  discountFixedCents?: bigint;
  collectionMethod?: CollectionMethod;
  dueDate?: Date;
  billingReason?: BillingReason;
  metadata?: Record<string, string>;
}

export interface PayInvoiceInput {
  invoiceId: InvoiceId;
  /** Amount in minor-unit cents. If omitted, pays full remaining. */
  amountCents?: bigint;
}

export interface PayInvoiceResult {
  invoice: Invoice;
  paymentIntentId?: string;
}
