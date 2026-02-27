/**
 * Plan entity and helpers.
 */

import { Money } from '../money.js';
import { BillingInterval } from '../types.js';
import type { PlanId, Currency } from '../types.js';

export type UsageType = 'licensed' | 'metered' | 'tiered';

export interface Plan {
  id: PlanId;
  name: string;
  description?: string;
  /** Price in minor-unit cents (bigint). */
  amount: Money;
  currency: Currency;
  interval: BillingInterval;
  intervalCount: number;
  trialDays?: number;
  features: string[];
  usageType?: UsageType;
  metadata?: Record<string, string>;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Calculate the daily rate for a plan based on its interval.
 * Returns Money in the same currency.
 */
export function planDailyRate(plan: Plan): Money {
  const daysInInterval = intervalToDays(plan.interval, plan.intervalCount);
  return plan.amount.allocate(1, daysInInterval);
}

/**
 * Convert a billing interval + count to approximate number of days.
 */
export function intervalToDays(interval: BillingInterval, count: number): number {
  switch (interval) {
    case BillingInterval.DAY:
      return count;
    case BillingInterval.WEEK:
      return count * 7;
    case BillingInterval.MONTH:
      return count * 30;
    case BillingInterval.YEAR:
      return count * 365;
    default:
      return count * 30;
  }
}
