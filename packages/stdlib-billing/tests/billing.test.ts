/**
 * Tests for stdlib-billing
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  BillingService,
  SubscriptionStatus,
  BillingInterval,
  InvoiceStatus,
  CollectionMethod,
  UsageAction,
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
  SubscriptionNotFoundError,
  InvoiceNotFoundError,
  PlanNotFoundError,
} from '../implementations/typescript/index.js';

// ============================================================================
// MOCK PROVIDER
// ============================================================================

function createMockProvider(): BillingProviderInterface {
  const subscriptions = new Map<string, Subscription>();
  const invoices = new Map<string, Invoice>();
  const plans = new Map<string, Plan>();
  const usageRecords: UsageRecord[] = [];

  // Add default plan
  plans.set('plan_pro', {
    id: 'plan_pro',
    name: 'Pro Plan',
    amount: 99,
    currency: 'USD',
    interval: BillingInterval.MONTH,
    intervalCount: 1,
    trialDays: 14,
    features: ['Feature 1', 'Feature 2'],
    active: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  plans.set('plan_enterprise', {
    id: 'plan_enterprise',
    name: 'Enterprise Plan',
    amount: 299,
    currency: 'USD',
    interval: BillingInterval.MONTH,
    intervalCount: 1,
    features: ['All Pro features', 'Priority support'],
    active: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  let subIdCounter = 1;
  let invIdCounter = 1;
  let usageIdCounter = 1;

  return {
    name: 'internal' as const,

    async createSubscription(input: CreateSubscriptionInput): Promise<CreateSubscriptionResult> {
      const id = `sub_${subIdCounter++}`;
      const now = new Date();
      const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      
      const subscription: Subscription = {
        id,
        customerId: input.customerId,
        planId: input.planId,
        priceId: input.priceId,
        status: input.trialDays && input.trialDays > 0 
          ? SubscriptionStatus.TRIALING 
          : SubscriptionStatus.ACTIVE,
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        billingCycleAnchor: now,
        trialStart: input.trialDays ? now : undefined,
        trialEnd: input.trialDays 
          ? new Date(now.getTime() + input.trialDays * 24 * 60 * 60 * 1000)
          : undefined,
        cancelAtPeriodEnd: false,
        quantity: input.quantity ?? 1,
        collectionMethod: input.collectionMethod ?? CollectionMethod.CHARGE_AUTOMATICALLY,
        defaultPaymentMethodId: input.paymentMethodId,
        metadata: input.metadata,
        provider: 'internal',
        createdAt: now,
        updatedAt: now,
      };

      subscriptions.set(id, subscription);

      return { subscription };
    },

    async getSubscription(subscriptionId: string): Promise<Subscription | null> {
      return subscriptions.get(subscriptionId) ?? null;
    },

    async updateSubscription(
      subscriptionId: string,
      updates: Partial<Subscription>
    ): Promise<Subscription> {
      const subscription = subscriptions.get(subscriptionId);
      if (!subscription) {
        throw new Error('Subscription not found');
      }

      const updated = { ...subscription, ...updates, updatedAt: new Date() };
      subscriptions.set(subscriptionId, updated);
      return updated;
    },

    async cancelSubscription(input: CancelSubscriptionInput): Promise<CancelSubscriptionResult> {
      const subscription = subscriptions.get(input.subscriptionId);
      if (!subscription) {
        throw new Error('Subscription not found');
      }

      const now = new Date();
      let updated: Subscription;

      if (input.cancelImmediately) {
        updated = {
          ...subscription,
          status: SubscriptionStatus.CANCELED,
          canceledAt: now,
          endedAt: now,
          updatedAt: now,
        };
      } else {
        updated = {
          ...subscription,
          cancelAtPeriodEnd: true,
          updatedAt: now,
        };
      }

      subscriptions.set(input.subscriptionId, updated);
      return { subscription: updated };
    },

    async changePlan(input: ChangePlanInput): Promise<ChangePlanResult> {
      const subscription = subscriptions.get(input.subscriptionId);
      if (!subscription) {
        throw new Error('Subscription not found');
      }

      const updated: Subscription = {
        ...subscription,
        planId: input.newPlanId,
        priceId: input.newPriceId,
        quantity: input.quantity ?? subscription.quantity,
        updatedAt: new Date(),
      };

      subscriptions.set(input.subscriptionId, updated);
      return { subscription: updated };
    },

    async pauseSubscription(subscriptionId: string, resumesAt?: Date): Promise<Subscription> {
      const subscription = subscriptions.get(subscriptionId);
      if (!subscription) {
        throw new Error('Subscription not found');
      }

      const updated: Subscription = {
        ...subscription,
        status: SubscriptionStatus.PAUSED,
        pauseCollection: {
          behavior: 'void',
          resumesAt,
        },
        updatedAt: new Date(),
      };

      subscriptions.set(subscriptionId, updated);
      return updated;
    },

    async resumeSubscription(subscriptionId: string): Promise<Subscription> {
      const subscription = subscriptions.get(subscriptionId);
      if (!subscription) {
        throw new Error('Subscription not found');
      }

      const updated: Subscription = {
        ...subscription,
        status: SubscriptionStatus.ACTIVE,
        pauseCollection: undefined,
        updatedAt: new Date(),
      };

      subscriptions.set(subscriptionId, updated);
      return updated;
    },

    async createInvoice(input: CreateInvoiceInput): Promise<Invoice> {
      const id = `inv_${invIdCounter++}`;
      const now = new Date();
      
      const lineItems = (input.lineItems ?? []).map((item, i) => ({
        id: `li_${i}`,
        description: item.description,
        quantity: item.quantity,
        unitAmount: item.unitAmount,
        amount: item.quantity * item.unitAmount,
      }));

      const total = lineItems.reduce((sum, item) => sum + item.amount, 0);

      const invoice: Invoice = {
        id,
        customerId: input.customerId,
        subscriptionId: input.subscriptionId,
        status: InvoiceStatus.DRAFT,
        subtotal: total,
        total,
        amountDue: total,
        amountPaid: 0,
        amountRemaining: total,
        currency: 'USD',
        lineItems,
        paid: false,
        collectionMethod: input.collectionMethod ?? CollectionMethod.CHARGE_AUTOMATICALLY,
        attemptCount: 0,
        metadata: input.metadata,
        provider: 'internal',
        createdAt: now,
      };

      invoices.set(id, invoice);
      return invoice;
    },

    async getInvoice(invoiceId: string): Promise<Invoice | null> {
      return invoices.get(invoiceId) ?? null;
    },

    async payInvoice(input: PayInvoiceInput): Promise<PayInvoiceResult> {
      const invoice = invoices.get(input.invoiceId);
      if (!invoice) {
        throw new Error('Invoice not found');
      }

      const amountToPay = input.amount ?? invoice.amountRemaining;
      const now = new Date();

      const updated: Invoice = {
        ...invoice,
        status: amountToPay >= invoice.amountRemaining ? InvoiceStatus.PAID : invoice.status,
        amountPaid: invoice.amountPaid + amountToPay,
        amountRemaining: invoice.amountRemaining - amountToPay,
        paid: amountToPay >= invoice.amountRemaining,
        paidAt: amountToPay >= invoice.amountRemaining ? now : invoice.paidAt,
        attemptCount: invoice.attemptCount + 1,
      };

      invoices.set(input.invoiceId, updated);
      return { invoice: updated };
    },

    async voidInvoice(invoiceId: string): Promise<Invoice> {
      const invoice = invoices.get(invoiceId);
      if (!invoice) {
        throw new Error('Invoice not found');
      }

      const updated: Invoice = {
        ...invoice,
        status: InvoiceStatus.VOID,
        voidedAt: new Date(),
      };

      invoices.set(invoiceId, updated);
      return updated;
    },

    async finalizeInvoice(invoiceId: string): Promise<Invoice> {
      const invoice = invoices.get(invoiceId);
      if (!invoice) {
        throw new Error('Invoice not found');
      }

      const updated: Invoice = {
        ...invoice,
        status: InvoiceStatus.OPEN,
        finalizedAt: new Date(),
        number: `INV-${Date.now()}`,
      };

      invoices.set(invoiceId, updated);
      return updated;
    },

    async recordUsage(input: RecordUsageInput): Promise<UsageRecord> {
      const record: UsageRecord = {
        id: `usage_${usageIdCounter++}`,
        subscriptionId: input.subscriptionId,
        quantity: input.quantity,
        timestamp: input.timestamp ?? new Date(),
        action: input.action ?? UsageAction.INCREMENT,
      };

      usageRecords.push(record);
      return record;
    },

    async getUsageSummary(
      subscriptionId: string,
      periodStart?: Date,
      periodEnd?: Date
    ): Promise<UsageSummary> {
      const start = periodStart ?? new Date(0);
      const end = periodEnd ?? new Date();

      const records = usageRecords.filter(
        r => r.subscriptionId === subscriptionId &&
             r.timestamp >= start &&
             r.timestamp <= end
      );

      const totalUsage = records.reduce((sum, r) => sum + r.quantity, 0);

      return {
        subscriptionId,
        totalUsage,
        periodStart: start,
        periodEnd: end,
        records,
      };
    },

    async getPaymentMethod(paymentMethodId: string): Promise<PaymentMethod | null> {
      return null;
    },

    async attachPaymentMethod(
      paymentMethodId: string,
      customerId: string
    ): Promise<PaymentMethod> {
      return {
        id: paymentMethodId,
        customerId,
        type: 'card' as const,
        card: {
          brand: 'visa',
          last4: '4242',
          expMonth: 12,
          expYear: 2025,
        },
        provider: 'internal',
        createdAt: new Date(),
      };
    },

    async detachPaymentMethod(paymentMethodId: string): Promise<void> {
      // No-op for mock
    },

    async getPlan(planId: string): Promise<Plan | null> {
      return plans.get(planId) ?? null;
    },

    async listPlans(active?: boolean): Promise<Plan[]> {
      const allPlans = Array.from(plans.values());
      if (active !== undefined) {
        return allPlans.filter(p => p.active === active);
      }
      return allPlans;
    },

    async handleWebhook(payload: string, signature: string): Promise<WebhookEvent> {
      return {
        id: 'evt_test',
        type: 'test.event',
        data: JSON.parse(payload),
        createdAt: new Date(),
        livemode: false,
      };
    },
  };
}

// ============================================================================
// TEST SETUP
// ============================================================================

describe('BillingService', () => {
  let provider: BillingProviderInterface;
  let service: BillingService;

  beforeEach(() => {
    provider = createMockProvider();
    service = new BillingService(provider);
  });

  // ============================================================================
  // SUBSCRIPTION TESTS
  // ============================================================================

  describe('createSubscription', () => {
    it('should create a subscription', async () => {
      const result = await service.createSubscription({
        customerId: 'cust_123',
        planId: 'plan_pro',
      });

      expect(result.subscription).toBeDefined();
      expect(result.subscription.customerId).toBe('cust_123');
      expect(result.subscription.planId).toBe('plan_pro');
      expect(result.subscription.status).toBe(SubscriptionStatus.ACTIVE);
    });

    it('should create a subscription with trial', async () => {
      const result = await service.createSubscription({
        customerId: 'cust_123',
        planId: 'plan_pro',
        trialDays: 14,
      });

      expect(result.subscription.status).toBe(SubscriptionStatus.TRIALING);
      expect(result.subscription.trialEnd).toBeDefined();
    });

    it('should create a subscription with quantity', async () => {
      const result = await service.createSubscription({
        customerId: 'cust_123',
        planId: 'plan_pro',
        quantity: 5,
      });

      expect(result.subscription.quantity).toBe(5);
    });

    it('should create a subscription with metadata', async () => {
      const result = await service.createSubscription({
        customerId: 'cust_123',
        planId: 'plan_pro',
        metadata: { source: 'website' },
      });

      expect(result.subscription.metadata).toEqual({ source: 'website' });
    });
  });

  describe('getSubscription', () => {
    it('should get an existing subscription', async () => {
      const { subscription: created } = await service.createSubscription({
        customerId: 'cust_123',
        planId: 'plan_pro',
      });

      const subscription = await service.getSubscription(created.id);

      expect(subscription.id).toBe(created.id);
      expect(subscription.customerId).toBe('cust_123');
    });

    it('should throw for non-existent subscription', async () => {
      await expect(service.getSubscription('nonexistent'))
        .rejects.toThrow(SubscriptionNotFoundError);
    });
  });

  describe('cancelSubscription', () => {
    it('should cancel at period end by default', async () => {
      const { subscription: created } = await service.createSubscription({
        customerId: 'cust_123',
        planId: 'plan_pro',
      });

      const result = await service.cancelSubscription({
        subscriptionId: created.id,
      });

      expect(result.subscription.cancelAtPeriodEnd).toBe(true);
      expect(result.subscription.status).not.toBe(SubscriptionStatus.CANCELED);
    });

    it('should cancel immediately when specified', async () => {
      const { subscription: created } = await service.createSubscription({
        customerId: 'cust_123',
        planId: 'plan_pro',
      });

      const result = await service.cancelSubscription({
        subscriptionId: created.id,
        cancelImmediately: true,
      });

      expect(result.subscription.status).toBe(SubscriptionStatus.CANCELED);
      expect(result.subscription.canceledAt).toBeDefined();
    });
  });

  describe('changePlan', () => {
    it('should change subscription plan', async () => {
      const { subscription: created } = await service.createSubscription({
        customerId: 'cust_123',
        planId: 'plan_pro',
      });

      const result = await service.changePlan({
        subscriptionId: created.id,
        newPlanId: 'plan_enterprise',
      });

      expect(result.subscription.planId).toBe('plan_enterprise');
    });

    it('should change quantity when upgrading', async () => {
      const { subscription: created } = await service.createSubscription({
        customerId: 'cust_123',
        planId: 'plan_pro',
        quantity: 1,
      });

      const result = await service.changePlan({
        subscriptionId: created.id,
        newPlanId: 'plan_enterprise',
        quantity: 10,
      });

      expect(result.subscription.quantity).toBe(10);
    });
  });

  describe('pauseSubscription', () => {
    it('should pause a subscription', async () => {
      const { subscription: created } = await service.createSubscription({
        customerId: 'cust_123',
        planId: 'plan_pro',
      });

      const subscription = await service.pauseSubscription(created.id);

      expect(subscription.status).toBe(SubscriptionStatus.PAUSED);
      expect(subscription.pauseCollection).toBeDefined();
    });

    it('should pause with resume date', async () => {
      const { subscription: created } = await service.createSubscription({
        customerId: 'cust_123',
        planId: 'plan_pro',
      });

      const resumeDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      const subscription = await service.pauseSubscription(created.id, resumeDate);

      expect(subscription.pauseCollection?.resumesAt).toEqual(resumeDate);
    });
  });

  describe('resumeSubscription', () => {
    it('should resume a paused subscription', async () => {
      const { subscription: created } = await service.createSubscription({
        customerId: 'cust_123',
        planId: 'plan_pro',
      });

      await service.pauseSubscription(created.id);
      const subscription = await service.resumeSubscription(created.id);

      expect(subscription.status).toBe(SubscriptionStatus.ACTIVE);
      expect(subscription.pauseCollection).toBeUndefined();
    });
  });

  // ============================================================================
  // INVOICE TESTS
  // ============================================================================

  describe('createInvoice', () => {
    it('should create an invoice', async () => {
      const invoice = await service.createInvoice({
        customerId: 'cust_123',
        lineItems: [
          { description: 'Service', quantity: 1, unitAmount: 100 },
        ],
      });

      expect(invoice).toBeDefined();
      expect(invoice.customerId).toBe('cust_123');
      expect(invoice.status).toBe(InvoiceStatus.DRAFT);
      expect(invoice.total).toBe(100);
    });

    it('should calculate totals correctly', async () => {
      const invoice = await service.createInvoice({
        customerId: 'cust_123',
        lineItems: [
          { description: 'Item 1', quantity: 2, unitAmount: 50 },
          { description: 'Item 2', quantity: 1, unitAmount: 100 },
        ],
      });

      expect(invoice.total).toBe(200);
      expect(invoice.amountDue).toBe(200);
      expect(invoice.amountRemaining).toBe(200);
    });
  });

  describe('getInvoice', () => {
    it('should get an existing invoice', async () => {
      const created = await service.createInvoice({
        customerId: 'cust_123',
        lineItems: [{ description: 'Service', quantity: 1, unitAmount: 100 }],
      });

      const invoice = await service.getInvoice(created.id);

      expect(invoice.id).toBe(created.id);
    });

    it('should throw for non-existent invoice', async () => {
      await expect(service.getInvoice('nonexistent'))
        .rejects.toThrow(InvoiceNotFoundError);
    });
  });

  describe('payInvoice', () => {
    it('should pay an invoice in full', async () => {
      const created = await service.createInvoice({
        customerId: 'cust_123',
        lineItems: [{ description: 'Service', quantity: 1, unitAmount: 100 }],
      });

      const result = await service.payInvoice({ invoiceId: created.id });

      expect(result.invoice.status).toBe(InvoiceStatus.PAID);
      expect(result.invoice.paid).toBe(true);
      expect(result.invoice.amountRemaining).toBe(0);
    });

    it('should handle partial payment', async () => {
      const created = await service.createInvoice({
        customerId: 'cust_123',
        lineItems: [{ description: 'Service', quantity: 1, unitAmount: 100 }],
      });

      const result = await service.payInvoice({
        invoiceId: created.id,
        amount: 50,
      });

      expect(result.invoice.amountPaid).toBe(50);
      expect(result.invoice.amountRemaining).toBe(50);
      expect(result.invoice.paid).toBe(false);
    });
  });

  describe('voidInvoice', () => {
    it('should void an invoice', async () => {
      const created = await service.createInvoice({
        customerId: 'cust_123',
        lineItems: [{ description: 'Service', quantity: 1, unitAmount: 100 }],
      });

      const invoice = await service.voidInvoice(created.id);

      expect(invoice.status).toBe(InvoiceStatus.VOID);
      expect(invoice.voidedAt).toBeDefined();
    });
  });

  // ============================================================================
  // USAGE TESTS
  // ============================================================================

  describe('recordUsage', () => {
    it('should record usage', async () => {
      const { subscription } = await service.createSubscription({
        customerId: 'cust_123',
        planId: 'plan_pro',
      });

      const record = await service.recordUsage({
        subscriptionId: subscription.id,
        quantity: 100,
      });

      expect(record).toBeDefined();
      expect(record.quantity).toBe(100);
      expect(record.action).toBe(UsageAction.INCREMENT);
    });

    it('should record usage with SET action', async () => {
      const { subscription } = await service.createSubscription({
        customerId: 'cust_123',
        planId: 'plan_pro',
      });

      const record = await service.recordUsage({
        subscriptionId: subscription.id,
        quantity: 500,
        action: UsageAction.SET,
      });

      expect(record.action).toBe(UsageAction.SET);
    });
  });

  describe('getUsageSummary', () => {
    it('should get usage summary', async () => {
      const { subscription } = await service.createSubscription({
        customerId: 'cust_123',
        planId: 'plan_pro',
      });

      await service.recordUsage({
        subscriptionId: subscription.id,
        quantity: 100,
      });

      await service.recordUsage({
        subscriptionId: subscription.id,
        quantity: 200,
      });

      const summary = await service.getUsageSummary(subscription.id);

      expect(summary.totalUsage).toBe(300);
      expect(summary.records).toHaveLength(2);
    });
  });

  // ============================================================================
  // PLAN TESTS
  // ============================================================================

  describe('getPlan', () => {
    it('should get an existing plan', async () => {
      const plan = await service.getPlan('plan_pro');

      expect(plan.id).toBe('plan_pro');
      expect(plan.name).toBe('Pro Plan');
      expect(plan.amount).toBe(99);
    });

    it('should throw for non-existent plan', async () => {
      await expect(service.getPlan('nonexistent'))
        .rejects.toThrow(PlanNotFoundError);
    });
  });

  describe('listPlans', () => {
    it('should list all plans', async () => {
      const plans = await service.listPlans();

      expect(plans.length).toBeGreaterThan(0);
    });

    it('should filter active plans', async () => {
      const plans = await service.listPlans(true);

      expect(plans.every(p => p.active)).toBe(true);
    });
  });
});
