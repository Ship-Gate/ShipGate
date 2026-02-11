/**
 * @isl-lang/stdlib-billing
 *
 * Billing and subscription management standard library.
 */
export * from './stripe.js';
export * from './paddle.js';
// ============================================================================
// ENUMS
// ============================================================================
export var SubscriptionStatus;
(function (SubscriptionStatus) {
    SubscriptionStatus["TRIALING"] = "trialing";
    SubscriptionStatus["ACTIVE"] = "active";
    SubscriptionStatus["PAST_DUE"] = "past_due";
    SubscriptionStatus["CANCELED"] = "canceled";
    SubscriptionStatus["UNPAID"] = "unpaid";
    SubscriptionStatus["PAUSED"] = "paused";
    SubscriptionStatus["INCOMPLETE"] = "incomplete";
})(SubscriptionStatus || (SubscriptionStatus = {}));
export var BillingInterval;
(function (BillingInterval) {
    BillingInterval["DAY"] = "day";
    BillingInterval["WEEK"] = "week";
    BillingInterval["MONTH"] = "month";
    BillingInterval["YEAR"] = "year";
})(BillingInterval || (BillingInterval = {}));
export var InvoiceStatus;
(function (InvoiceStatus) {
    InvoiceStatus["DRAFT"] = "draft";
    InvoiceStatus["OPEN"] = "open";
    InvoiceStatus["PAID"] = "paid";
    InvoiceStatus["VOID"] = "void";
    InvoiceStatus["UNCOLLECTIBLE"] = "uncollectible";
})(InvoiceStatus || (InvoiceStatus = {}));
export var PaymentMethodType;
(function (PaymentMethodType) {
    PaymentMethodType["CARD"] = "card";
    PaymentMethodType["BANK_ACCOUNT"] = "bank_account";
    PaymentMethodType["SEPA_DEBIT"] = "sepa_debit";
    PaymentMethodType["PAYPAL"] = "paypal";
})(PaymentMethodType || (PaymentMethodType = {}));
export var ProrationBehavior;
(function (ProrationBehavior) {
    ProrationBehavior["CREATE_PRORATIONS"] = "create_prorations";
    ProrationBehavior["NONE"] = "none";
    ProrationBehavior["ALWAYS_INVOICE"] = "always_invoice";
})(ProrationBehavior || (ProrationBehavior = {}));
export var CollectionMethod;
(function (CollectionMethod) {
    CollectionMethod["CHARGE_AUTOMATICALLY"] = "charge_automatically";
    CollectionMethod["SEND_INVOICE"] = "send_invoice";
})(CollectionMethod || (CollectionMethod = {}));
export var UsageAction;
(function (UsageAction) {
    UsageAction["INCREMENT"] = "increment";
    UsageAction["SET"] = "set";
})(UsageAction || (UsageAction = {}));
export var CancellationReason;
(function (CancellationReason) {
    CancellationReason["CUSTOMER_REQUEST"] = "customer_request";
    CancellationReason["PAYMENT_FAILURE"] = "payment_failure";
    CancellationReason["FRAUD"] = "fraud";
    CancellationReason["TOO_EXPENSIVE"] = "too_expensive";
    CancellationReason["MISSING_FEATURES"] = "missing_features";
    CancellationReason["SWITCHED_SERVICE"] = "switched_service";
    CancellationReason["UNUSED"] = "unused";
    CancellationReason["OTHER"] = "other";
})(CancellationReason || (CancellationReason = {}));
// ============================================================================
// ERRORS
// ============================================================================
export class BillingError extends Error {
    code;
    retriable;
    retryAfter;
    constructor(code, message, retriable = false, retryAfter) {
        super(message);
        this.code = code;
        this.retriable = retriable;
        this.retryAfter = retryAfter;
        this.name = 'BillingError';
    }
}
export class CustomerNotFoundError extends BillingError {
    constructor(customerId) {
        super('CUSTOMER_NOT_FOUND', `Customer not found: ${customerId}`);
    }
}
export class PlanNotFoundError extends BillingError {
    constructor(planId) {
        super('PLAN_NOT_FOUND', `Plan not found: ${planId}`);
    }
}
export class SubscriptionNotFoundError extends BillingError {
    constructor(subscriptionId) {
        super('SUBSCRIPTION_NOT_FOUND', `Subscription not found: ${subscriptionId}`);
    }
}
export class InvoiceNotFoundError extends BillingError {
    constructor(invoiceId) {
        super('INVOICE_NOT_FOUND', `Invoice not found: ${invoiceId}`);
    }
}
export class PaymentFailedError extends BillingError {
    declineCode;
    constructor(message, declineCode) {
        super('PAYMENT_FAILED', message, true, 5000);
        this.declineCode = declineCode;
    }
}
export class PaymentMethodRequiredError extends BillingError {
    constructor() {
        super('PAYMENT_METHOD_REQUIRED', 'No payment method on file');
    }
}
export class AlreadySubscribedError extends BillingError {
    constructor(customerId, planId) {
        super('ALREADY_SUBSCRIBED', `Customer ${customerId} already subscribed to plan ${planId}`);
    }
}
export class InvalidCouponError extends BillingError {
    constructor(couponCode) {
        super('INVALID_COUPON', `Invalid or expired coupon: ${couponCode}`);
    }
}
// ============================================================================
// BILLING SERVICE
// ============================================================================
export class BillingService {
    provider;
    constructor(provider) {
        this.provider = provider;
    }
    // Subscriptions
    async createSubscription(input) {
        return this.provider.createSubscription(input);
    }
    async getSubscription(subscriptionId) {
        const subscription = await this.provider.getSubscription(subscriptionId);
        if (!subscription) {
            throw new SubscriptionNotFoundError(subscriptionId);
        }
        return subscription;
    }
    async cancelSubscription(input) {
        return this.provider.cancelSubscription(input);
    }
    async changePlan(input) {
        return this.provider.changePlan(input);
    }
    async pauseSubscription(subscriptionId, resumesAt) {
        return this.provider.pauseSubscription(subscriptionId, resumesAt);
    }
    async resumeSubscription(subscriptionId) {
        return this.provider.resumeSubscription(subscriptionId);
    }
    // Invoices
    async createInvoice(input) {
        return this.provider.createInvoice(input);
    }
    async getInvoice(invoiceId) {
        const invoice = await this.provider.getInvoice(invoiceId);
        if (!invoice) {
            throw new InvoiceNotFoundError(invoiceId);
        }
        return invoice;
    }
    async payInvoice(input) {
        return this.provider.payInvoice(input);
    }
    async voidInvoice(invoiceId) {
        return this.provider.voidInvoice(invoiceId);
    }
    // Usage
    async recordUsage(input) {
        return this.provider.recordUsage(input);
    }
    async getUsageSummary(subscriptionId, periodStart, periodEnd) {
        return this.provider.getUsageSummary(subscriptionId, periodStart, periodEnd);
    }
    // Payment Methods
    async attachPaymentMethod(paymentMethodId, customerId) {
        return this.provider.attachPaymentMethod(paymentMethodId, customerId);
    }
    async detachPaymentMethod(paymentMethodId) {
        return this.provider.detachPaymentMethod(paymentMethodId);
    }
    // Plans
    async getPlan(planId) {
        const plan = await this.provider.getPlan(planId);
        if (!plan) {
            throw new PlanNotFoundError(planId);
        }
        return plan;
    }
    async listPlans(active) {
        return this.provider.listPlans(active);
    }
    // Webhooks
    async handleWebhook(payload, signature) {
        return this.provider.handleWebhook(payload, signature);
    }
}
export function createBillingService(config) {
    // Implementation in stripe.ts and paddle.ts
    throw new Error('Use createStripeBillingService or createPaddleBillingService');
}
//# sourceMappingURL=index.js.map