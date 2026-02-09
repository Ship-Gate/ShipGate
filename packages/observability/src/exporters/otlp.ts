/**
 * OTLP Exporter Adapter
 *
 * Real wiring for the OpenTelemetry Protocol (OTLP) exporter.
 * Requires `@opentelemetry/exporter-trace-otlp-http` as a peer dependency.
 *
 * @example
 * ```ts
 * import { initTracing } from '@isl-lang/observability';
 * import { createOTLPExporter } from '@isl-lang/observability/exporters/otlp';
 *
 * initTracing({
 *   enabled: true,
 *   exporter: {
 *     type: 'custom',
 *     factory: () => createOTLPExporter({ endpoint: 'http://localhost:4318/v1/traces' }),
 *   },
 * });
 * ```
 */

import type { SpanExporterLike } from '../types.js';

export interface OTLPExporterOptions {
  /**
   * OTLP HTTP endpoint.
   * Falls back to `OTEL_EXPORTER_OTLP_ENDPOINT` env var, then `http://localhost:4318/v1/traces`.
   */
  endpoint?: string;
  /** Extra headers (e.g. auth tokens for Honeycomb / Grafana Cloud) */
  headers?: Record<string, string>;
  /** Request timeout in ms (default: 10 000) */
  timeoutMs?: number;
}

/**
 * Create an OTLP/HTTP span exporter.
 *
 * This dynamically imports `@opentelemetry/exporter-trace-otlp-http` so the
 * dependency stays optional at the package level. If the package is missing,
 * an error is thrown with installation instructions.
 */
export function createOTLPExporter(options: OTLPExporterOptions = {}): SpanExporterLike {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  let OTLPTraceExporter: typeof import('@opentelemetry/exporter-trace-otlp-http').OTLPTraceExporter;
  try {
    // Dynamic require so the peer dep remains optional
    const mod = require('@opentelemetry/exporter-trace-otlp-http') as typeof import('@opentelemetry/exporter-trace-otlp-http');
    OTLPTraceExporter = mod.OTLPTraceExporter;
  } catch {
    throw new Error(
      '@opentelemetry/exporter-trace-otlp-http is required for OTLP export.\n' +
      'Install it with:\n' +
      '  pnpm add @opentelemetry/exporter-trace-otlp-http',
    );
  }

  const endpoint =
    options.endpoint ??
    process.env['OTEL_EXPORTER_OTLP_ENDPOINT'] ??
    'http://localhost:4318/v1/traces';

  const exporter = new OTLPTraceExporter({
    url: endpoint,
    headers: options.headers,
    timeoutMillis: options.timeoutMs ?? 10_000,
  });

  return exporter as unknown as SpanExporterLike;
}
