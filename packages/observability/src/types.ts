/**
 * Observability Types
 *
 * Abstraction layer types so exporters and providers can be swapped
 * without changing instrumentation call-sites.
 */

import type { SpanStatusCode as OtelSpanStatusCode } from '@opentelemetry/api';

// ─────────────────────────────────────────────────────────────────────────────
// Configuration
// ─────────────────────────────────────────────────────────────────────────────

export interface ObservabilityConfig {
  /** Service name reported in traces (default: "shipgate-cli") */
  serviceName?: string;
  /** Service version (default: read from package.json) */
  serviceVersion?: string;
  /** Deployment environment tag */
  environment?: string;
  /** Enable tracing (default: reads ISL_TRACE env var, else false) */
  enabled?: boolean;
  /** Exporter to use — provide a factory or use built-in presets */
  exporter?: ExporterConfig;
  /** Extra resource attributes merged into every span */
  resourceAttributes?: Record<string, string>;
}

export type ExporterPreset = 'console' | 'otlp' | 'none';

export interface ExporterConfig {
  /** Built-in preset name, or 'custom' when providing your own factory */
  type: ExporterPreset | 'custom';
  /** OTLP endpoint (only for 'otlp' preset) */
  endpoint?: string;
  /** Extra headers sent with OTLP export requests */
  headers?: Record<string, string>;
  /**
   * Factory that returns an OpenTelemetry SpanExporter.
   * Used when type === 'custom'.
   */
  factory?: () => SpanExporterLike;
}

/**
 * Minimal interface matching OTel SpanExporter so consumers don't need
 * to depend on the full SDK just to implement a custom exporter.
 */
export interface SpanExporterLike {
  export(spans: unknown[], resultCallback: (result: { code: number }) => void): void;
  shutdown(): Promise<void>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Span helpers
// ─────────────────────────────────────────────────────────────────────────────

export type SpanKind = 'INTERNAL' | 'SERVER' | 'CLIENT' | 'PRODUCER' | 'CONSUMER';

export interface SpanOptions {
  kind?: SpanKind;
  attributes?: Record<string, string | number | boolean>;
}

export interface TracedSpan {
  /** Set an attribute on the span */
  setAttribute(key: string, value: string | number | boolean): void;
  /** Record an event (log line) on the span */
  addEvent(name: string, attributes?: Record<string, string | number | boolean>): void;
  /** Mark span OK */
  setOk(): void;
  /** Mark span as errored */
  setError(message: string): void;
  /** Record an exception on the span */
  recordException(error: Error): void;
  /** End the span (required) */
  end(): void;
}

// Re-export for convenience
export { OtelSpanStatusCode };
