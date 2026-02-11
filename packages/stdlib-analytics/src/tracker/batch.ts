/**
 * Event batcher with backpressure, injectable clock, and size+time flush triggers.
 */

import type { AnalyticsEvent, FlushCallback } from './types.js';

export interface BatcherConfig {
  /** Flush when buffer reaches this size */
  flushAt: number;
  /** Flush every N ms (0 = disabled) */
  flushIntervalMs: number;
  /** Hard cap — events beyond this are dropped (backpressure) */
  maxQueueSize: number;
  /** Clock function */
  now: () => number;
}

export interface BatcherStats {
  flushed: number;
  dropped: number;
  totalEvents: number;
}

export class Batcher {
  private buffer: AnalyticsEvent[] = [];
  private timer: ReturnType<typeof setInterval> | null = null;
  private readonly config: BatcherConfig;
  private readonly onFlush: FlushCallback;
  private _stats: BatcherStats = { flushed: 0, dropped: 0, totalEvents: 0 };
  private _flushing = false;

  constructor(onFlush: FlushCallback, config: Partial<BatcherConfig> = {}) {
    this.config = {
      flushAt: 20,
      flushIntervalMs: 10_000,
      maxQueueSize: 5000,
      now: Date.now,
      ...config,
    };
    this.onFlush = onFlush;

    if (this.config.flushIntervalMs > 0) {
      this.timer = setInterval(() => {
        void this.flush();
      }, this.config.flushIntervalMs);
    }
  }

  /** Add an event. Returns false if dropped due to backpressure. */
  add(event: AnalyticsEvent): boolean {
    this._stats.totalEvents++;

    if (this.buffer.length >= this.config.maxQueueSize) {
      this._stats.dropped++;
      return false;
    }

    this.buffer.push(event);

    if (this.buffer.length >= this.config.flushAt) {
      void this.flush();
    }

    return true;
  }

  /** Flush all buffered events. */
  async flush(): Promise<void> {
    if (this._flushing || this.buffer.length === 0) return;
    this._flushing = true;

    const batch = this.buffer.splice(0, this.buffer.length);
    try {
      await this.onFlush(batch);
      this._stats.flushed += batch.length;
    } catch {
      // On failure, re-enqueue what fits under the cap
      const space = this.config.maxQueueSize - this.buffer.length;
      const requeue = batch.slice(0, Math.max(0, space));
      this.buffer.unshift(...requeue);
      this._stats.dropped += batch.length - requeue.length;
    } finally {
      this._flushing = false;
    }
  }

  /** Shutdown: stop timer, flush remaining. */
  async shutdown(): Promise<void> {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    await this.flush();
  }

  get pending(): number {
    return this.buffer.length;
  }

  get stats(): Readonly<BatcherStats> {
    return { ...this._stats };
  }
}
