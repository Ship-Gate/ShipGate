/**
 * Pipeline types
 */

import type { AnalyticsEvent } from '../tracker/types.js';

export type TransformFn = (event: AnalyticsEvent) => AnalyticsEvent | null;
export type FilterFn = (event: AnalyticsEvent) => boolean;
export type SinkFn = (events: AnalyticsEvent[]) => Promise<void>;

export interface PipelineStage {
  type: 'transform' | 'filter';
  name: string;
  fn: TransformFn | FilterFn;
}

export interface PipelineConfig {
  /** Max buffer size before applying backpressure (dropping oldest) */
  maxBufferSize: number;
  /** Batch size for sink writes */
  sinkBatchSize: number;
  /** Flush interval for sink in ms */
  sinkFlushIntervalMs: number;
  /** Clock function (injectable) */
  now: () => number;
}

export interface PipelineStats {
  received: number;
  transformed: number;
  filtered: number;
  dropped: number;
  sunk: number;
  errors: number;
}
