/**
 * Stripe Billing Provider
 *
 * Implementation of BillingProviderInterface using Stripe.
 */
import { type BillingProviderInterface, type Subscription, type Invoice, type Plan, type PaymentMethod, type UsageRecord, type UsageSummary, type WebhookEvent, type CreateSubscriptionInput, type CreateSubscriptionResult, type CancelSubscriptionInput, type CancelSubscriptionResult, type ChangePlanInput, type ChangePlanResult, type RecordUsageInput, type CreateInvoiceInput, type PayInvoiceInput, type PayInvoiceResult, type CustomerId, type SubscriptionId, type InvoiceId, type PlanId, type PaymentMethodId, BillingService } from './index.js';
export interface StripeConfig {
    secretKey: string;
    webhookSecret?: string;
    apiVersion?: string;
}
export declare class StripeBillingProvider implements BillingProviderInterface {
    readonly name: "stripe";
    private stripe;
    private webhookSecret?;
    constructor(config: StripeConfig);
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
    private mapSubscription;
    private mapSubscriptionStatus;
    private mapInvoice;
    private mapInvoiceStatus;
    private mapPaymentMethod;
    private mapPaymentMethodType;
    private mapPrice;
    private mapInterval;
}
export declare function createStripeBillingService(config: StripeConfig): BillingService;
export declare function createStripeBillingServiceFromEnv(): BillingService;
//# sourceMappingURL=stripe.d.ts.map