/**
 * Paddle Billing Provider
 * 
 * Implementation of BillingProviderInterface using Paddle.
 * Note: This is a simplified implementation. Paddle has a different model
 * than Stripe - it handles the entire checkout flow including payment collection.
 */

import {
  type BillingProviderInterface,
  type Subscription,
  type Invoice,
  type Plan,
  type PaymentMethod,
  type UsageRecord,
  type UsageSummary,
  type WebhookEvent,
  type CreateSubscriptionInput,
  type CreateSubscriptionResult,
  type CancelSubscriptionInput,
  type CancelSubscriptionResult,
  type ChangePlanInput,
  type ChangePlanResult,
  type RecordUsageInput,
  type CreateInvoiceInput,
  type PayInvoiceInput,
  type PayInvoiceResult,
  type CustomerId,
  type SubscriptionId,
  type InvoiceId,
  type PlanId,
  type PaymentMethodId,
  SubscriptionStatus,
  BillingInterval,
  InvoiceStatus,
  CollectionMethod,
  UsageAction,
  BillingService,
  BillingError,
} from './index.js';
import * as crypto from 'node:crypto';

// ============================================================================
// CONFIGURATION
// ============================================================================

export interface PaddleConfig {
  vendorId: string;
  apiKey: string;
  environment?: 'sandbox' | 'production';
  webhookSecret?: string;
}

// ============================================================================
// PADDLE API TYPES
// ============================================================================

interface PaddleSubscription {
  subscription_id: string;
  user_id: string;
  plan_id: string;
  status: string;
  quantity: number;
  signup_date: string;
  next_bill_date: string;
  update_url: string;
  cancel_url: string;
  paused_at?: string;
  paused_from?: string;
}

interface PaddlePlan {
  id: string;
  name: string;
  billing_type: string;
  billing_period: number;
  billing_period_unit: string;
  initial_price: Record<string, string>;
  recurring_price: Record<string, string>;
  trial_days: number;
}

interface PaddleTransaction {
  order_id: string;
  checkout_id: string;
  amount: string;
  currency: string;
  status: string;
  created_at: string;
  receipt_url: string;
}

// ============================================================================
// PADDLE BILLING PROVIDER
// ============================================================================

export class PaddleBillingProvider implements BillingProviderInterface {
  readonly name = 'paddle' as const;
  private config: PaddleConfig;
  private baseUrl: string;

  constructor(config: PaddleConfig) {
    this.config = config;
    this.baseUrl = config.environment === 'sandbox'
      ? 'https://sandbox-vendors.paddle.com/api/2.0'
      : 'https://vendors.paddle.com/api/2.0';
  }

  // ============================================================================
  // API HELPER
  // ============================================================================

  private async paddleRequest<T>(
    endpoint: string,
    data: Record<string, unknown> = {}
  ): Promise<T> {
    const body = new URLSearchParams({
      vendor_id: this.config.vendorId,
      vendor_auth_code: this.config.apiKey,
      ...Object.fromEntries(
        Object.entries(data).map(([k, v]) => [k, String(v)])
      ),
    });

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    });

    const result = await response.json() as { success: boolean; response: T; error?: { message: string } };

    if (!result.success) {
      throw new BillingError(
        'PADDLE_API_ERROR',
        result.error?.message ?? 'Paddle API error'
      );
    }

    return result.response;
  }

  // ============================================================================
  // SUBSCRIPTIONS
  // ============================================================================

  async createSubscription(input: CreateSubscriptionInput): Promise<CreateSubscriptionResult> {
    // Paddle doesn't have a direct "create subscription" API
    // Subscriptions are created through the checkout flow
    // This would typically return a checkout URL instead
    
    throw new BillingError(
      'NOT_IMPLEMENTED',
      'Paddle subscriptions are created through the checkout flow. Use generateCheckoutUrl() instead.'
    );
  }

  /**
   * Generate a Paddle checkout URL for subscription creation
   */
  async generateCheckoutUrl(input: {
    planId: PlanId;
    customerId?: CustomerId;
    customerEmail?: string;
    quantity?: number;
    trialDays?: number;
    couponCode?: string;
    passthrough?: Record<string, unknown>;
    successUrl?: string;
    cancelUrl?: string;
  }): Promise<string> {
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

  async getSubscription(subscriptionId: SubscriptionId): Promise<Subscription | null> {
    try {
      const response = await this.paddleRequest<PaddleSubscription[]>(
        '/subscription/users',
        { subscription_id: subscriptionId }
      );

      const paddleSub = response[0];
      if (!paddleSub) return null;

      return this.mapSubscription(paddleSub);
    } catch {
      return null;
    }
  }

  async updateSubscription(
    subscriptionId: SubscriptionId,
    updates: Partial<Subscription>
  ): Promise<Subscription> {
    const params: Record<string, unknown> = {
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

  async cancelSubscription(input: CancelSubscriptionInput): Promise<CancelSubscriptionResult> {
    await this.paddleRequest('/subscription/users/cancel', {
      subscription_id: input.subscriptionId,
    });

    const subscription = await this.getSubscription(input.subscriptionId);
    if (!subscription) {
      throw new BillingError('SUBSCRIPTION_NOT_FOUND', 'Subscription not found');
    }

    return { subscription };
  }

  async changePlan(input: ChangePlanInput): Promise<ChangePlanResult> {
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

  async pauseSubscription(subscriptionId: SubscriptionId, resumesAt?: Date): Promise<Subscription> {
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

  async resumeSubscription(subscriptionId: SubscriptionId): Promise<Subscription> {
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

  async createInvoice(input: CreateInvoiceInput): Promise<Invoice> {
    // Paddle doesn't have a traditional invoice creation API
    // Invoices are created automatically with subscriptions/transactions
    throw new BillingError(
      'NOT_IMPLEMENTED',
      'Paddle creates invoices automatically with transactions'
    );
  }

  async getInvoice(invoiceId: InvoiceId): Promise<Invoice | null> {
    try {
      const response = await this.paddleRequest<PaddleTransaction[]>(
        '/order',
        { order_id: invoiceId }
      );

      const transaction = response[0];
      if (!transaction) return null;

      return this.mapTransaction(transaction);
    } catch {
      return null;
    }
  }

  async payInvoice(input: PayInvoiceInput): Promise<PayInvoiceResult> {
    // Paddle handles payments through checkout
    throw new BillingError(
      'NOT_IMPLEMENTED',
      'Paddle handles payments through the checkout flow'
    );
  }

  async voidInvoice(invoiceId: InvoiceId): Promise<Invoice> {
    // Paddle uses refunds instead of voiding
    throw new BillingError(
      'NOT_IMPLEMENTED',
      'Use refundTransaction() instead of voiding invoices in Paddle'
    );
  }

  async finalizeInvoice(invoiceId: InvoiceId): Promise<Invoice> {
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
  async refundTransaction(orderId: string, amount?: number, reason?: string): Promise<void> {
    const params: Record<string, unknown> = {
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

  async recordUsage(input: RecordUsageInput): Promise<UsageRecord> {
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

  async getUsageSummary(
    subscriptionId: SubscriptionId,
    periodStart?: Date,
    periodEnd?: Date
  ): Promise<UsageSummary> {
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

  async getPaymentMethod(paymentMethodId: PaymentMethodId): Promise<PaymentMethod | null> {
    // Paddle manages payment methods internally
    return null;
  }

  async attachPaymentMethod(
    paymentMethodId: PaymentMethodId,
    customerId: CustomerId
  ): Promise<PaymentMethod> {
    throw new BillingError(
      'NOT_IMPLEMENTED',
      'Paddle manages payment methods through the checkout flow'
    );
  }

  async detachPaymentMethod(paymentMethodId: PaymentMethodId): Promise<void> {
    // Paddle manages payment methods internally
  }

  // ============================================================================
  // PLANS
  // ============================================================================

  async getPlan(planId: PlanId): Promise<Plan | null> {
    try {
      const response = await this.paddleRequest<PaddlePlan[]>(
        '/subscription/plans',
        { plan: planId }
      );

      const plan = response[0];
      if (!plan) return null;

      return this.mapPlan(plan);
    } catch {
      return null;
    }
  }

  async listPlans(active?: boolean): Promise<Plan[]> {
    const response = await this.paddleRequest<PaddlePlan[]>('/subscription/plans');
    return response.map(plan => this.mapPlan(plan));
  }

  // ============================================================================
  // WEBHOOKS
  // ============================================================================

  async handleWebhook(payload: string, signature: string): Promise<WebhookEvent> {
    // Verify Paddle webhook signature
    if (this.config.webhookSecret) {
      const isValid = this.verifyWebhookSignature(payload, signature);
      if (!isValid) {
        throw new BillingError('INVALID_SIGNATURE', 'Invalid webhook signature');
      }
    }

    const data = JSON.parse(payload) as { alert_name: string; p_signature: string; [key: string]: unknown };

    return {
      id: `paddle_${Date.now()}`,
      type: data.alert_name,
      data: data as Record<string, unknown>,
      createdAt: new Date(),
      livemode: this.config.environment !== 'sandbox',
    };
  }

  private verifyWebhookSignature(payload: string, signature: string): boolean {
    if (!this.config.webhookSecret) return true;

    const data = JSON.parse(payload) as Record<string, string>;
    const { p_signature, ...fields } = data;

    // Sort fields alphabetically
    const sorted = Object.keys(fields)
      .sort()
      .reduce((acc, key) => {
        acc[key] = fields[key] ?? '';
        return acc;
      }, {} as Record<string, string>);

    // Serialize for verification
    const serialized = Object.entries(sorted)
      .map(([k, v]) => `${k}=${v}`)
      .join('');

    // Verify signature (Paddle uses RSA with SHA1)
    try {
      const verifier = crypto.createVerify('sha1');
      verifier.update(serialized);
      return verifier.verify(this.config.webhookSecret, p_signature, 'base64');
    } catch {
      return false;
    }
  }

  // ============================================================================
  // MAPPERS
  // ============================================================================

  private mapSubscription(paddleSub: PaddleSubscription): Subscription {
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

  private mapSubscriptionStatus(status: string): SubscriptionStatus {
    const statusMap: Record<string, SubscriptionStatus> = {
      active: SubscriptionStatus.ACTIVE,
      trialing: SubscriptionStatus.TRIALING,
      past_due: SubscriptionStatus.PAST_DUE,
      paused: SubscriptionStatus.PAUSED,
      deleted: SubscriptionStatus.CANCELED,
    };
    return statusMap[status] ?? SubscriptionStatus.ACTIVE;
  }

  private mapTransaction(transaction: PaddleTransaction): Invoice {
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

  private mapPlan(paddlePlan: PaddlePlan): Plan {
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

  private mapInterval(unit: string): BillingInterval {
    const intervalMap: Record<string, BillingInterval> = {
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

export function createPaddleBillingService(config: PaddleConfig): BillingService {
  const provider = new PaddleBillingProvider(config);
  return new BillingService(provider);
}

export function createPaddleBillingServiceFromEnv(): BillingService {
  const vendorId = process.env['PADDLE_VENDOR_ID'];
  const apiKey = process.env['PADDLE_API_KEY'];

  if (!vendorId || !apiKey) {
    throw new Error('PADDLE_VENDOR_ID and PADDLE_API_KEY environment variables are required');
  }

  return createPaddleBillingService({
    vendorId,
    apiKey,
    environment: process.env['PADDLE_ENVIRONMENT'] as 'sandbox' | 'production' ?? 'production',
    webhookSecret: process.env['PADDLE_WEBHOOK_SECRET'],
  });
}
