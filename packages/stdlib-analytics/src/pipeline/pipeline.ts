/**
 * Analytics pipeline — transform → filter → sink with backpressure.
 */

import type { AnalyticsEvent } from '../tracker/types.js';
import type { TransformFn, FilterFn, SinkFn, PipelineStage, PipelineConfig, PipelineStats } from './types.js';

export class Pipeline {
  private readonly stages: PipelineStage[] = [];
  private sink: SinkFn | null = null;
  private buffer: AnalyticsEvent[] = [];
  private timer: ReturnType<typeof setInterval> | null = null;
  private readonly config: PipelineConfig;
  private _stats: PipelineStats = {
    received: 0,
    transformed: 0,
    filtered: 0,
    dropped: 0,
    sunk: 0,
    errors: 0,
  };
  private _flushing = false;

  constructor(config: Partial<PipelineConfig> = {}) {
    this.config = {
      maxBufferSize: 10_000,
      sinkBatchSize: 100,
      sinkFlushIntervalMs: 5_000,
      now: Date.now,
      ...config,
    };
  }

  /** Append a transform stage. */
  transform(name: string, fn: TransformFn): this {
    this.stages.push({ type: 'transform', name, fn });
    return this;
  }

  /** Append a filter stage. */
  filter(name: string, fn: FilterFn): this {
    this.stages.push({ type: 'filter', name, fn });
    return this;
  }

  /** Set the sink (terminal stage). */
  to(sink: SinkFn): this {
    this.sink = sink;

    if (this.config.sinkFlushIntervalMs > 0) {
      this.timer = setInterval(() => {
        void this.flushSink();
      }, this.config.sinkFlushIntervalMs);
    }

    return this;
  }

  /** Push an event through the pipeline. */
  push(event: AnalyticsEvent): boolean {
    this._stats.received++;

    let current: AnalyticsEvent | null = event;

    for (const stage of this.stages) {
      if (!current) break;

      if (stage.type === 'transform') {
        current = (stage.fn as TransformFn)(current);
        if (current) this._stats.transformed++;
      } else {
        const keep = (stage.fn as FilterFn)(current);
        if (!keep) {
          this._stats.filtered++;
          current = null;
        }
      }
    }

    if (!current) return false;

    // Backpressure: drop oldest if at cap
    if (this.buffer.length >= this.config.maxBufferSize) {
      this.buffer.shift();
      this._stats.dropped++;
    }

    this.buffer.push(current);

    if (this.sink && this.buffer.length >= this.config.sinkBatchSize) {
      void this.flushSink();
    }

    return true;
  }

  /** Push multiple events. */
  pushBatch(events: AnalyticsEvent[]): number {
    let accepted = 0;
    for (const e of events) {
      if (this.push(e)) accepted++;
    }
    return accepted;
  }

  /** Flush buffered events to sink. */
  async flushSink(): Promise<void> {
    if (this._flushing || !this.sink || this.buffer.length === 0) return;
    this._flushing = true;

    const batch = this.buffer.splice(0, this.buffer.length);
    try {
      await this.sink(batch);
      this._stats.sunk += batch.length;
    } catch {
      this._stats.errors++;
      // Re-buffer what fits
      const space = this.config.maxBufferSize - this.buffer.length;
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
    await this.flushSink();
  }

  get pending(): number {
    return this.buffer.length;
  }

  get stats(): Readonly<PipelineStats> {
    return { ...this._stats };
  }
}
