/**
 * @isl-lang/observability
 *
 * OpenTelemetry-based observability for the ShipGate / ISL platform.
 *
 * Quick start:
 * ```ts
 * import { initTracing, withSpan, shutdownTracing, ISL_ATTR } from '@isl-lang/observability';
 *
 * initTracing({ enabled: true });
 *
 * await withSpan('my-operation', {}, async (span) => {
 *   span.setAttribute(ISL_ATTR.COMMAND, 'verify');
 *   return doWork();
 * });
 *
 * await shutdownTracing();
 * ```
 *
 * @packageDocumentation
 */

// Core provider
export {
  initTracing,
  shutdownTracing,
  isTracingEnabled,
  getTracer,
  getCurrentTraceId,
  withSpan,
  withSpanSync,
  ISL_ATTR,
} from './provider.js';

// Types
export type {
  ObservabilityConfig,
  ExporterConfig,
  ExporterPreset,
  SpanExporterLike,
  SpanKind,
  SpanOptions,
  TracedSpan,
} from './types.js';
