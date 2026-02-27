/**
 * Histogram metric — distribution of values with configurable buckets and percentiles.
 */

import { MetricError } from '../errors.js';
import type { MetricLabels, HistogramSnapshot } from './types.js';

const DEFAULT_BUCKETS = [5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000];

export class Histogram {
  readonly name: string;
  private readonly labels: MetricLabels;
  private readonly bucketBounds: number[];
  private readonly bucketCounts: number[];
  private values: number[] = [];
  private _count = 0;
  private _sum = 0;
  private _min = Infinity;
  private _max = -Infinity;
  private readonly now: () => number;
  private readonly maxValues: number;

  constructor(
    name: string,
    opts: {
      labels?: MetricLabels;
      buckets?: number[];
      now?: () => number;
      maxValues?: number;
    } = {},
  ) {
    this.name = name;
    this.labels = { ...opts.labels };
    this.bucketBounds = [...(opts.buckets ?? DEFAULT_BUCKETS)].sort((a, b) => a - b);
    this.bucketCounts = new Array(this.bucketBounds.length).fill(0);
    this.now = opts.now ?? Date.now;
    this.maxValues = opts.maxValues ?? 100_000;
  }

  /** Record a value. */
  observe(value: number): void {
    if (!Number.isFinite(value)) throw new MetricError('Histogram value must be finite.');

    this._count++;
    this._sum += value;
    if (value < this._min) this._min = value;
    if (value > this._max) this._max = value;

    // Bucket counts
    for (let i = 0; i < this.bucketBounds.length; i++) {
      if (value <= this.bucketBounds[i]) {
        this.bucketCounts[i]++;
      }
    }

    // Store raw values for percentile computation, bounded
    if (this.values.length < this.maxValues) {
      this.values.push(value);
    }
  }

  /** Compute a percentile (0–1, e.g. 0.99 for p99). */
  percentile(p: number): number {
    if (p < 0 || p > 1) throw new MetricError('Percentile must be between 0 and 1.');
    if (this.values.length === 0) return 0;

    const sorted = [...this.values].sort((a, b) => a - b);
    const idx = Math.ceil(p * sorted.length) - 1;
    return sorted[Math.max(0, idx)];
  }

  get count(): number {
    return this._count;
  }

  get sum(): number {
    return this._sum;
  }

  get min(): number {
    return this._count === 0 ? 0 : this._min;
  }

  get max(): number {
    return this._count === 0 ? 0 : this._max;
  }

  get mean(): number {
    return this._count === 0 ? 0 : this._sum / this._count;
  }

  /** Reset all state. */
  reset(): void {
    this._count = 0;
    this._sum = 0;
    this._min = Infinity;
    this._max = -Infinity;
    this.values = [];
    this.bucketCounts.fill(0);
  }

  snapshot(): HistogramSnapshot {
    return {
      name: this.name,
      type: 'histogram',
      labels: { ...this.labels },
      value: this.mean,
      timestamp: this.now(),
      count: this._count,
      sum: this._sum,
      min: this.min,
      max: this.max,
      buckets: this.bucketBounds.map((le, i) => ({ le, count: this.bucketCounts[i] })),
      percentiles: [0.5, 0.9, 0.95, 0.99].map(p => ({ p, value: this.percentile(p) })),
    };
  }
}
