/**
 * Stripe Billing Provider
 * 
 * Implementation of BillingProviderInterface using Stripe.
 */

import Stripe from 'stripe';
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
  PaymentMethodType,
  CollectionMethod,
  UsageAction,
  BillingService,
  PaymentFailedError,
  PaymentMethodRequiredError,
  InvalidCouponError,
  BillingError,
} from './index.js';

// ============================================================================
// CONFIGURATION
// ============================================================================

export interface StripeConfig {
  secretKey: string;
  webhookSecret?: string;
  apiVersion?: string;
}

// ============================================================================
// STRIPE BILLING PROVIDER
// ============================================================================

export class StripeBillingProvider implements BillingProviderInterface {
  readonly name = 'stripe' as const;
  private stripe: Stripe;
  private webhookSecret?: string;

  constructor(config: StripeConfig) {
    this.stripe = new Stripe(config.secretKey, {
      apiVersion: (config.apiVersion as Stripe.LatestApiVersion) ?? '2024-12-18.acacia',
    });
    this.webhookSecret = config.webhookSecret;
  }

  // ============================================================================
  // SUBSCRIPTIONS
  // ============================================================================

  async createSubscription(input: CreateSubscriptionInput): Promise<CreateSubscriptionResult> {
    const params: Stripe.SubscriptionCreateParams = {
      customer: input.customerId,
      items: [{ price: input.priceId ?? input.planId, quantity: input.quantity ?? 1 }],
      default_payment_method: input.paymentMethodId,
      collection_method: input.collectionMethod === CollectionMethod.SEND_INVOICE 
        ? 'send_invoice' 
        : 'charge_automatically',
      metadata: input.metadata,
      expand: ['latest_invoice', 'pending_setup_intent'],
    };

    // Handle trial
    if (input.trialDays !== undefined && input.trialDays > 0) {
      params.trial_period_days = input.trialDays;
    } else if (input.trialEnd) {
      params.trial_end = Math.floor(input.trialEnd.getTime() / 1000);
    }

    // Handle coupon
    if (input.couponCode) {
      params.coupon = input.couponCode;
    }

    try {
      const stripeSubscription = await this.stripe.subscriptions.create(params);
      
      const subscription = this.mapSubscription(stripeSubscription);
      const latestInvoice = stripeSubscription.latest_invoice 
        ? this.mapInvoice(stripeSubscription.latest_invoice as Stripe.Invoice)
        : undefined;

      return {
        subscription,
        latestInvoice,
        pendingSetupIntent: typeof stripeSubscription.pending_setup_intent === 'string'
          ? stripeSubscription.pending_setup_intent
          : stripeSubscription.pending_setup_intent?.id,
      };
    } catch (error) {
      if (error instanceof Stripe.errors.StripeError) {
        if (error.code === 'resource_missing' && error.param === 'coupon') {
          throw new InvalidCouponError(input.couponCode ?? '');
        }
        if (error.type === 'StripeCardError') {
          throw new PaymentFailedError(error.message, error.decline_code ?? undefined);
        }
      }
      throw error;
    }
  }

  async getSubscription(subscriptionId: SubscriptionId): Promise<Subscription | null> {
    try {
      const stripeSubscription = await this.stripe.subscriptions.retrieve(subscriptionId);
      return this.mapSubscription(stripeSubscription);
    } catch (error) {
      if (error instanceof Stripe.errors.StripeError && error.code === 'resource_missing') {
        return null;
      }
      throw error;
    }
  }

  async updateSubscription(
    subscriptionId: SubscriptionId,
    updates: Partial<Subscription>
  ): Promise<Subscription> {
    const params: Stripe.SubscriptionUpdateParams = {};

    if (updates.quantity !== undefined) {
      params.items = [{ quantity: updates.quantity }];
    }
    if (updates.defaultPaymentMethodId !== undefined) {
      params.default_payment_method = updates.defaultPaymentMethodId;
    }
    if (updates.metadata !== undefined) {
      params.metadata = updates.metadata;
    }

    const stripeSubscription = await this.stripe.subscriptions.update(subscriptionId, params);
    return this.mapSubscription(stripeSubscription);
  }

  async cancelSubscription(input: CancelSubscriptionInput): Promise<CancelSubscriptionResult> {
    let stripeSubscription: Stripe.Subscription;

    if (input.cancelImmediately) {
      stripeSubscription = await this.stripe.subscriptions.cancel(input.subscriptionId, {
        prorate: input.prorate,
      });
    } else if (input.cancelAt) {
      stripeSubscription = await this.stripe.subscriptions.update(input.subscriptionId, {
        cancel_at: Math.floor(input.cancelAt.getTime() / 1000),
      });
    } else {
      stripeSubscription = await this.stripe.subscriptions.update(input.subscriptionId, {
        cancel_at_period_end: true,
      });
    }

    return {
      subscription: this.mapSubscription(stripeSubscription),
    };
  }

  async changePlan(input: ChangePlanInput): Promise<ChangePlanResult> {
    const subscription = await this.stripe.subscriptions.retrieve(input.subscriptionId);
    const item = subscription.items.data[0];

    if (!item) {
      throw new BillingError('NO_SUBSCRIPTION_ITEM', 'Subscription has no items');
    }

    const params: Stripe.SubscriptionUpdateParams = {
      items: [{
        id: item.id,
        price: input.newPriceId ?? input.newPlanId,
        quantity: input.quantity,
      }],
      proration_behavior: input.prorationBehavior ?? 'create_prorations',
      expand: ['latest_invoice'],
    };

    const stripeSubscription = await this.stripe.subscriptions.update(
      input.subscriptionId,
      params
    );

    return {
      subscription: this.mapSubscription(stripeSubscription),
      invoice: stripeSubscription.latest_invoice 
        ? this.mapInvoice(stripeSubscription.latest_invoice as Stripe.Invoice)
        : undefined,
    };
  }

  async pauseSubscription(subscriptionId: SubscriptionId, resumesAt?: Date): Promise<Subscription> {
    const params: Stripe.SubscriptionUpdateParams = {
      pause_collection: {
        behavior: 'void',
        resumes_at: resumesAt ? Math.floor(resumesAt.getTime() / 1000) : undefined,
      },
    };

    const stripeSubscription = await this.stripe.subscriptions.update(subscriptionId, params);
    return this.mapSubscription(stripeSubscription);
  }

  async resumeSubscription(subscriptionId: SubscriptionId): Promise<Subscription> {
    const stripeSubscription = await this.stripe.subscriptions.update(subscriptionId, {
      pause_collection: '',
    });
    return this.mapSubscription(stripeSubscription);
  }

  // ============================================================================
  // INVOICES
  // ============================================================================

  async createInvoice(input: CreateInvoiceInput): Promise<Invoice> {
    // Create invoice items first if provided
    if (input.lineItems) {
      for (const item of input.lineItems) {
        await this.stripe.invoiceItems.create({
          customer: input.customerId,
          description: item.description,
          quantity: item.quantity,
          unit_amount: Math.round(item.unitAmount * 100),
          currency: 'usd',
        });
      }
    }

    const params: Stripe.InvoiceCreateParams = {
      customer: input.customerId,
      subscription: input.subscriptionId,
      collection_method: input.collectionMethod === CollectionMethod.SEND_INVOICE
        ? 'send_invoice'
        : 'charge_automatically',
      metadata: input.metadata,
    };

    if (input.dueDate) {
      params.due_date = Math.floor(input.dueDate.getTime() / 1000);
    }

    const stripeInvoice = await this.stripe.invoices.create(params);
    return this.mapInvoice(stripeInvoice);
  }

  async getInvoice(invoiceId: InvoiceId): Promise<Invoice | null> {
    try {
      const stripeInvoice = await this.stripe.invoices.retrieve(invoiceId, {
        expand: ['lines.data'],
      });
      return this.mapInvoice(stripeInvoice);
    } catch (error) {
      if (error instanceof Stripe.errors.StripeError && error.code === 'resource_missing') {
        return null;
      }
      throw error;
    }
  }

  async payInvoice(input: PayInvoiceInput): Promise<PayInvoiceResult> {
    try {
      const params: Stripe.InvoicePayParams = {};
      
      if (input.paymentMethodId) {
        params.payment_method = input.paymentMethodId;
      }

      const stripeInvoice = await this.stripe.invoices.pay(input.invoiceId, params);

      return {
        invoice: this.mapInvoice(stripeInvoice),
        paymentIntentId: typeof stripeInvoice.payment_intent === 'string'
          ? stripeInvoice.payment_intent
          : stripeInvoice.payment_intent?.id,
        chargeId: typeof stripeInvoice.charge === 'string'
          ? stripeInvoice.charge
          : stripeInvoice.charge?.id,
      };
    } catch (error) {
      if (error instanceof Stripe.errors.StripeCardError) {
        throw new PaymentFailedError(error.message, error.decline_code ?? undefined);
      }
      throw error;
    }
  }

  async voidInvoice(invoiceId: InvoiceId): Promise<Invoice> {
    const stripeInvoice = await this.stripe.invoices.voidInvoice(invoiceId);
    return this.mapInvoice(stripeInvoice);
  }

  async finalizeInvoice(invoiceId: InvoiceId): Promise<Invoice> {
    const stripeInvoice = await this.stripe.invoices.finalizeInvoice(invoiceId);
    return this.mapInvoice(stripeInvoice);
  }

  // ============================================================================
  // USAGE
  // ============================================================================

  async recordUsage(input: RecordUsageInput): Promise<UsageRecord> {
    const subscription = await this.stripe.subscriptions.retrieve(input.subscriptionId);
    const subscriptionItem = subscription.items.data[0];

    if (!subscriptionItem) {
      throw new BillingError('NO_SUBSCRIPTION_ITEM', 'Subscription has no items');
    }

    const params: Stripe.SubscriptionItemCreateUsageRecordParams = {
      quantity: input.quantity,
      action: input.action === UsageAction.SET ? 'set' : 'increment',
    };

    if (input.timestamp) {
      params.timestamp = Math.floor(input.timestamp.getTime() / 1000);
    }

    if (input.idempotencyKey) {
      // Note: Stripe handles idempotency via request options, not params
    }

    const usageRecord = await this.stripe.subscriptionItems.createUsageRecord(
      subscriptionItem.id,
      params
    );

    return {
      id: usageRecord.id,
      subscriptionId: input.subscriptionId,
      quantity: usageRecord.quantity,
      timestamp: new Date(usageRecord.timestamp * 1000),
      action: input.action ?? UsageAction.INCREMENT,
    };
  }

  async getUsageSummary(
    subscriptionId: SubscriptionId,
    periodStart?: Date,
    periodEnd?: Date
  ): Promise<UsageSummary> {
    const subscription = await this.stripe.subscriptions.retrieve(subscriptionId);
    const subscriptionItem = subscription.items.data[0];

    if (!subscriptionItem) {
      throw new BillingError('NO_SUBSCRIPTION_ITEM', 'Subscription has no items');
    }

    const usageRecordSummaries = await this.stripe.subscriptionItems.listUsageRecordSummaries(
      subscriptionItem.id,
      { limit: 100 }
    );

    const start = periodStart ?? new Date(subscription.current_period_start * 1000);
    const end = periodEnd ?? new Date(subscription.current_period_end * 1000);

    return {
      subscriptionId,
      totalUsage: usageRecordSummaries.data.reduce((sum, r) => sum + r.total_usage, 0),
      periodStart: start,
      periodEnd: end,
      records: [], // Stripe doesn't return individual records in summary
    };
  }

  // ============================================================================
  // PAYMENT METHODS
  // ============================================================================

  async getPaymentMethod(paymentMethodId: PaymentMethodId): Promise<PaymentMethod | null> {
    try {
      const stripePaymentMethod = await this.stripe.paymentMethods.retrieve(paymentMethodId);
      return this.mapPaymentMethod(stripePaymentMethod);
    } catch (error) {
      if (error instanceof Stripe.errors.StripeError && error.code === 'resource_missing') {
        return null;
      }
      throw error;
    }
  }

  async attachPaymentMethod(
    paymentMethodId: PaymentMethodId,
    customerId: CustomerId
  ): Promise<PaymentMethod> {
    const stripePaymentMethod = await this.stripe.paymentMethods.attach(paymentMethodId, {
      customer: customerId,
    });
    return this.mapPaymentMethod(stripePaymentMethod);
  }

  async detachPaymentMethod(paymentMethodId: PaymentMethodId): Promise<void> {
    await this.stripe.paymentMethods.detach(paymentMethodId);
  }

  // ============================================================================
  // PLANS
  // ============================================================================

  async getPlan(planId: PlanId): Promise<Plan | null> {
    try {
      const stripePrice = await this.stripe.prices.retrieve(planId, {
        expand: ['product'],
      });
      return this.mapPrice(stripePrice);
    } catch (error) {
      if (error instanceof Stripe.errors.StripeError && error.code === 'resource_missing') {
        return null;
      }
      throw error;
    }
  }

  async listPlans(active?: boolean): Promise<Plan[]> {
    const params: Stripe.PriceListParams = {
      expand: ['data.product'],
      limit: 100,
    };

    if (active !== undefined) {
      params.active = active;
    }

    const stripePrices = await this.stripe.prices.list(params);
    return stripePrices.data.map(price => this.mapPrice(price));
  }

  // ============================================================================
  // WEBHOOKS
  // ============================================================================

  async handleWebhook(payload: string, signature: string): Promise<WebhookEvent> {
    if (!this.webhookSecret) {
      throw new BillingError('WEBHOOK_SECRET_MISSING', 'Webhook secret not configured');
    }

    const event = this.stripe.webhooks.constructEvent(payload, signature, this.webhookSecret);

    return {
      id: event.id,
      type: event.type,
      data: event.data.object as Record<string, unknown>,
      createdAt: new Date(event.created * 1000),
      livemode: event.livemode,
    };
  }

  // ============================================================================
  // MAPPERS
  // ============================================================================

  private mapSubscription(stripeSubscription: Stripe.Subscription): Subscription {
    return {
      id: stripeSubscription.id,
      customerId: typeof stripeSubscription.customer === 'string'
        ? stripeSubscription.customer
        : stripeSubscription.customer.id,
      planId: stripeSubscription.items.data[0]?.price?.id ?? '',
      priceId: stripeSubscription.items.data[0]?.price?.id,
      status: this.mapSubscriptionStatus(stripeSubscription.status),
      currentPeriodStart: new Date(stripeSubscription.current_period_start * 1000),
      currentPeriodEnd: new Date(stripeSubscription.current_period_end * 1000),
      billingCycleAnchor: new Date(stripeSubscription.billing_cycle_anchor * 1000),
      trialStart: stripeSubscription.trial_start
        ? new Date(stripeSubscription.trial_start * 1000)
        : undefined,
      trialEnd: stripeSubscription.trial_end
        ? new Date(stripeSubscription.trial_end * 1000)
        : undefined,
      canceledAt: stripeSubscription.canceled_at
        ? new Date(stripeSubscription.canceled_at * 1000)
        : undefined,
      cancelAt: stripeSubscription.cancel_at
        ? new Date(stripeSubscription.cancel_at * 1000)
        : undefined,
      cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end,
      quantity: stripeSubscription.items.data[0]?.quantity ?? 1,
      collectionMethod: stripeSubscription.collection_method === 'send_invoice'
        ? CollectionMethod.SEND_INVOICE
        : CollectionMethod.CHARGE_AUTOMATICALLY,
      defaultPaymentMethodId: typeof stripeSubscription.default_payment_method === 'string'
        ? stripeSubscription.default_payment_method
        : stripeSubscription.default_payment_method?.id,
      latestInvoiceId: typeof stripeSubscription.latest_invoice === 'string'
        ? stripeSubscription.latest_invoice
        : stripeSubscription.latest_invoice?.id,
      pauseCollection: stripeSubscription.pause_collection
        ? {
            behavior: stripeSubscription.pause_collection.behavior as 'keep_as_draft' | 'mark_uncollectible' | 'void',
            resumesAt: stripeSubscription.pause_collection.resumes_at
              ? new Date(stripeSubscription.pause_collection.resumes_at * 1000)
              : undefined,
          }
        : undefined,
      metadata: stripeSubscription.metadata as Record<string, string>,
      providerSubscriptionId: stripeSubscription.id,
      provider: 'stripe',
      createdAt: new Date(stripeSubscription.created * 1000),
      updatedAt: new Date(),
      endedAt: stripeSubscription.ended_at
        ? new Date(stripeSubscription.ended_at * 1000)
        : undefined,
    };
  }

  private mapSubscriptionStatus(status: Stripe.Subscription.Status): SubscriptionStatus {
    const statusMap: Record<Stripe.Subscription.Status, SubscriptionStatus> = {
      active: SubscriptionStatus.ACTIVE,
      canceled: SubscriptionStatus.CANCELED,
      incomplete: SubscriptionStatus.INCOMPLETE,
      incomplete_expired: SubscriptionStatus.CANCELED,
      past_due: SubscriptionStatus.PAST_DUE,
      paused: SubscriptionStatus.PAUSED,
      trialing: SubscriptionStatus.TRIALING,
      unpaid: SubscriptionStatus.UNPAID,
    };
    return statusMap[status] ?? SubscriptionStatus.ACTIVE;
  }

  private mapInvoice(stripeInvoice: Stripe.Invoice): Invoice {
    return {
      id: stripeInvoice.id,
      number: stripeInvoice.number ?? undefined,
      customerId: typeof stripeInvoice.customer === 'string'
        ? stripeInvoice.customer
        : stripeInvoice.customer?.id ?? '',
      subscriptionId: typeof stripeInvoice.subscription === 'string'
        ? stripeInvoice.subscription
        : stripeInvoice.subscription?.id,
      status: this.mapInvoiceStatus(stripeInvoice.status),
      subtotal: stripeInvoice.subtotal / 100,
      tax: stripeInvoice.tax ? stripeInvoice.tax / 100 : undefined,
      total: stripeInvoice.total / 100,
      amountDue: stripeInvoice.amount_due / 100,
      amountPaid: stripeInvoice.amount_paid / 100,
      amountRemaining: stripeInvoice.amount_remaining / 100,
      currency: stripeInvoice.currency.toUpperCase(),
      lineItems: stripeInvoice.lines?.data.map(line => ({
        id: line.id,
        description: line.description ?? '',
        quantity: line.quantity ?? 1,
        unitAmount: ((typeof line.price !== 'string' ? line.price?.unit_amount : null) ?? 0) / 100,
        amount: line.amount / 100,
        periodStart: line.period?.start ? new Date(line.period.start * 1000) : undefined,
        periodEnd: line.period?.end ? new Date(line.period.end * 1000) : undefined,
        proration: line.proration,
        priceId: typeof line.price === 'string' ? line.price : line.price?.id,
      })) ?? [],
      periodStart: stripeInvoice.period_start
        ? new Date(stripeInvoice.period_start * 1000)
        : undefined,
      periodEnd: stripeInvoice.period_end
        ? new Date(stripeInvoice.period_end * 1000)
        : undefined,
      dueDate: stripeInvoice.due_date
        ? new Date(stripeInvoice.due_date * 1000)
        : undefined,
      paid: stripeInvoice.paid,
      paidAt: stripeInvoice.status_transitions?.paid_at
        ? new Date(stripeInvoice.status_transitions.paid_at * 1000)
        : undefined,
      collectionMethod: stripeInvoice.collection_method === 'send_invoice'
        ? CollectionMethod.SEND_INVOICE
        : CollectionMethod.CHARGE_AUTOMATICALLY,
      attemptCount: stripeInvoice.attempt_count,
      hostedInvoiceUrl: stripeInvoice.hosted_invoice_url ?? undefined,
      invoicePdf: stripeInvoice.invoice_pdf ?? undefined,
      metadata: stripeInvoice.metadata as Record<string, string>,
      providerInvoiceId: stripeInvoice.id,
      provider: 'stripe',
      createdAt: new Date(stripeInvoice.created * 1000),
      finalizedAt: stripeInvoice.status_transitions?.finalized_at
        ? new Date(stripeInvoice.status_transitions.finalized_at * 1000)
        : undefined,
      voidedAt: stripeInvoice.status_transitions?.voided_at
        ? new Date(stripeInvoice.status_transitions.voided_at * 1000)
        : undefined,
    };
  }

  private mapInvoiceStatus(status: Stripe.Invoice.Status | null): InvoiceStatus {
    if (!status) return InvoiceStatus.DRAFT;
    const statusMap: Record<Stripe.Invoice.Status, InvoiceStatus> = {
      draft: InvoiceStatus.DRAFT,
      open: InvoiceStatus.OPEN,
      paid: InvoiceStatus.PAID,
      void: InvoiceStatus.VOID,
      uncollectible: InvoiceStatus.UNCOLLECTIBLE,
    };
    return statusMap[status] ?? InvoiceStatus.DRAFT;
  }

  private mapPaymentMethod(stripePaymentMethod: Stripe.PaymentMethod): PaymentMethod {
    return {
      id: stripePaymentMethod.id,
      customerId: typeof stripePaymentMethod.customer === 'string'
        ? stripePaymentMethod.customer
        : stripePaymentMethod.customer?.id,
      type: this.mapPaymentMethodType(stripePaymentMethod.type),
      card: stripePaymentMethod.card
        ? {
            brand: stripePaymentMethod.card.brand,
            last4: stripePaymentMethod.card.last4,
            expMonth: stripePaymentMethod.card.exp_month,
            expYear: stripePaymentMethod.card.exp_year,
            funding: stripePaymentMethod.card.funding as 'credit' | 'debit' | 'prepaid',
            country: stripePaymentMethod.card.country ?? undefined,
          }
        : undefined,
      billingDetails: stripePaymentMethod.billing_details
        ? {
            name: stripePaymentMethod.billing_details.name ?? undefined,
            email: stripePaymentMethod.billing_details.email ?? undefined,
            phone: stripePaymentMethod.billing_details.phone ?? undefined,
            address: stripePaymentMethod.billing_details.address
              ? {
                  line1: stripePaymentMethod.billing_details.address.line1 ?? '',
                  line2: stripePaymentMethod.billing_details.address.line2 ?? undefined,
                  city: stripePaymentMethod.billing_details.address.city ?? '',
                  state: stripePaymentMethod.billing_details.address.state ?? undefined,
                  postalCode: stripePaymentMethod.billing_details.address.postal_code ?? '',
                  country: stripePaymentMethod.billing_details.address.country ?? '',
                }
              : undefined,
          }
        : undefined,
      providerPaymentMethodId: stripePaymentMethod.id,
      provider: 'stripe',
      createdAt: new Date(stripePaymentMethod.created * 1000),
    };
  }

  private mapPaymentMethodType(type: Stripe.PaymentMethod.Type): PaymentMethodType {
    const typeMap: Partial<Record<Stripe.PaymentMethod.Type, PaymentMethodType>> = {
      card: PaymentMethodType.CARD,
      us_bank_account: PaymentMethodType.BANK_ACCOUNT,
      sepa_debit: PaymentMethodType.SEPA_DEBIT,
      paypal: PaymentMethodType.PAYPAL,
    };
    return typeMap[type] ?? PaymentMethodType.CARD;
  }

  private mapPrice(stripePrice: Stripe.Price): Plan {
    const product = stripePrice.product as Stripe.Product;
    
    return {
      id: stripePrice.id,
      name: product?.name ?? stripePrice.nickname ?? stripePrice.id,
      description: product?.description ?? undefined,
      amount: (stripePrice.unit_amount ?? 0) / 100,
      currency: stripePrice.currency.toUpperCase(),
      interval: this.mapInterval(stripePrice.recurring?.interval),
      intervalCount: stripePrice.recurring?.interval_count ?? 1,
      trialDays: stripePrice.recurring?.trial_period_days ?? undefined,
      features: product?.features?.map(f => f.name ?? '') ?? [],
      usageType: stripePrice.recurring?.usage_type === 'metered' ? 'metered' : 'licensed',
      metadata: stripePrice.metadata as Record<string, string>,
      active: stripePrice.active,
      createdAt: new Date(stripePrice.created * 1000),
      updatedAt: new Date(),
    };
  }

  private mapInterval(interval: Stripe.Price.Recurring.Interval | undefined): BillingInterval {
    if (!interval) return BillingInterval.MONTH;
    const intervalMap: Record<Stripe.Price.Recurring.Interval, BillingInterval> = {
      day: BillingInterval.DAY,
      week: BillingInterval.WEEK,
      month: BillingInterval.MONTH,
      year: BillingInterval.YEAR,
    };
    return intervalMap[interval];
  }
}

// ============================================================================
// FACTORY
// ============================================================================

export function createStripeBillingService(config: StripeConfig): BillingService {
  const provider = new StripeBillingProvider(config);
  return new BillingService(provider);
}

export function createStripeBillingServiceFromEnv(): BillingService {
  const secretKey = process.env['STRIPE_SECRET_KEY'];
  if (!secretKey) {
    throw new Error('STRIPE_SECRET_KEY environment variable is required');
  }

  return createStripeBillingService({
    secretKey,
    webhookSecret: process.env['STRIPE_WEBHOOK_SECRET'],
  });
}
