/**
 * Observability Provider
 *
 * Manages the OpenTelemetry TracerProvider lifecycle.
 * Call `initTracing()` once at process start, then use `getTracer()` everywhere.
 */

import { trace, context, SpanStatusCode, SpanKind as OtelSpanKind } from '@opentelemetry/api';
import type { Tracer as OtelTracer, Span, Context } from '@opentelemetry/api';
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';
import { SimpleSpanProcessor, BatchSpanProcessor, ConsoleSpanExporter } from '@opentelemetry/sdk-trace-base';
import type { SpanExporter } from '@opentelemetry/sdk-trace-base';
import { Resource } from '@opentelemetry/resources';
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION, ATTR_DEPLOYMENT_ENVIRONMENT_NAME } from '@opentelemetry/semantic-conventions';

import type {
  ObservabilityConfig,
  SpanKind,
  SpanOptions,
  TracedSpan,
} from './types.js';

// ─────────────────────────────────────────────────────────────────────────────
// Module-level singleton
// ─────────────────────────────────────────────────────────────────────────────

let _provider: NodeTracerProvider | null = null;
let _config: ObservabilityConfig = {};
let _enabled = false;

// ─────────────────────────────────────────────────────────────────────────────
// ISL semantic attribute keys
// ─────────────────────────────────────────────────────────────────────────────

export const ISL_ATTR = {
  COMMAND:             'isl.cli.command',
  SUBCOMMAND:          'isl.cli.subcommand',
  EXIT_CODE:           'isl.cli.exit_code',
  FILE_COUNT:          'isl.file_count',
  SPEC_FILE:           'isl.spec_file',
  IMPL_FILE:           'isl.impl_file',
  VERIFY_MODE:         'isl.verify.mode',
  VERIFY_VERDICT:      'isl.verify.verdict',
  VERIFY_SCORE:        'isl.verify.score',
  VERIFY_FILE_STATUS:  'isl.verify.file_status',
  CODEGEN_TARGET:      'isl.codegen.target',
  CODEGEN_SOURCE:      'isl.codegen.source_file',
  CODEGEN_OUTPUT:      'isl.codegen.output_file',
  DURATION_MS:         'isl.duration_ms',
  ERROR_TYPE:          'isl.error.type',
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Init / Shutdown
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Initialise the OpenTelemetry tracing provider.
 *
 * Safe to call multiple times — subsequent calls are no-ops unless
 * `shutdown()` was called in between.
 */
export function initTracing(config: ObservabilityConfig = {}): void {
  if (_provider) return; // already initialised

  _config = config;

  // Determine if tracing is enabled
  const envFlag = process.env['ISL_TRACE'] ?? process.env['SHIPGATE_TRACE'];
  _enabled = config.enabled ?? (envFlag === '1' || envFlag === 'true');

  if (!_enabled) return;

  const serviceName = config.serviceName ?? 'shipgate-cli';
  const serviceVersion = config.serviceVersion ?? '1.0.0';

  const resourceAttrs: Record<string, string> = {
    [ATTR_SERVICE_NAME]: serviceName,
    [ATTR_SERVICE_VERSION]: serviceVersion,
    ...(config.environment ? { [ATTR_DEPLOYMENT_ENVIRONMENT_NAME]: config.environment } : {}),
    ...config.resourceAttributes,
  };

  const resource = new Resource(resourceAttrs);
  _provider = new NodeTracerProvider({ resource });

  // Resolve exporter
  const exporter = resolveExporter(config);
  const isConsole =
    !config.exporter || config.exporter.type === 'console';

  if (isConsole) {
    _provider.addSpanProcessor(new SimpleSpanProcessor(exporter));
  } else {
    _provider.addSpanProcessor(new BatchSpanProcessor(exporter));
  }

  _provider.register();
}

/**
 * Gracefully shut down the provider, flushing pending spans.
 */
export async function shutdownTracing(): Promise<void> {
  if (_provider) {
    await _provider.shutdown();
    _provider = null;
    _enabled = false;
  }
}

/**
 * Returns true when tracing has been enabled via `initTracing`.
 */
export function isTracingEnabled(): boolean {
  return _enabled;
}

/**
 * Get the current trace ID from the active span.
 * Returns null if no active span or tracing is disabled.
 */
export function getCurrentTraceId(): string | null {
  if (!_enabled) return null;
  
  const span = trace.getActiveSpan();
  if (!span) return null;
  
  const spanContext = span.spanContext();
  const traceId = spanContext.traceId;
  
  // Return null if trace ID is invalid (all zeros)
  if (!traceId || traceId === '00000000000000000000000000000000') {
    return null;
  }
  
  return traceId;
}

// ─────────────────────────────────────────────────────────────────────────────
// Tracer access
// ─────────────────────────────────────────────────────────────────────────────

const TRACER_NAME = '@isl-lang/observability';

/**
 * Return a raw OpenTelemetry Tracer.
 *
 * If tracing is disabled this still returns a valid (noop) tracer from the
 * OTel API so call-sites never need `if (enabled)` guards.
 */
export function getTracer(): OtelTracer {
  return trace.getTracer(TRACER_NAME, _config.serviceVersion ?? '1.0.0');
}

// ─────────────────────────────────────────────────────────────────────────────
// High-level helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Run `fn` inside a new span. The span is ended automatically when the
 * promise resolves or rejects.
 *
 * ```ts
 * const result = await withSpan('verify.file', { attributes: { 'isl.spec_file': spec } }, async (span) => {
 *   span.addEvent('parsing');
 *   return await doWork();
 * });
 * ```
 */
export async function withSpan<T>(
  name: string,
  opts: SpanOptions,
  fn: (span: TracedSpan) => Promise<T>,
): Promise<T> {
  const tracer = getTracer();

  return tracer.startActiveSpan(
    name,
    {
      kind: mapSpanKind(opts.kind ?? 'INTERNAL'),
      attributes: opts.attributes,
    },
    async (raw: Span) => {
      const wrapped = wrapSpan(raw);
      try {
        const result = await fn(wrapped);
        if (!raw.ended) {
          raw.setStatus({ code: SpanStatusCode.OK });
        }
        return result;
      } catch (err) {
        raw.setStatus({ code: SpanStatusCode.ERROR, message: (err as Error).message });
        raw.recordException(err as Error);
        throw err;
      } finally {
        raw.end();
      }
    },
  );
}

/**
 * Synchronous variant of `withSpan` for lightweight operations.
 */
export function withSpanSync<T>(
  name: string,
  opts: SpanOptions,
  fn: (span: TracedSpan) => T,
): T {
  const tracer = getTracer();
  const raw = tracer.startSpan(name, {
    kind: mapSpanKind(opts.kind ?? 'INTERNAL'),
    attributes: opts.attributes,
  });
  const ctx = trace.setSpan(context.active(), raw);

  const wrapped = wrapSpan(raw);
  try {
    const result = context.with(ctx, () => fn(wrapped));
    raw.setStatus({ code: SpanStatusCode.OK });
    return result;
  } catch (err) {
    raw.setStatus({ code: SpanStatusCode.ERROR, message: (err as Error).message });
    raw.recordException(err as Error);
    throw err;
  } finally {
    raw.end();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────────────────────────────────────

function wrapSpan(raw: Span): TracedSpan {
  return {
    setAttribute(key, value) { raw.setAttribute(key, value); },
    addEvent(name, attrs) { raw.addEvent(name, attrs); },
    setOk() { raw.setStatus({ code: SpanStatusCode.OK }); },
    setError(msg) { raw.setStatus({ code: SpanStatusCode.ERROR, message: msg }); },
    recordException(err) { raw.recordException(err); },
    end() { raw.end(); },
  };
}

function mapSpanKind(kind: SpanKind): OtelSpanKind {
  const map: Record<SpanKind, OtelSpanKind> = {
    INTERNAL: OtelSpanKind.INTERNAL,
    SERVER:   OtelSpanKind.SERVER,
    CLIENT:   OtelSpanKind.CLIENT,
    PRODUCER: OtelSpanKind.PRODUCER,
    CONSUMER: OtelSpanKind.CONSUMER,
  };
  return map[kind];
}

function resolveExporter(config: ObservabilityConfig): SpanExporter {
  const exp = config.exporter;
  if (!exp || exp.type === 'console') {
    return new ConsoleSpanExporter();
  }
  if (exp.type === 'none') {
    // No-op exporter — useful for tests
    return {
      export(_spans: unknown[], cb: (result: { code: number }) => void) { cb({ code: 0 }); },
      shutdown: async () => {},
      forceFlush: async () => {},
    } as unknown as SpanExporter;
  }
  if (exp.type === 'otlp') {
    // Dynamically import so the peer dep stays optional
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { OTLPTraceExporter } = require('@opentelemetry/exporter-trace-otlp-http') as typeof import('@opentelemetry/exporter-trace-otlp-http');
      return new OTLPTraceExporter({
        url: exp.endpoint ?? process.env['OTEL_EXPORTER_OTLP_ENDPOINT'] ?? 'http://localhost:4318/v1/traces',
        headers: exp.headers,
      });
    } catch {
      console.warn(
        '[observability] @opentelemetry/exporter-trace-otlp-http not installed — falling back to console exporter.\n' +
        '  Install it with: pnpm add @opentelemetry/exporter-trace-otlp-http',
      );
      return new ConsoleSpanExporter();
    }
  }
  if (exp.type === 'custom' && exp.factory) {
    return exp.factory() as unknown as SpanExporter;
  }

  return new ConsoleSpanExporter();
}
