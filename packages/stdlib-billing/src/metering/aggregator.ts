/**
 * Usage aggregator — computes costs from usage against tiered pricing.
 * All money math uses bigint via the Money class.
 */

import { Money } from '../money.js';
import type { Currency } from '../types.js';
import type { MeterTier, OverageResult } from './types.js';

/**
 * Calculate the cost for a given usage amount against a set of tiers.
 * Tiers are processed in order; each tier's `upTo` is the inclusive upper bound.
 */
export function calculateTieredCost(
  usage: bigint,
  tiers: MeterTier[],
  currency: Currency,
): Money {
  let remaining = usage;
  let cost = Money.zero(currency);
  let prevBound = 0n;

  for (const tier of tiers) {
    if (remaining <= 0n) break;

    const upperBound = tier.upTo === 'inf' ? usage : BigInt(tier.upTo);
    const tierCapacity = upperBound - prevBound;
    const unitsInTier = remaining < tierCapacity ? remaining : tierCapacity;

    const tierCost = Money.fromCents(tier.unitPriceCents * unitsInTier, currency);
    cost = cost.add(tierCost);

    remaining -= unitsInTier;
    prevBound = upperBound;
  }

  return cost;
}

/**
 * Calculate overage: how many units exceed the included amount,
 * and the cost of those overage units at a flat per-unit rate.
 */
export function calculateOverage(
  usage: bigint,
  includedUnits: bigint,
  overageUnitPriceCents: bigint,
  currency: Currency,
): OverageResult {
  const overageUnits = usage > includedUnits ? usage - includedUnits : 0n;
  const overageCost = Money.fromCents(overageUnitPriceCents * overageUnits, currency);

  return {
    includedUnits,
    usedUnits: usage,
    overageUnits,
    overageCost,
  };
}

/**
 * Aggregate usage across multiple periods into per-period totals.
 */
export function aggregateByPeriod(
  records: Array<{ quantity: bigint; timestamp: Date }>,
  periodMs: number,
  anchorDate: Date,
): Map<number, bigint> {
  const buckets = new Map<number, bigint>();
  const anchorMs = anchorDate.getTime();

  for (const r of records) {
    const offset = r.timestamp.getTime() - anchorMs;
    const bucket = Math.floor(offset / periodMs);
    const current = buckets.get(bucket) ?? 0n;
    buckets.set(bucket, current + r.quantity);
  }

  return buckets;
}
