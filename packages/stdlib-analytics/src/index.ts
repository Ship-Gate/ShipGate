/**
 * @packageDocumentation
 * @isl-lang/stdlib-analytics
 *
 * Analytics tracker, pipeline, funnel analysis, and metrics.
 */

// Errors
export {
  AnalyticsError,
  InvalidEventNameError,
  MissingIdentityError,
  QueueFullError,
  DuplicateEventError,
  PipelineBackpressureError,
  SinkError,
  MetricError,
  FunnelError,
} from './errors.js';

// Tracker
export { Tracker } from './tracker/tracker.js';
export { Batcher } from './tracker/batch.js';
export { enrichContext, mergeContext } from './tracker/context.js';

// Pipeline
export { Pipeline } from './pipeline/pipeline.js';
export { anonymize, renameEvent, enrichProperties, redactProperty } from './pipeline/transforms.js';
export { allowEvents, blockEvents, dedupeByMessageId, sample, whereProperty, byType } from './pipeline/filters.js';
export { consoleSink, memorySink, callbackSink, multiSink, nullSink } from './pipeline/sinks.js';

// Funnel
export { FunnelAnalyzer } from './funnel/analyzer.js';
export { FunnelBuilder } from './funnel/builder.js';

// Metrics
export { Counter } from './metrics/counter.js';
export { Gauge } from './metrics/gauge.js';
export { Histogram } from './metrics/histogram.js';

// Types (re-export all)
export type {
  TrackerConfig, AnalyticsEvent, EventType, EventContext, PageContext, DeviceContext,
  CampaignContext, TrackInput, TrackResult, FlushCallback,
} from './tracker/types.js';
export type {
  TransformFn, FilterFn, SinkFn, PipelineConfig, PipelineStats, PipelineStage,
} from './pipeline/types.js';
export type {
  FunnelStep, FunnelResult, FunnelStepResult, FunnelConfig, FunnelEvent,
  EventPropertyFilter, FilterOperator,
} from './funnel/types.js';
export type {
  MetricType, MetricLabels, MetricSnapshot, HistogramSnapshot,
  CounterSnapshot, GaugeSnapshot,
} from './metrics/types.js';
export type { BatcherConfig, BatcherStats } from './tracker/batch.js';
