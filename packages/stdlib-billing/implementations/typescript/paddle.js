/**
 * Paddle Billing Provider
 *
 * Implementation of BillingProviderInterface using Paddle.
 * Note: This is a simplified implementation. Paddle has a different model
 * than Stripe - it handles the entire checkout flow including payment collection.
 */
import { SubscriptionStatus, BillingInterval, InvoiceStatus, CollectionMethod, UsageAction, BillingService, BillingError, } from './index.js';
import * as crypto from 'node:crypto';
// ============================================================================
// PADDLE BILLING PROVIDER
// ============================================================================
export class PaddleBillingProvider {
    name = 'paddle';
    config;
    baseUrl;
    constructor(config) {
        this.config = config;
        this.baseUrl = config.environment === 'sandbox'
            ? 'https://sandbox-vendors.paddle.com/api/2.0'
            : 'https://vendors.paddle.com/api/2.0';
    }
    // ============================================================================
    // API HELPER
    // ============================================================================
    async paddleRequest(endpoint, data = {}) {
        const body = new URLSearchParams({
            vendor_id: this.config.vendorId,
            vendor_auth_code: this.config.apiKey,
            ...Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v)])),
        });
        const response = await fetch(`${this.baseUrl}${endpoint}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: body.toString(),
        });
        const result = await response.json();
        if (!result.success) {
            throw new BillingError('PADDLE_API_ERROR', result.error?.message ?? 'Paddle API error');
        }
        return result.response;
    }
    // ============================================================================
    // SUBSCRIPTIONS
    // ============================================================================
    async createSubscription(input) {
        // Paddle doesn't have a direct "create subscription" API
        // Subscriptions are created through the checkout flow
        // This would typically return a checkout URL instead
        throw new BillingError('NOT_IMPLEMENTED', 'Paddle subscriptions are created through the checkout flow. Use generateCheckoutUrl() instead.');
    }
    /**
     * Generate a Paddle checkout URL for subscription creation
     */
    async generateCheckoutUrl(input) {
        const params = new URLSearchParams({
            vendor_id: this.config.vendorId,
            product: input.planId,
        });
        if (input.customerEmail) {
            params.set('customer_email', input.customerEmail);
        }
        if (input.quantity) {
            params.set('quantity', String(input.quantity));
        }
        if (input.trialDays) {
            params.set('trial_days', String(input.trialDays));
        }
        if (input.couponCode) {
            params.set('coupon_code', input.couponCode);
        }
        if (input.passthrough) {
            params.set('passthrough', JSON.stringify(input.passthrough));
        }
        if (input.successUrl) {
            params.set('success_url', input.successUrl);
        }
        if (input.cancelUrl) {
            params.set('cancel_url', input.cancelUrl);
        }
        const baseCheckoutUrl = this.config.environment === 'sandbox'
            ? 'https://sandbox-checkout.paddle.com/checkout'
            : 'https://checkout.paddle.com/checkout';
        return `${baseCheckoutUrl}?${params.toString()}`;
    }
    async getSubscription(subscriptionId) {
        try {
            const response = await this.paddleRequest('/subscription/users', { subscription_id: subscriptionId });
            const paddleSub = response[0];
            if (!paddleSub)
                return null;
            return this.mapSubscription(paddleSub);
        }
        catch {
            return null;
        }
    }
    async updateSubscription(subscriptionId, updates) {
        const params = {
            subscription_id: subscriptionId,
        };
        if (updates.quantity !== undefined) {
            params['quantity'] = updates.quantity;
        }
        await this.paddleRequest('/subscription/users/update', params);
        const subscription = await this.getSubscription(subscriptionId);
        if (!subscription) {
            throw new BillingError('SUBSCRIPTION_NOT_FOUND', 'Subscription not found after update');
        }
        return subscription;
    }
    async cancelSubscription(input) {
        await this.paddleRequest('/subscription/users/cancel', {
            subscription_id: input.subscriptionId,
        });
        const subscription = await this.getSubscription(input.subscriptionId);
        if (!subscription) {
            throw new BillingError('SUBSCRIPTION_NOT_FOUND', 'Subscription not found');
        }
        return { subscription };
    }
    async changePlan(input) {
        await this.paddleRequest('/subscription/users/update', {
            subscription_id: input.subscriptionId,
            plan_id: input.newPlanId,
            quantity: input.quantity,
            prorate: input.prorationBehavior !== 'none',
        });
        const subscription = await this.getSubscription(input.subscriptionId);
        if (!subscription) {
            throw new BillingError('SUBSCRIPTION_NOT_FOUND', 'Subscription not found');
        }
        return { subscription };
    }
    async pauseSubscription(subscriptionId, resumesAt) {
        await this.paddleRequest('/subscription/users/pause', {
            subscription_id: subscriptionId,
            pause: true,
        });
        const subscription = await this.getSubscription(subscriptionId);
        if (!subscription) {
            throw new BillingError('SUBSCRIPTION_NOT_FOUND', 'Subscription not found');
        }
        return subscription;
    }
    async resumeSubscription(subscriptionId) {
        await this.paddleRequest('/subscription/users/pause', {
            subscription_id: subscriptionId,
            pause: false,
        });
        const subscription = await this.getSubscription(subscriptionId);
        if (!subscription) {
            throw new BillingError('SUBSCRIPTION_NOT_FOUND', 'Subscription not found');
        }
        return subscription;
    }
    // ============================================================================
    // INVOICES
    // ============================================================================
    async createInvoice(input) {
        // Paddle doesn't have a traditional invoice creation API
        // Invoices are created automatically with subscriptions/transactions
        throw new BillingError('NOT_IMPLEMENTED', 'Paddle creates invoices automatically with transactions');
    }
    async getInvoice(invoiceId) {
        try {
            const response = await this.paddleRequest('/order', { order_id: invoiceId });
            const transaction = response[0];
            if (!transaction)
                return null;
            return this.mapTransaction(transaction);
        }
        catch {
            return null;
        }
    }
    async payInvoice(input) {
        // Paddle handles payments through checkout
        throw new BillingError('NOT_IMPLEMENTED', 'Paddle handles payments through the checkout flow');
    }
    async voidInvoice(invoiceId) {
        // Paddle uses refunds instead of voiding
        throw new BillingError('NOT_IMPLEMENTED', 'Use refundTransaction() instead of voiding invoices in Paddle');
    }
    async finalizeInvoice(invoiceId) {
        // Paddle invoices are finalized automatically
        const invoice = await this.getInvoice(invoiceId);
        if (!invoice) {
            throw new BillingError('INVOICE_NOT_FOUND', 'Invoice not found');
        }
        return invoice;
    }
    /**
     * Refund a Paddle transaction
     */
    async refundTransaction(orderId, amount, reason) {
        const params = {
            order_id: orderId,
        };
        if (amount !== undefined) {
            params['amount'] = amount;
        }
        if (reason) {
            params['reason'] = reason;
        }
        await this.paddleRequest('/payment/refund', params);
    }
    // ============================================================================
    // USAGE
    // ============================================================================
    async recordUsage(input) {
        // Paddle has metered billing through their API
        await this.paddleRequest('/subscription/users/usage', {
            subscription_id: input.subscriptionId,
            quantity: input.quantity,
            action: input.action === UsageAction.SET ? 'set' : 'increment',
        });
        return {
            id: `usage_${Date.now()}`,
            subscriptionId: input.subscriptionId,
            quantity: input.quantity,
            timestamp: input.timestamp ?? new Date(),
            action: input.action ?? UsageAction.INCREMENT,
        };
    }
    async getUsageSummary(subscriptionId, periodStart, periodEnd) {
        // Paddle doesn't have a direct usage summary endpoint
        // You'd need to track usage separately
        return {
            subscriptionId,
            totalUsage: 0,
            periodStart: periodStart ?? new Date(),
            periodEnd: periodEnd ?? new Date(),
            records: [],
        };
    }
    // ============================================================================
    // PAYMENT METHODS
    // ============================================================================
    async getPaymentMethod(paymentMethodId) {
        // Paddle manages payment methods internally
        return null;
    }
    async attachPaymentMethod(paymentMethodId, customerId) {
        throw new BillingError('NOT_IMPLEMENTED', 'Paddle manages payment methods through the checkout flow');
    }
    async detachPaymentMethod(paymentMethodId) {
        // Paddle manages payment methods internally
    }
    // ============================================================================
    // PLANS
    // ============================================================================
    async getPlan(planId) {
        try {
            const response = await this.paddleRequest('/subscription/plans', { plan: planId });
            const plan = response[0];
            if (!plan)
                return null;
            return this.mapPlan(plan);
        }
        catch {
            return null;
        }
    }
    async listPlans(active) {
        const response = await this.paddleRequest('/subscription/plans');
        return response.map(plan => this.mapPlan(plan));
    }
    // ============================================================================
    // WEBHOOKS
    // ============================================================================
    async handleWebhook(payload, signature) {
        // Verify Paddle webhook signature
        if (this.config.webhookSecret) {
            const isValid = this.verifyWebhookSignature(payload, signature);
            if (!isValid) {
                throw new BillingError('INVALID_SIGNATURE', 'Invalid webhook signature');
            }
        }
        const data = JSON.parse(payload);
        return {
            id: `paddle_${Date.now()}`,
            type: data.alert_name,
            data: data,
            createdAt: new Date(),
            livemode: this.config.environment !== 'sandbox',
        };
    }
    verifyWebhookSignature(payload, signature) {
        if (!this.config.webhookSecret)
            return true;
        const data = JSON.parse(payload);
        const { p_signature, ...fields } = data;
        // Sort fields alphabetically
        const sorted = Object.keys(fields)
            .sort()
            .reduce((acc, key) => {
            acc[key] = fields[key] ?? '';
            return acc;
        }, {});
        // Serialize for verification
        const serialized = Object.entries(sorted)
            .map(([k, v]) => `${k}=${v}`)
            .join('');
        // Verify signature (Paddle uses RSA with SHA1)
        try {
            const verifier = crypto.createVerify('sha1');
            verifier.update(serialized);
            return verifier.verify(this.config.webhookSecret, p_signature, 'base64');
        }
        catch {
            return false;
        }
    }
    // ============================================================================
    // MAPPERS
    // ============================================================================
    mapSubscription(paddleSub) {
        return {
            id: paddleSub.subscription_id,
            customerId: paddleSub.user_id,
            planId: paddleSub.plan_id,
            status: this.mapSubscriptionStatus(paddleSub.status),
            currentPeriodStart: new Date(paddleSub.signup_date),
            currentPeriodEnd: new Date(paddleSub.next_bill_date),
            billingCycleAnchor: new Date(paddleSub.signup_date),
            cancelAtPeriodEnd: false,
            quantity: paddleSub.quantity,
            collectionMethod: CollectionMethod.CHARGE_AUTOMATICALLY,
            pauseCollection: paddleSub.paused_at
                ? {
                    behavior: 'void',
                    resumesAt: paddleSub.paused_from ? new Date(paddleSub.paused_from) : undefined,
                }
                : undefined,
            providerSubscriptionId: paddleSub.subscription_id,
            provider: 'paddle',
            createdAt: new Date(paddleSub.signup_date),
            updatedAt: new Date(),
        };
    }
    mapSubscriptionStatus(status) {
        const statusMap = {
            active: SubscriptionStatus.ACTIVE,
            trialing: SubscriptionStatus.TRIALING,
            past_due: SubscriptionStatus.PAST_DUE,
            paused: SubscriptionStatus.PAUSED,
            deleted: SubscriptionStatus.CANCELED,
        };
        return statusMap[status] ?? SubscriptionStatus.ACTIVE;
    }
    mapTransaction(transaction) {
        return {
            id: transaction.order_id,
            customerId: '',
            status: transaction.status === 'completed' ? InvoiceStatus.PAID : InvoiceStatus.OPEN,
            subtotal: parseFloat(transaction.amount),
            total: parseFloat(transaction.amount),
            amountDue: parseFloat(transaction.amount),
            amountPaid: transaction.status === 'completed' ? parseFloat(transaction.amount) : 0,
            amountRemaining: transaction.status === 'completed' ? 0 : parseFloat(transaction.amount),
            currency: transaction.currency,
            lineItems: [],
            paid: transaction.status === 'completed',
            collectionMethod: CollectionMethod.CHARGE_AUTOMATICALLY,
            attemptCount: 1,
            hostedInvoiceUrl: transaction.receipt_url,
            providerInvoiceId: transaction.order_id,
            provider: 'paddle',
            createdAt: new Date(transaction.created_at),
        };
    }
    mapPlan(paddlePlan) {
        const currency = Object.keys(paddlePlan.recurring_price)[0] ?? 'USD';
        const amount = parseFloat(paddlePlan.recurring_price[currency] ?? '0');
        return {
            id: paddlePlan.id,
            name: paddlePlan.name,
            amount,
            currency,
            interval: this.mapInterval(paddlePlan.billing_period_unit),
            intervalCount: paddlePlan.billing_period,
            trialDays: paddlePlan.trial_days,
            features: [],
            active: true,
            createdAt: new Date(),
            updatedAt: new Date(),
        };
    }
    mapInterval(unit) {
        const intervalMap = {
            day: BillingInterval.DAY,
            week: BillingInterval.WEEK,
            month: BillingInterval.MONTH,
            year: BillingInterval.YEAR,
        };
        return intervalMap[unit] ?? BillingInterval.MONTH;
    }
}
// ============================================================================
// FACTORY
// ============================================================================
export function createPaddleBillingService(config) {
    const provider = new PaddleBillingProvider(config);
    return new BillingService(provider);
}
export function createPaddleBillingServiceFromEnv() {
    const vendorId = process.env['PADDLE_VENDOR_ID'];
    const apiKey = process.env['PADDLE_API_KEY'];
    if (!vendorId || !apiKey) {
        throw new Error('PADDLE_VENDOR_ID and PADDLE_API_KEY environment variables are required');
    }
    return createPaddleBillingService({
        vendorId,
        apiKey,
        environment: process.env['PADDLE_ENVIRONMENT'] ?? 'production',
        webhookSecret: process.env['PADDLE_WEBHOOK_SECRET'],
    });
}
//# sourceMappingURL=paddle.js.map