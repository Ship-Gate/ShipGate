/**
 * Gauge metric — point-in-time value that can go up and down.
 */

import type { MetricLabels, GaugeSnapshot } from './types.js';

export class Gauge {
  readonly name: string;
  private readonly labels: MetricLabels;
  private _value = 0;
  private readonly now: () => number;

  constructor(name: string, labels: MetricLabels = {}, now: () => number = Date.now) {
    this.name = name;
    this.labels = { ...labels };
    this.now = now;
  }

  /** Set to an absolute value. */
  set(value: number): void {
    this._value = value;
  }

  /** Increment by amount (default 1). */
  inc(amount = 1): void {
    this._value += amount;
  }

  /** Decrement by amount (default 1). */
  dec(amount = 1): void {
    this._value -= amount;
  }

  get value(): number {
    return this._value;
  }

  snapshot(): GaugeSnapshot {
    return {
      name: this.name,
      type: 'gauge',
      labels: { ...this.labels },
      value: this._value,
      timestamp: this.now(),
    };
  }
}
