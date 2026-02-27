/**
 * Monotonically increasing counter metric.
 */

import { MetricError } from '../errors.js';
import type { MetricLabels, CounterSnapshot } from './types.js';

export class Counter {
  readonly name: string;
  private readonly labels: MetricLabels;
  private _value = 0;
  private readonly now: () => number;

  constructor(name: string, labels: MetricLabels = {}, now: () => number = Date.now) {
    this.name = name;
    this.labels = { ...labels };
    this.now = now;
  }

  /** Increment by a positive amount (default 1). */
  inc(amount = 1): void {
    if (amount < 0) throw new MetricError('Counter increment must be non-negative.');
    this._value += amount;
  }

  get value(): number {
    return this._value;
  }

  /** Reset to zero. */
  reset(): void {
    this._value = 0;
  }

  snapshot(): CounterSnapshot {
    return {
      name: this.name,
      type: 'counter',
      labels: { ...this.labels },
      value: this._value,
      timestamp: this.now(),
    };
  }
}
