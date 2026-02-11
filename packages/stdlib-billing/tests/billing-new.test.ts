/**
 * Tests for stdlib-billing.
 * Covers lifecycle transitions, proration determinism, invoice rounding, metering aggregation, and mock gateway flows.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  Money,
  InvalidTransitionError,
  SubscriptionStatus,
  Currency,
  BillingInterval,
  SubscriptionManager,
  InvoiceGenerator,
  InvoiceNumbering,
  MockGateway,
  Meter,
  calculateProration,
  calculateTieredCost,
  calculateOverage,
  canTransition,
  assertTransition,
} from '../src/index.js';

describe('Money (bigint)', () => {
  it('stores amounts as bigint cents', () => {
    const m = Money.fromCents(12345n, Currency.USD);
    expect(m.amount).toBe(12345n);
    expect(m.currency).toBe('USD');
  });

  it('adds and subtracts without floats', () => {
    const a = Money.fromCents(100n, Currency.USD);
    const b = Money.fromCents(250n, Currency.USD);
    expect(a.add(b).amount).toBe(350n);
    expect(b.subtract(a).amount).toBe(150n);
  });

  it('multiplies deterministically', () => {
    const m = Money.fromCents(123n, Currency.USD);
    expect(m.multiply(3).amount).toBe(369n);
  });

  it('allocates with banker\'s rounding', () => {
    const m = Money.fromCents(100n, Currency.USD);
    const parts = m.allocate(3);
    // 100/3 = 33.333 -> banker's rounding: 33, 33, 34
    expect(parts.map((p) => p.amount)).toEqual([33n, 33n, 34n]);
  });

  it('calculates percentages precisely', () => {
    const m = Money.fromCents(10000n, Currency.USD); // $100.00
    const ten = m.percentage(10);
    expect(ten.amount).toBe(1000n); // $10.00
  });
});

describe('Subscription lifecycle state machine', () => {
  it('allows valid transitions', () => {
    expect(canTransition(SubscriptionStatus.ACTIVE, SubscriptionStatus.CANCELED)).toBe(true);
    expect(canTransition(SubscriptionStatus.TRIALING, SubscriptionStatus.ACTIVE)).toBe(true);
  });

  it('rejects invalid transitions', () => {
    expect(canTransition(SubscriptionStatus.CANCELED, SubscriptionStatus.ACTIVE)).toBe(false);
    expect(canTransition(SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIALING)).toBe(false);
  });

  it('throws on invalid transition', () => {
    expect(() => assertTransition(SubscriptionStatus.CANCELED, SubscriptionStatus.ACTIVE)).toThrow(
      InvalidTransitionError,
    );
  });
});

describe('SubscriptionManager', () => {
  let manager: SubscriptionManager;
  let planId: string;

  beforeEach(() => {
    manager = new SubscriptionManager();
    planId = manager.registerPlan({
      id: 'plan_basic',
      name: 'Basic',
      amount: Money.fromCents(1000n, Currency.USD),
      currency: Currency.USD,
      interval: BillingInterval.MONTH,
      intervalCount: 1,
      features: [],
      active: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  });

  it('creates a subscription', () => {
    const sub = manager.create({
      customerId: 'cus_1',
      planId,
      paymentMethodId: 'pm_1',
    });
    expect(sub.subscription.status).toBe(SubscriptionStatus.ACTIVE);
    expect(sub.subscription.quantity).toBe(1);
  });

  it('creates with trial', () => {
    const sub = manager.create({
      customerId: 'cus_1',
      planId,
      trialDays: 7,
    });
    expect(sub.subscription.status).toBe(SubscriptionStatus.TRIALING);
    expect(sub.subscription.trialEnd).toBeDefined();
  });

  it('cancels immediately', () => {
    const created = manager.create({ customerId: 'cus_1', planId });
    const result = manager.cancel({
      subscriptionId: created.subscription.id,
      cancelImmediately: true,
      prorate: true,
    });
    expect(result.subscription.status).toBe(SubscriptionStatus.CANCELED);
    expect(result.proratedCredit).toBeDefined();
  });

  it('changes plan with proration', () => {
    const newPlanId = manager.registerPlan({
      id: 'plan_pro',
      name: 'Pro',
      amount: Money.fromCents(2000n, Currency.USD),
      currency: Currency.USD,
      interval: BillingInterval.MONTH,
      intervalCount: 1,
      features: [],
      active: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const created = manager.create({ customerId: 'cus_1', planId });
    const result = manager.changePlan({
      subscriptionId: created.subscription.id,
      newPlanId,
      prorationBehavior: 'create_prorations',
    });
    expect(result.subscription.planId).toBe('plan_pro');
    expect(result.prorations).toBeDefined();
  });
});

describe('Proration calculation', () => {
  it('calculates deterministic proration', () => {
    const current = {
      id: 'basic',
      name: 'Basic',
      amount: Money.fromCents(1000n, Currency.USD),
      currency: Currency.USD,
      interval: BillingInterval.MONTH,
      intervalCount: 1,
      features: [],
      active: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const pro = {
      id: 'pro',
      name: 'Pro',
      amount: Money.fromCents(2000n, Currency.USD),
      currency: Currency.USD,
      interval: BillingInterval.MONTH,
      intervalCount: 1,
      features: [],
      active: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const now = new Date('2026-01-15T12:00:00Z');
    const periodStart = new Date('2026-01-01T00:00:00Z');
    const periodEnd = new Date('2026-02-01T00:00:00Z');

    const proration = calculateProration(current, pro, periodStart, periodEnd, now);
    // Halfway through month: credit $5, charge $10 => owe $5
    expect(proration.amount).toBe(500n); // $5.00 in cents
  });
});

describe('InvoiceGenerator', () => {
  let gen: InvoiceGenerator;

  beforeEach(() => {
    gen = new InvoiceGenerator(new InvoiceNumbering(1, { prefix: 'TEST' }));
  });

  it('creates invoice with subtotal, tax, discount', () => {
    const inv = gen.create({
      customerId: 'cus_1',
      currency: Currency.USD,
      lineItems: [
        { description: 'Item A', quantity: 2, unitAmountCents: 500n },
        { description: 'Item B', quantity: 1, unitAmountCents: 1000n },
      ],
      taxLines: [{ description: 'Tax', rate: 8.25 }],
      discountPercent: 10,
    });

    expect(inv.subtotal.amount).toBe(2000n); // $20.00
    expect(inv.discount.amount).toBe(200n); // 10% of $20
    expect(inv.tax.amount).toBe(165n); // 8.25% of $18
    expect(inv.total.amount).toBe(1965n); // $18 + $1.65
  });

  it('finalizes with number', () => {
    const inv = gen.create({
      customerId: 'cus_1',
      currency: Currency.USD,
      lineItems: [{ description: 'Item', quantity: 1, unitAmountCents: 1000n }],
    });
    const finalized = gen.finalize(inv.id);
    expect(finalized.number).toBe('TEST-000001');
    expect(finalized.status).toBe('open');
  });

  it('pays invoice', () => {
    const inv = gen.create({
      customerId: 'cus_1',
      currency: Currency.USD,
      lineItems: [{ description: 'Item', quantity: 1, unitAmountCents: 1000n }],
    });
    const paid = gen.pay({ invoiceId: inv.id });
    expect(paid.invoice.status).toBe('paid');
    expect(paid.invoice.paidAt).toBeDefined();
  });
});

describe('MockGateway', () => {
  let gateway: MockGateway;

  beforeEach(() => {
    gateway = new MockGateway();
  });

  it('creates charge', async () => {
    const charge = await gateway.createCharge({
      amountCents: 1000n,
      currency: Currency.USD,
      paymentMethodId: 'pm_1',
      customerId: 'cus_1',
    });
    expect(charge.status).toBe('succeeded');
    expect(charge.amountCents).toBe(1000n);
  });

  it('fails charges when configured', async () => {
    const failGateway = new MockGateway({ failCharges: true });
    const charge = await failGateway.createCharge({
      amountCents: 1000n,
      currency: Currency.USD,
      paymentMethodId: 'pm_1',
      customerId: 'cus_1',
    });
    expect(charge.status).toBe('failed');
    expect(charge.failureMessage).toContain('configured to fail');
  });

  it('handles refunds', async () => {
    const charge = await gateway.createCharge({
      amountCents: 1000n,
      currency: Currency.USD,
      paymentMethodId: 'pm_1',
      customerId: 'cus_1',
    });
    const refund = await gateway.createRefund({ chargeId: charge.id });
    expect(refund.status).toBe('succeeded');
    expect(refund.amountCents).toBe(1000n);
  });
});

describe('Meter', () => {
  let meter: Meter;

  beforeEach(() => {
    meter = new Meter();
  });

  it('records usage', () => {
    const record = meter.record({
      subscriptionId: 'sub_1',
      quantity: 5n,
    });
    expect(record.quantity).toBe(5n);
  });

  it('aggregates usage per period', () => {
    const periodStart = new Date('2026-01-01T00:00:00Z');
    const periodEnd = new Date('2026-01-31T23:59:59Z');

    meter.record({
      subscriptionId: 'sub_1',
      quantity: 3n,
      timestamp: new Date('2026-01-10T00:00:00Z'),
    });
    meter.record({
      subscriptionId: 'sub_1',
      quantity: 2n,
      timestamp: new Date('2026-01-20T00:00:00Z'),
    });

    const summary = meter.getSummary('sub_1', periodStart, periodEnd);
    expect(summary.totalUsage).toBe(5n);
    expect(summary.records).toHaveLength(2);
  });

  it('respects idempotency', () => {
    const record1 = meter.record({
      subscriptionId: 'sub_1',
      quantity: 5n,
      idempotencyKey: 'key_1',
    });
    const record2 = meter.record({
      subscriptionId: 'sub_1',
      quantity: 10n,
      idempotencyKey: 'key_1',
    });
    expect(record1.id).toBe(record2.id);
  });
});

describe('Tiered cost calculation', () => {
  it('calculates cost across tiers', () => {
    const tiers = [
      { upTo: 100, unitPriceCents: 10n },
      { upTo: 500, unitPriceCents: 8n },
      { upTo: 'inf', unitPriceCents: 5n },
    ];
    const cost = calculateTieredCost(600n, tiers, Currency.USD);
    // 100*10 + 400*8 + 100*5 = 1000 + 3200 + 500 = 4700
    expect(cost.amount).toBe(4700n);
  });
});

describe('Overage calculation', () => {
  it('calculates overage when exceeding included', () => {
    const result = calculateOverage(150n, 100n, 12n, Currency.USD);
    expect(result.overageUnits).toBe(50n);
    expect(result.overageCost.amount).toBe(600n); // 50 * $0.12
  });

  it('returns zero overage when within included', () => {
    const result = calculateOverage(80n, 100n, 12n, Currency.USD);
    expect(result.overageUnits).toBe(0n);
    expect(result.overageCost.isZero()).toBe(true);
  });
});
