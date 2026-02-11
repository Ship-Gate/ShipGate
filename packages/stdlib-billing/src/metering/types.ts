/**
 * Metering types.
 */

import type { SubscriptionId } from '../types.js';
import { Money } from '../money.js';

export interface UsageRecord {
  id: string;
  subscriptionId: SubscriptionId;
  quantity: bigint;
  timestamp: Date;
  action: 'increment' | 'set';
  idempotencyKey?: string;
}

export interface UsageSummary {
  subscriptionId: SubscriptionId;
  totalUsage: bigint;
  periodStart: Date;
  periodEnd: Date;
  records: UsageRecord[];
}

export interface MeterTier {
  /** Inclusive upper bound of this tier (units). Use Infinity for the last tier. */
  upTo: number | 'inf';
  /** Price per unit in minor-unit cents. */
  unitPriceCents: bigint;
}

export interface OverageResult {
  includedUnits: bigint;
  usedUnits: bigint;
  overageUnits: bigint;
  overageCost: Money;
}

export interface RecordUsageInput {
  subscriptionId: SubscriptionId;
  quantity: bigint | number;
  timestamp?: Date;
  action?: 'increment' | 'set';
  idempotencyKey?: string;
}
