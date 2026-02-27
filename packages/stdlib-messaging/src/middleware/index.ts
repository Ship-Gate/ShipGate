/**
 * Middleware module exports
 */

// Core middleware
export { LoggingMiddleware } from './logging.js';
export { MetricsMiddleware } from './metrics.js';
export { RetryMiddleware } from './retry.js';
export { TracingMiddleware } from './tracing.js';

// Circuit breaker and bulkhead
export { 
  CircuitBreaker,
  CircuitBreakerMiddleware,
  Bulkhead,
  BulkheadMiddleware,
} from './retry.js';

export { CircuitState } from './retry.js';

// Logger types
export type {
  LoggingOptions,
  LogEntry,
  LogFormatter,
} from './logging.js';

export { LogLevel } from './logging.js';

export {
  DefaultLogger,
  StructuredLogger,
  LogFormatters,
  createLoggingMiddleware,
  createCustomLoggingMiddleware,
  createJsonLoggingMiddleware,
} from './logging.js';

// Metrics types
export type {
  MetricsCollector,
  MetricsOptions,
} from './metrics.js';

export {
  DefaultMetricsCollector,
  PrometheusMetricsCollector,
  createMetricsMiddleware,
  createPrometheusMetricsMiddleware,
} from './metrics.js';

// Retry types
export type {
  RetryConfig,
  CircuitBreakerConfig,
  BulkheadConfig,
} from './retry.js';

export {
  createRetryMiddleware,
  createCustomRetryMiddleware,
  createCircuitBreakerMiddleware,
  createBulkheadMiddleware,
} from './retry.js';

// Tracing types
export type {
  Tracer,
  Span,
  SpanContext,
  SpanOptions,
  TracingOptions,
} from './tracing.js';

export {
  DefaultTracer,
  DefaultSpan,
  OpenTelemetryTracerAdapter,
  OpenTelemetrySpanAdapter,
  createTracingMiddleware,
  createCustomTracingMiddleware,
  createOpenTelemetryTracingMiddleware,
} from './tracing.js';
