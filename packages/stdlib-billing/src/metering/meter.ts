/**
 * Usage meter — records and retrieves usage for metered billing.
 */

import { MeteringError } from '../errors.js';
import type {
  UsageRecord,
  UsageSummary,
  RecordUsageInput,
} from './types.js';

export class Meter {
  private records: UsageRecord[] = [];
  private idempotencyKeys = new Set<string>();
  private idCounter = 0;

  /**
   * Record a usage event.
   */
  record(input: RecordUsageInput): UsageRecord {
    const qty = typeof input.quantity === 'number' ? BigInt(input.quantity) : input.quantity;

    if (qty < 0n) {
      throw new MeteringError('Usage quantity must be non-negative');
    }

    // Idempotency check
    if (input.idempotencyKey) {
      if (this.idempotencyKeys.has(input.idempotencyKey)) {
        const existing = this.records.find(
          (r) => r.idempotencyKey === input.idempotencyKey,
        );
        if (existing) return existing;
      }
      this.idempotencyKeys.add(input.idempotencyKey);
    }

    const record: UsageRecord = {
      id: `usage_${++this.idCounter}`,
      subscriptionId: input.subscriptionId,
      quantity: qty,
      timestamp: input.timestamp ?? new Date(),
      action: input.action ?? 'increment',
      idempotencyKey: input.idempotencyKey,
    };

    this.records.push(record);
    return record;
  }

  /**
   * Get usage summary for a subscription within a period.
   */
  getSummary(
    subscriptionId: string,
    periodStart: Date,
    periodEnd: Date,
  ): UsageSummary {
    const filtered = this.records.filter(
      (r) =>
        r.subscriptionId === subscriptionId &&
        r.timestamp >= periodStart &&
        r.timestamp <= periodEnd,
    );

    // For SET actions, the last SET value is the total; for INCREMENT, sum them.
    // Process in chronological order.
    const sorted = [...filtered].sort(
      (a, b) => a.timestamp.getTime() - b.timestamp.getTime(),
    );

    let total = 0n;
    for (const r of sorted) {
      if (r.action === 'set') {
        total = r.quantity;
      } else {
        total += r.quantity;
      }
    }

    return {
      subscriptionId,
      totalUsage: total,
      periodStart,
      periodEnd,
      records: sorted,
    };
  }

  /**
   * Get all records for a subscription (unfiltered).
   */
  getRecords(subscriptionId: string): UsageRecord[] {
    return this.records.filter((r) => r.subscriptionId === subscriptionId);
  }

  /**
   * Reset all records (for testing).
   */
  reset(): void {
    this.records = [];
    this.idempotencyKeys.clear();
    this.idCounter = 0;
  }
}
