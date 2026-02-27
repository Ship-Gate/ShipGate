/**
 * Subscription manager — orchestrates subscription CRUD with lifecycle enforcement.
 */

import { Money } from '../money.js';
import { SubscriptionStatus, ProrationBehavior } from '../types.js';
import { SubscriptionNotFoundError } from '../errors.js';
import { assertTransition, isActiveStatus } from './lifecycle.js';
import type { Plan } from './plan.js';
import { planDailyRate } from './plan.js';
import type {
  Subscription,
  CreateSubscriptionInput,
  CreateSubscriptionResult,
  CancelSubscriptionInput,
  CancelSubscriptionResult,
  ChangePlanInput,
  ChangePlanResult,
} from './types.js';

// ============================================================================
// PRORATION
// ============================================================================

/**
 * Calculate proration amount when switching plans mid-period.
 * Positive = customer owes more. Negative = credit.
 * All math is bigint — deterministic and float-free.
 */
export function calculateProration(
  currentPlan: Plan,
  newPlan: Plan,
  periodStart: Date,
  periodEnd: Date,
  now: Date,
): Money {
  const totalMs = periodEnd.getTime() - periodStart.getTime();
  const remainingMs = periodEnd.getTime() - now.getTime();

  if (totalMs <= 0 || remainingMs <= 0) {
    return Money.zero(currentPlan.currency);
  }

  const totalDays = Math.max(1, Math.round(totalMs / (24 * 60 * 60 * 1000)));
  const remainingDays = Math.max(0, Math.round(remainingMs / (24 * 60 * 60 * 1000)));

  const currentDaily = currentPlan.amount.allocate(1, totalDays);
  const newDaily = newPlan.amount.allocate(1, totalDays);

  const credit = currentDaily.multiply(remainingDays);
  const charge = newDaily.multiply(remainingDays);

  return charge.subtract(credit);
}

// ============================================================================
// SUBSCRIPTION MANAGER
// ============================================================================

export class SubscriptionManager {
  private subscriptions = new Map<string, Subscription>();
  private plans = new Map<string, Plan>();
  private idCounter = 0;

  registerPlan(plan: Plan): void {
    this.plans.set(plan.id, plan);
  }

  getPlan(planId: string): Plan | undefined {
    return this.plans.get(planId);
  }

  getSubscription(id: string): Subscription | undefined {
    return this.subscriptions.get(id);
  }

  create(input: CreateSubscriptionInput): CreateSubscriptionResult {
    const id = `sub_${++this.idCounter}`;
    const now = new Date();
    const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const hasTrial = (input.trialDays !== undefined && input.trialDays > 0) || input.trialEnd !== undefined;
    const trialEnd = input.trialEnd
      ?? (input.trialDays ? new Date(now.getTime() + input.trialDays * 24 * 60 * 60 * 1000) : undefined);

    const subscription: Subscription = {
      id,
      customerId: input.customerId,
      planId: input.planId,
      priceId: input.priceId,
      status: hasTrial ? SubscriptionStatus.TRIALING : SubscriptionStatus.ACTIVE,
      currentPeriodStart: now,
      currentPeriodEnd: periodEnd,
      billingCycleAnchor: now,
      trialStart: hasTrial ? now : undefined,
      trialEnd: hasTrial ? trialEnd : undefined,
      cancelAtPeriodEnd: false,
      quantity: input.quantity ?? 1,
      collectionMethod: input.collectionMethod ?? 'charge_automatically' as any,
      defaultPaymentMethodId: input.paymentMethodId,
      metadata: input.metadata,
      provider: 'internal',
      createdAt: now,
      updatedAt: now,
    };

    this.subscriptions.set(id, subscription);
    return { subscription };
  }

  cancel(input: CancelSubscriptionInput): CancelSubscriptionResult {
    const sub = this.subscriptions.get(input.subscriptionId);
    if (!sub) throw new SubscriptionNotFoundError(input.subscriptionId);

    const now = new Date();

    if (input.cancelImmediately) {
      assertTransition(sub.status, SubscriptionStatus.CANCELED);

      const updated: Subscription = {
        ...sub,
        status: SubscriptionStatus.CANCELED,
        canceledAt: now,
        endedAt: now,
        cancellationDetails: input.cancellationDetails,
        updatedAt: now,
      };
      this.subscriptions.set(sub.id, updated);

      let proratedCredit: Money | undefined;
      if (input.prorate) {
        const plan = this.plans.get(sub.planId);
        if (plan) {
          const totalMs = sub.currentPeriodEnd.getTime() - sub.currentPeriodStart.getTime();
          const remainingMs = sub.currentPeriodEnd.getTime() - now.getTime();
          const totalDays = Math.max(1, Math.round(totalMs / (24 * 60 * 60 * 1000)));
          const remainingDays = Math.max(0, Math.round(remainingMs / (24 * 60 * 60 * 1000)));
          proratedCredit = plan.amount.allocate(remainingDays, totalDays);
        }
      }

      return { subscription: updated, proratedCredit };
    }

    // Cancel at period end — no status change yet
    const updated: Subscription = {
      ...sub,
      cancelAtPeriodEnd: true,
      cancellationDetails: input.cancellationDetails,
      updatedAt: now,
    };
    this.subscriptions.set(sub.id, updated);
    return { subscription: updated };
  }

  changePlan(input: ChangePlanInput): ChangePlanResult {
    const sub = this.subscriptions.get(input.subscriptionId);
    if (!sub) throw new SubscriptionNotFoundError(input.subscriptionId);

    if (!isActiveStatus(sub.status)) {
      throw new SubscriptionNotFoundError(input.subscriptionId);
    }

    const currentPlan = this.plans.get(sub.planId);
    const newPlan = this.plans.get(input.newPlanId);

    let prorationAmount: Money | undefined;
    if (
      input.prorationBehavior !== ProrationBehavior.NONE &&
      currentPlan &&
      newPlan
    ) {
      prorationAmount = calculateProration(
        currentPlan,
        newPlan,
        sub.currentPeriodStart,
        sub.currentPeriodEnd,
        new Date(),
      );
    }

    const updated: Subscription = {
      ...sub,
      planId: input.newPlanId,
      priceId: input.newPriceId,
      quantity: input.quantity ?? sub.quantity,
      updatedAt: new Date(),
    };
    this.subscriptions.set(sub.id, updated);

    return { subscription: updated };
  }

  pause(subscriptionId: string, resumesAt?: Date): Subscription {
    const sub = this.subscriptions.get(subscriptionId);
    if (!sub) throw new SubscriptionNotFoundError(subscriptionId);

    assertTransition(sub.status, SubscriptionStatus.PAUSED);

    const updated: Subscription = {
      ...sub,
      status: SubscriptionStatus.PAUSED,
      pauseCollection: { behavior: 'void', resumesAt },
      updatedAt: new Date(),
    };
    this.subscriptions.set(subscriptionId, updated);
    return updated;
  }

  resume(subscriptionId: string): Subscription {
    const sub = this.subscriptions.get(subscriptionId);
    if (!sub) throw new SubscriptionNotFoundError(subscriptionId);

    assertTransition(sub.status, SubscriptionStatus.ACTIVE);

    const updated: Subscription = {
      ...sub,
      status: SubscriptionStatus.ACTIVE,
      pauseCollection: undefined,
      updatedAt: new Date(),
    };
    this.subscriptions.set(subscriptionId, updated);
    return updated;
  }

  /**
   * Transition a subscription to a new status with lifecycle enforcement.
   */
  transition(subscriptionId: string, newStatus: SubscriptionStatus): Subscription {
    const sub = this.subscriptions.get(subscriptionId);
    if (!sub) throw new SubscriptionNotFoundError(subscriptionId);

    assertTransition(sub.status, newStatus);

    const now = new Date();
    const updated: Subscription = {
      ...sub,
      status: newStatus,
      updatedAt: now,
      ...(newStatus === SubscriptionStatus.CANCELED ? { canceledAt: now, endedAt: now } : {}),
    };
    this.subscriptions.set(subscriptionId, updated);
    return updated;
  }
}
