/**
 * Console Exporter
 *
 * Default exporter that writes span data to stderr in a human-readable format.
 * This is the zero-config exporter — no external dependencies required.
 *
 * @example
 * ```ts
 * import { initTracing } from '@isl-lang/observability';
 * import { createConsoleExporter } from '@isl-lang/observability/exporters/console';
 *
 * initTracing({
 *   enabled: true,
 *   exporter: { type: 'custom', factory: () => createConsoleExporter() },
 * });
 * ```
 */

import { ConsoleSpanExporter } from '@opentelemetry/sdk-trace-base';
import type { SpanExporterLike } from '../types.js';

export interface ConsoleExporterOptions {
  /** Write to stdout instead of stderr (default: stderr) */
  stdout?: boolean;
  /** Pretty-print with indentation (default: true) */
  pretty?: boolean;
}

/**
 * Create a console span exporter backed by the OTel SDK's ConsoleSpanExporter.
 *
 * This is the default exporter used when `ISL_TRACE=1` is set and no
 * other exporter is configured.
 */
export function createConsoleExporter(_options?: ConsoleExporterOptions): SpanExporterLike {
  return new ConsoleSpanExporter() as unknown as SpanExporterLike;
}

export { ConsoleSpanExporter };
