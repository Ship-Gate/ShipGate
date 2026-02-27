/**
 * @isl-lang/stdlib-billing
 * 
 * Billing and subscription management standard library.
 */

export * from './stripe.js';
export * from './paddle.js';

// ============================================================================
// TYPES
// ============================================================================

export type CustomerId = string;
export type SubscriptionId = string;
export type InvoiceId = string;
export type PlanId = string;
export type PriceId = string;
export type PaymentMethodId = string;
export type CouponId = string;

export type Currency = 'USD' | 'EUR' | 'GBP' | 'CAD' | 'AUD' | 'JPY' | string;

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

// ============================================================================
// ENTITIES
// ============================================================================

export interface Plan {
  id: PlanId;
  name: string;
  description?: string;
  amount: number;
  currency: Currency;
  interval: BillingInterval;
  intervalCount: number;
  trialDays?: number;
  features: string[];
  usageType?: 'licensed' | 'metered' | 'tiered';
  metadata?: Record<string, string>;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Subscription {
  id: SubscriptionId;
  customerId: CustomerId;
  planId: PlanId;
  priceId?: PriceId;
  status: SubscriptionStatus;
  
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  billingCycleAnchor: Date;
  
  trialStart?: Date;
  trialEnd?: Date;
  
  canceledAt?: Date;
  cancelAt?: Date;
  cancelAtPeriodEnd: boolean;
  cancellationDetails?: CancellationDetails;
  
  quantity: number;
  discountId?: string;
  
  collectionMethod: CollectionMethod;
  defaultPaymentMethodId?: PaymentMethodId;
  latestInvoiceId?: InvoiceId;
  
  pauseCollection?: PauseCollection;
  
  metadata?: Record<string, string>;
  
  providerSubscriptionId?: string;
  provider: BillingProvider;
  
  createdAt: Date;
  updatedAt: Date;
  endedAt?: Date;
}

export interface CancellationDetails {
  reason?: CancellationReason;
  feedback?: string;
  comment?: string;
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

export interface PauseCollection {
  behavior: 'keep_as_draft' | 'mark_uncollectible' | 'void';
  resumesAt?: Date;
}

export interface Invoice {
  id: InvoiceId;
  number?: string;
  customerId: CustomerId;
  subscriptionId?: SubscriptionId;
  status: InvoiceStatus;
  
  subtotal: number;
  tax?: number;
  total: number;
  amountDue: number;
  amountPaid: number;
  amountRemaining: number;
  currency: Currency;
  
  lineItems: LineItem[];
  
  periodStart?: Date;
  periodEnd?: Date;
  dueDate?: Date;
  
  paid: boolean;
  paidAt?: Date;
  
  collectionMethod: CollectionMethod;
  attemptCount: number;
  
  hostedInvoiceUrl?: string;
  invoicePdf?: string;
  
  metadata?: Record<string, string>;
  
  providerInvoiceId?: string;
  provider: BillingProvider;
  
  createdAt: Date;
  finalizedAt?: Date;
  voidedAt?: Date;
}

export interface LineItem {
  id: string;
  description: string;
  quantity: number;
  unitAmount: number;
  amount: number;
  periodStart?: Date;
  periodEnd?: Date;
  proration?: boolean;
  priceId?: PriceId;
  metadata?: Record<string, string>;
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

export interface Address {
  line1: string;
  line2?: string;
  city: string;
  state?: string;
  postalCode: string;
  country: string;
}

export interface UsageRecord {
  id: string;
  subscriptionId: SubscriptionId;
  quantity: number;
  timestamp: Date;
  action: UsageAction;
}

export interface UsageSummary {
  subscriptionId: SubscriptionId;
  totalUsage: number;
  periodStart: Date;
  periodEnd: Date;
  records: UsageRecord[];
}

export type BillingProvider = 'stripe' | 'paddle' | 'internal';

// ============================================================================
// INPUT/OUTPUT TYPES
// ============================================================================

export interface CreateSubscriptionInput {
  customerId: CustomerId;
  planId: PlanId;
  priceId?: PriceId;
  paymentMethodId?: PaymentMethodId;
  quantity?: number;
  trialDays?: number;
  trialEnd?: Date;
  couponCode?: string;
  collectionMethod?: CollectionMethod;
  metadata?: Record<string, string>;
}

export interface CreateSubscriptionResult {
  subscription: Subscription;
  latestInvoice?: Invoice;
  pendingSetupIntent?: string;
}

export interface CancelSubscriptionInput {
  subscriptionId: SubscriptionId;
  cancelImmediately?: boolean;
  cancelAt?: Date;
  prorate?: boolean;
  cancellationDetails?: {
    reason?: CancellationReason;
    feedback?: string;
  };
}

export interface CancelSubscriptionResult {
  subscription: Subscription;
  proratedCredit?: number;
  finalInvoice?: Invoice;
}

export interface ChangePlanInput {
  subscriptionId: SubscriptionId;
  newPlanId: PlanId;
  newPriceId?: PriceId;
  quantity?: number;
  prorationBehavior?: ProrationBehavior;
}

export interface ChangePlanResult {
  subscription: Subscription;
  prorations?: LineItem[];
  invoice?: Invoice;
}

export interface RecordUsageInput {
  subscriptionId: SubscriptionId;
  quantity: number;
  timestamp?: Date;
  action?: UsageAction;
  idempotencyKey?: string;
}

export interface CreateInvoiceInput {
  customerId: CustomerId;
  subscriptionId?: SubscriptionId;
  lineItems?: Array<{
    description: string;
    quantity: number;
    unitAmount: number;
  }>;
  collectionMethod?: CollectionMethod;
  dueDate?: Date;
  metadata?: Record<string, string>;
}

export interface PayInvoiceInput {
  invoiceId: InvoiceId;
  paymentMethodId?: PaymentMethodId;
  amount?: number;
}

export interface PayInvoiceResult {
  invoice: Invoice;
  paymentIntentId?: string;
  chargeId?: string;
}

// ============================================================================
// ERRORS
// ============================================================================

export class BillingError extends Error {
  constructor(
    public code: string,
    message: string,
    public retriable: boolean = false,
    public retryAfter?: number
  ) {
    super(message);
    this.name = 'BillingError';
  }
}

export class CustomerNotFoundError extends BillingError {
  constructor(customerId: string) {
    super('CUSTOMER_NOT_FOUND', `Customer not found: ${customerId}`);
  }
}

export class PlanNotFoundError extends BillingError {
  constructor(planId: string) {
    super('PLAN_NOT_FOUND', `Plan not found: ${planId}`);
  }
}

export class SubscriptionNotFoundError extends BillingError {
  constructor(subscriptionId: string) {
    super('SUBSCRIPTION_NOT_FOUND', `Subscription not found: ${subscriptionId}`);
  }
}

export class InvoiceNotFoundError extends BillingError {
  constructor(invoiceId: string) {
    super('INVOICE_NOT_FOUND', `Invoice not found: ${invoiceId}`);
  }
}

export class PaymentFailedError extends BillingError {
  constructor(
    message: string,
    public declineCode?: string
  ) {
    super('PAYMENT_FAILED', message, true, 5000);
  }
}

export class PaymentMethodRequiredError extends BillingError {
  constructor() {
    super('PAYMENT_METHOD_REQUIRED', 'No payment method on file');
  }
}

export class AlreadySubscribedError extends BillingError {
  constructor(customerId: string, planId: string) {
    super('ALREADY_SUBSCRIBED', `Customer ${customerId} already subscribed to plan ${planId}`);
  }
}

export class InvalidCouponError extends BillingError {
  constructor(couponCode: string) {
    super('INVALID_COUPON', `Invalid or expired coupon: ${couponCode}`);
  }
}

// ============================================================================
// BILLING PROVIDER INTERFACE
// ============================================================================

export interface BillingProviderInterface {
  readonly name: BillingProvider;

  // Subscriptions
  createSubscription(input: CreateSubscriptionInput): Promise<CreateSubscriptionResult>;
  getSubscription(subscriptionId: SubscriptionId): Promise<Subscription | null>;
  updateSubscription(subscriptionId: SubscriptionId, updates: Partial<Subscription>): Promise<Subscription>;
  cancelSubscription(input: CancelSubscriptionInput): Promise<CancelSubscriptionResult>;
  changePlan(input: ChangePlanInput): Promise<ChangePlanResult>;
  pauseSubscription(subscriptionId: SubscriptionId, resumesAt?: Date): Promise<Subscription>;
  resumeSubscription(subscriptionId: SubscriptionId): Promise<Subscription>;

  // Invoices
  createInvoice(input: CreateInvoiceInput): Promise<Invoice>;
  getInvoice(invoiceId: InvoiceId): Promise<Invoice | null>;
  payInvoice(input: PayInvoiceInput): Promise<PayInvoiceResult>;
  voidInvoice(invoiceId: InvoiceId): Promise<Invoice>;
  finalizeInvoice(invoiceId: InvoiceId): Promise<Invoice>;

  // Usage (for metered billing)
  recordUsage(input: RecordUsageInput): Promise<UsageRecord>;
  getUsageSummary(subscriptionId: SubscriptionId, periodStart?: Date, periodEnd?: Date): Promise<UsageSummary>;

  // Payment Methods
  getPaymentMethod(paymentMethodId: PaymentMethodId): Promise<PaymentMethod | null>;
  attachPaymentMethod(paymentMethodId: PaymentMethodId, customerId: CustomerId): Promise<PaymentMethod>;
  detachPaymentMethod(paymentMethodId: PaymentMethodId): Promise<void>;

  // Plans
  getPlan(planId: PlanId): Promise<Plan | null>;
  listPlans(active?: boolean): Promise<Plan[]>;

  // Webhooks
  handleWebhook(payload: string, signature: string): Promise<WebhookEvent>;
}

export interface WebhookEvent {
  id: string;
  type: string;
  data: Record<string, unknown>;
  createdAt: Date;
  livemode: boolean;
}

// ============================================================================
// BILLING SERVICE
// ============================================================================

export class BillingService {
  constructor(private provider: BillingProviderInterface) {}

  // Subscriptions
  async createSubscription(input: CreateSubscriptionInput): Promise<CreateSubscriptionResult> {
    return this.provider.createSubscription(input);
  }

  async getSubscription(subscriptionId: SubscriptionId): Promise<Subscription> {
    const subscription = await this.provider.getSubscription(subscriptionId);
    if (!subscription) {
      throw new SubscriptionNotFoundError(subscriptionId);
    }
    return subscription;
  }

  async cancelSubscription(input: CancelSubscriptionInput): Promise<CancelSubscriptionResult> {
    return this.provider.cancelSubscription(input);
  }

  async changePlan(input: ChangePlanInput): Promise<ChangePlanResult> {
    return this.provider.changePlan(input);
  }

  async pauseSubscription(subscriptionId: SubscriptionId, resumesAt?: Date): Promise<Subscription> {
    return this.provider.pauseSubscription(subscriptionId, resumesAt);
  }

  async resumeSubscription(subscriptionId: SubscriptionId): Promise<Subscription> {
    return this.provider.resumeSubscription(subscriptionId);
  }

  // Invoices
  async createInvoice(input: CreateInvoiceInput): Promise<Invoice> {
    return this.provider.createInvoice(input);
  }

  async getInvoice(invoiceId: InvoiceId): Promise<Invoice> {
    const invoice = await this.provider.getInvoice(invoiceId);
    if (!invoice) {
      throw new InvoiceNotFoundError(invoiceId);
    }
    return invoice;
  }

  async payInvoice(input: PayInvoiceInput): Promise<PayInvoiceResult> {
    return this.provider.payInvoice(input);
  }

  async voidInvoice(invoiceId: InvoiceId): Promise<Invoice> {
    return this.provider.voidInvoice(invoiceId);
  }

  // Usage
  async recordUsage(input: RecordUsageInput): Promise<UsageRecord> {
    return this.provider.recordUsage(input);
  }

  async getUsageSummary(
    subscriptionId: SubscriptionId,
    periodStart?: Date,
    periodEnd?: Date
  ): Promise<UsageSummary> {
    return this.provider.getUsageSummary(subscriptionId, periodStart, periodEnd);
  }

  // Payment Methods
  async attachPaymentMethod(paymentMethodId: PaymentMethodId, customerId: CustomerId): Promise<PaymentMethod> {
    return this.provider.attachPaymentMethod(paymentMethodId, customerId);
  }

  async detachPaymentMethod(paymentMethodId: PaymentMethodId): Promise<void> {
    return this.provider.detachPaymentMethod(paymentMethodId);
  }

  // Plans
  async getPlan(planId: PlanId): Promise<Plan> {
    const plan = await this.provider.getPlan(planId);
    if (!plan) {
      throw new PlanNotFoundError(planId);
    }
    return plan;
  }

  async listPlans(active?: boolean): Promise<Plan[]> {
    return this.provider.listPlans(active);
  }

  // Webhooks
  async handleWebhook(payload: string, signature: string): Promise<WebhookEvent> {
    return this.provider.handleWebhook(payload, signature);
  }
}

// ============================================================================
// FACTORY
// ============================================================================

export interface BillingServiceConfig {
  provider: 'stripe' | 'paddle';
  stripe?: {
    secretKey: string;
    webhookSecret?: string;
  };
  paddle?: {
    vendorId: string;
    apiKey: string;
    webhookSecret?: string;
  };
}

export function createBillingService(config: BillingServiceConfig): BillingService {
  // Implementation in stripe.ts and paddle.ts
  throw new Error('Use createStripeBillingService or createPaddleBillingService');
}
