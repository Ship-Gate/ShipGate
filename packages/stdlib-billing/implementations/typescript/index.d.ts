/**
 * @isl-lang/stdlib-billing
 *
 * Billing and subscription management standard library.
 */
export * from './stripe.js';
export * from './paddle.js';
export type CustomerId = string;
export type SubscriptionId = string;
export type InvoiceId = string;
export type PlanId = string;
export type PriceId = string;
export type PaymentMethodId = string;
export type CouponId = string;
export type Currency = 'USD' | 'EUR' | 'GBP' | 'CAD' | 'AUD' | 'JPY' | string;
export declare enum SubscriptionStatus {
    TRIALING = "trialing",
    ACTIVE = "active",
    PAST_DUE = "past_due",
    CANCELED = "canceled",
    UNPAID = "unpaid",
    PAUSED = "paused",
    INCOMPLETE = "incomplete"
}
export declare enum BillingInterval {
    DAY = "day",
    WEEK = "week",
    MONTH = "month",
    YEAR = "year"
}
export declare enum InvoiceStatus {
    DRAFT = "draft",
    OPEN = "open",
    PAID = "paid",
    VOID = "void",
    UNCOLLECTIBLE = "uncollectible"
}
export declare enum PaymentMethodType {
    CARD = "card",
    BANK_ACCOUNT = "bank_account",
    SEPA_DEBIT = "sepa_debit",
    PAYPAL = "paypal"
}
export declare enum ProrationBehavior {
    CREATE_PRORATIONS = "create_prorations",
    NONE = "none",
    ALWAYS_INVOICE = "always_invoice"
}
export declare enum CollectionMethod {
    CHARGE_AUTOMATICALLY = "charge_automatically",
    SEND_INVOICE = "send_invoice"
}
export declare enum UsageAction {
    INCREMENT = "increment",
    SET = "set"
}
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
export declare enum CancellationReason {
    CUSTOMER_REQUEST = "customer_request",
    PAYMENT_FAILURE = "payment_failure",
    FRAUD = "fraud",
    TOO_EXPENSIVE = "too_expensive",
    MISSING_FEATURES = "missing_features",
    SWITCHED_SERVICE = "switched_service",
    UNUSED = "unused",
    OTHER = "other"
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
export declare class BillingError extends Error {
    code: string;
    retriable: boolean;
    retryAfter?: number | undefined;
    constructor(code: string, message: string, retriable?: boolean, retryAfter?: number | undefined);
}
export declare class CustomerNotFoundError extends BillingError {
    constructor(customerId: string);
}
export declare class PlanNotFoundError extends BillingError {
    constructor(planId: string);
}
export declare class SubscriptionNotFoundError extends BillingError {
    constructor(subscriptionId: string);
}
export declare class InvoiceNotFoundError extends BillingError {
    constructor(invoiceId: string);
}
export declare class PaymentFailedError extends BillingError {
    declineCode?: string | undefined;
    constructor(message: string, declineCode?: string | undefined);
}
export declare class PaymentMethodRequiredError extends BillingError {
    constructor();
}
export declare class AlreadySubscribedError extends BillingError {
    constructor(customerId: string, planId: string);
}
export declare class InvalidCouponError extends BillingError {
    constructor(couponCode: string);
}
export interface BillingProviderInterface {
    readonly name: BillingProvider;
    createSubscription(input: CreateSubscriptionInput): Promise<CreateSubscriptionResult>;
    getSubscription(subscriptionId: SubscriptionId): Promise<Subscription | null>;
    updateSubscription(subscriptionId: SubscriptionId, updates: Partial<Subscription>): Promise<Subscription>;
    cancelSubscription(input: CancelSubscriptionInput): Promise<CancelSubscriptionResult>;
    changePlan(input: ChangePlanInput): Promise<ChangePlanResult>;
    pauseSubscription(subscriptionId: SubscriptionId, resumesAt?: Date): Promise<Subscription>;
    resumeSubscription(subscriptionId: SubscriptionId): Promise<Subscription>;
    createInvoice(input: CreateInvoiceInput): Promise<Invoice>;
    getInvoice(invoiceId: InvoiceId): Promise<Invoice | null>;
    payInvoice(input: PayInvoiceInput): Promise<PayInvoiceResult>;
    voidInvoice(invoiceId: InvoiceId): Promise<Invoice>;
    finalizeInvoice(invoiceId: InvoiceId): Promise<Invoice>;
    recordUsage(input: RecordUsageInput): Promise<UsageRecord>;
    getUsageSummary(subscriptionId: SubscriptionId, periodStart?: Date, periodEnd?: Date): Promise<UsageSummary>;
    getPaymentMethod(paymentMethodId: PaymentMethodId): Promise<PaymentMethod | null>;
    attachPaymentMethod(paymentMethodId: PaymentMethodId, customerId: CustomerId): Promise<PaymentMethod>;
    detachPaymentMethod(paymentMethodId: PaymentMethodId): Promise<void>;
    getPlan(planId: PlanId): Promise<Plan | null>;
    listPlans(active?: boolean): Promise<Plan[]>;
    handleWebhook(payload: string, signature: string): Promise<WebhookEvent>;
}
export interface WebhookEvent {
    id: string;
    type: string;
    data: Record<string, unknown>;
    createdAt: Date;
    livemode: boolean;
}
export declare class BillingService {
    private provider;
    constructor(provider: BillingProviderInterface);
    createSubscription(input: CreateSubscriptionInput): Promise<CreateSubscriptionResult>;
    getSubscription(subscriptionId: SubscriptionId): Promise<Subscription>;
    cancelSubscription(input: CancelSubscriptionInput): Promise<CancelSubscriptionResult>;
    changePlan(input: ChangePlanInput): Promise<ChangePlanResult>;
    pauseSubscription(subscriptionId: SubscriptionId, resumesAt?: Date): Promise<Subscription>;
    resumeSubscription(subscriptionId: SubscriptionId): Promise<Subscription>;
    createInvoice(input: CreateInvoiceInput): Promise<Invoice>;
    getInvoice(invoiceId: InvoiceId): Promise<Invoice>;
    payInvoice(input: PayInvoiceInput): Promise<PayInvoiceResult>;
    voidInvoice(invoiceId: InvoiceId): Promise<Invoice>;
    recordUsage(input: RecordUsageInput): Promise<UsageRecord>;
    getUsageSummary(subscriptionId: SubscriptionId, periodStart?: Date, periodEnd?: Date): Promise<UsageSummary>;
    attachPaymentMethod(paymentMethodId: PaymentMethodId, customerId: CustomerId): Promise<PaymentMethod>;
    detachPaymentMethod(paymentMethodId: PaymentMethodId): Promise<void>;
    getPlan(planId: PlanId): Promise<Plan>;
    listPlans(active?: boolean): Promise<Plan[]>;
    handleWebhook(payload: string, signature: string): Promise<WebhookEvent>;
}
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
export declare function createBillingService(config: BillingServiceConfig): BillingService;
//# sourceMappingURL=index.d.ts.map