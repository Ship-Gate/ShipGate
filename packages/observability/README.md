# @isl-lang/observability

OpenTelemetry-based observability for the ShipGate / ISL platform.

Provides an abstraction layer over OTel so exporters can be swapped without
changing instrumentation code. Ships with a **console exporter** (default,
zero deps) and an **OTLP/HTTP exporter adapter** (real wiring, optional peer
dep).

## Installation

```bash
pnpm add @isl-lang/observability

# Optional: for OTLP export to Jaeger / Tempo / Honeycomb
pnpm add @opentelemetry/exporter-trace-otlp-http
```

## Quick Start

```bash
# Enable console traces for any CLI command
ISL_TRACE=1 shipgate verify src/
```

## Programmatic Usage

```typescript
import { initTracing, withSpan, shutdownTracing, ISL_ATTR } from '@isl-lang/observability';

// Initialise (noop unless enabled)
initTracing({ enabled: true });

// Instrument an operation
const result = await withSpan('my-pipeline', {
  attributes: { [ISL_ATTR.COMMAND]: 'verify' },
}, async (span) => {
  span.addEvent('step.started');
  const r = await doWork();
  span.setAttribute(ISL_ATTR.VERIFY_SCORE, r.score);
  return r;
});

// Flush spans before exit
await shutdownTracing();
```

## API

### `initTracing(config?)`

Initialise the OTel `NodeTracerProvider`. Safe to call multiple times.

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `enabled` | `boolean` | `false` | Enable tracing (or set `ISL_TRACE=1`) |
| `serviceName` | `string` | `"shipgate-cli"` | Service name in traces |
| `serviceVersion` | `string` | `"1.0.0"` | Service version tag |
| `environment` | `string` | — | Deployment environment |
| `exporter.type` | `'console' \| 'otlp' \| 'none' \| 'custom'` | `'console'` | Exporter preset |
| `exporter.endpoint` | `string` | `OTEL_EXPORTER_OTLP_ENDPOINT` | OTLP endpoint URL |
| `exporter.headers` | `Record<string,string>` | — | OTLP request headers |
| `exporter.factory` | `() => SpanExporterLike` | — | Custom exporter factory |

### `shutdownTracing()`

Flush pending spans and tear down the provider.

### `withSpan(name, opts, fn)`

Run `fn` inside a new span. Automatically ends the span and records errors.

### `withSpanSync(name, opts, fn)`

Synchronous variant of `withSpan`.

### `ISL_ATTR`

Semantic attribute constants (`isl.cli.command`, `isl.verify.verdict`, etc.).

### `isTracingEnabled()` / `getTracer()`

Inspect state or get the raw OTel `Tracer`.

## Exporters

### Console (default)

```typescript
import { createConsoleExporter } from '@isl-lang/observability/exporters/console';
```

### OTLP/HTTP

```typescript
import { createOTLPExporter } from '@isl-lang/observability/exporters/otlp';

initTracing({
  enabled: true,
  exporter: { type: 'custom', factory: () => createOTLPExporter({ endpoint: 'http://localhost:4318/v1/traces' }) },
});
```

## Development

```bash
pnpm build        # Build the package
pnpm test         # Run tests
pnpm typecheck    # Type-check without emit
pnpm clean        # Remove dist/
```

## License

MIT
