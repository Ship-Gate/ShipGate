/**
 * Core billing types — shared across all submodules.
 * Money is always stored as bigint cents (minor-unit).
 */

// ============================================================================
// ID TYPES
// ============================================================================

export type CustomerId = string;
export type SubscriptionId = string;
export type InvoiceId = string;
export type PlanId = string;
export type PriceId = string;
export type PaymentMethodId = string;
export type CouponId = string;
export type DiscountId = string;

/** ISO 4217 currency code */
export type Currency = 'USD' | 'EUR' | 'GBP' | 'CAD' | 'AUD' | 'JPY' | (string & {});

// ============================================================================
// ENUMS
// ============================================================================

export enum SubscriptionStatus {
  TRIALING = 'trialing',
  ACTIVE = 'active',
  PAST_DUE = 'past_due',
  CANCELED = 'canceled',
  UNPAID = 'unpaid',
  PAUSED = 'paused',
  INCOMPLETE = 'incomplete',
}

export enum BillingInterval {
  DAY = 'day',
  WEEK = 'week',
  MONTH = 'month',
  YEAR = 'year',
}

export enum InvoiceStatus {
  DRAFT = 'draft',
  OPEN = 'open',
  PAID = 'paid',
  VOID = 'void',
  UNCOLLECTIBLE = 'uncollectible',
}

export enum PaymentMethodType {
  CARD = 'card',
  BANK_ACCOUNT = 'bank_account',
  SEPA_DEBIT = 'sepa_debit',
  PAYPAL = 'paypal',
}

export enum ProrationBehavior {
  CREATE_PRORATIONS = 'create_prorations',
  NONE = 'none',
  ALWAYS_INVOICE = 'always_invoice',
}

export enum CollectionMethod {
  CHARGE_AUTOMATICALLY = 'charge_automatically',
  SEND_INVOICE = 'send_invoice',
}

export enum UsageAction {
  INCREMENT = 'increment',
  SET = 'set',
}

export enum CancellationReason {
  CUSTOMER_REQUEST = 'customer_request',
  PAYMENT_FAILURE = 'payment_failure',
  FRAUD = 'fraud',
  TOO_EXPENSIVE = 'too_expensive',
  MISSING_FEATURES = 'missing_features',
  SWITCHED_SERVICE = 'switched_service',
  UNUSED = 'unused',
  OTHER = 'other',
}

export enum BillingReason {
  SUBSCRIPTION_CREATE = 'subscription_create',
  SUBSCRIPTION_CYCLE = 'subscription_cycle',
  SUBSCRIPTION_UPDATE = 'subscription_update',
  MANUAL = 'manual',
}

export type BillingProvider = 'stripe' | 'paddle' | 'internal';

// ============================================================================
// SUPPORTING TYPES
// ============================================================================

export interface CancellationDetails {
  reason?: CancellationReason;
  feedback?: string;
  comment?: string;
}

export interface PauseCollection {
  behavior: 'keep_as_draft' | 'mark_uncollectible' | 'void';
  resumesAt?: Date;
}

export interface DiscountInfo {
  couponId: CouponId;
  percentOff?: number;
  /** Fixed amount off in minor-unit cents (bigint) */
  amountOff?: bigint;
  start: Date;
  end?: Date;
}

export interface Address {
  line1: string;
  line2?: string;
  city: string;
  state?: string;
  postalCode: string;
  country: string;
}

export interface CardDetails {
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
  funding?: 'credit' | 'debit' | 'prepaid';
  country?: string;
}

export interface BankAccountDetails {
  bankName?: string;
  last4: string;
  routingNumber?: string;
  currency: Currency;
  country: string;
}

export interface BillingDetails {
  name?: string;
  email?: string;
  phone?: string;
  address?: Address;
}

export interface PaymentMethod {
  id: PaymentMethodId;
  customerId?: CustomerId;
  type: PaymentMethodType;
  card?: CardDetails;
  bankAccount?: BankAccountDetails;
  billingDetails?: BillingDetails;
  providerPaymentMethodId?: string;
  provider: BillingProvider;
  createdAt: Date;
}

export interface WebhookEvent {
  id: string;
  type: string;
  data: Record<string, unknown>;
  createdAt: Date;
  livemode: boolean;
}
