/**
 * Paddle Billing Provider
 *
 * Implementation of BillingProviderInterface using Paddle.
 * Note: This is a simplified implementation. Paddle has a different model
 * than Stripe - it handles the entire checkout flow including payment collection.
 */
import { type BillingProviderInterface, type Subscription, type Invoice, type Plan, type PaymentMethod, type UsageRecord, type UsageSummary, type WebhookEvent, type CreateSubscriptionInput, type CreateSubscriptionResult, type CancelSubscriptionInput, type CancelSubscriptionResult, type ChangePlanInput, type ChangePlanResult, type RecordUsageInput, type CreateInvoiceInput, type PayInvoiceInput, type PayInvoiceResult, type CustomerId, type SubscriptionId, type InvoiceId, type PlanId, type PaymentMethodId, BillingService } from './index.js';
export interface PaddleConfig {
    vendorId: string;
    apiKey: string;
    environment?: 'sandbox' | 'production';
    webhookSecret?: string;
}
export declare class PaddleBillingProvider implements BillingProviderInterface {
    readonly name: "paddle";
    private config;
    private baseUrl;
    constructor(config: PaddleConfig);
    private paddleRequest;
    createSubscription(input: CreateSubscriptionInput): Promise<CreateSubscriptionResult>;
    /**
     * Generate a Paddle checkout URL for subscription creation
     */
    generateCheckoutUrl(input: {
        planId: PlanId;
        customerId?: CustomerId;
        customerEmail?: string;
        quantity?: number;
        trialDays?: number;
        couponCode?: string;
        passthrough?: Record<string, unknown>;
        successUrl?: string;
        cancelUrl?: string;
    }): Promise<string>;
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
    /**
     * Refund a Paddle transaction
     */
    refundTransaction(orderId: string, amount?: number, reason?: string): Promise<void>;
    recordUsage(input: RecordUsageInput): Promise<UsageRecord>;
    getUsageSummary(subscriptionId: SubscriptionId, periodStart?: Date, periodEnd?: Date): Promise<UsageSummary>;
    getPaymentMethod(paymentMethodId: PaymentMethodId): Promise<PaymentMethod | null>;
    attachPaymentMethod(paymentMethodId: PaymentMethodId, customerId: CustomerId): Promise<PaymentMethod>;
    detachPaymentMethod(paymentMethodId: PaymentMethodId): Promise<void>;
    getPlan(planId: PlanId): Promise<Plan | null>;
    listPlans(active?: boolean): Promise<Plan[]>;
    handleWebhook(payload: string, signature: string): Promise<WebhookEvent>;
    private verifyWebhookSignature;
    private mapSubscription;
    private mapSubscriptionStatus;
    private mapTransaction;
    private mapPlan;
    private mapInterval;
}
export declare function createPaddleBillingService(config: PaddleConfig): BillingService;
export declare function createPaddleBillingServiceFromEnv(): BillingService;
//# sourceMappingURL=paddle.d.ts.map