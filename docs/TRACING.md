# How to Trace a Run End-to-End

This guide explains how to enable OpenTelemetry tracing in the ShipGate CLI
so that every `shipgate verify`, `shipgate gen`, and other pipeline commands
emit structured trace spans you can inspect in a terminal or send to a
collector (Jaeger, Grafana Tempo, Honeycomb, etc.).

---

## Quick Start — Console Traces

Set the environment variable and run any command:

```bash
ISL_TRACE=1 shipgate verify src/
```

Every span is printed to **stderr** in the OTel console-exporter format:

```
{
  traceId: 'abc123...',
  name: 'cli.verify',
  attributes: {
    'isl.cli.command': 'verify',
    'isl.verify.verdict': 'SHIP',
    'isl.verify.score': 0.92,
    ...
  },
  duration: [0, 143000000],
  ...
}
```

Child spans (`verify.file`, `codegen.parse`, `codegen.emit`) are nested
under the root span so the full call tree is visible.

---

## Sending Traces to an OTLP Collector

Install the optional OTLP exporter peer dependency:

```bash
pnpm add @opentelemetry/exporter-trace-otlp-http
```

Then set the standard OTel environment variables:

```bash
export ISL_TRACE=1
export OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318/v1/traces
shipgate verify src/
```

The CLI will automatically use the OTLP/HTTP exporter when the package is
present and the endpoint is configured.

### Honeycomb / Grafana Cloud

Pass API keys via headers:

```bash
export ISL_TRACE=1
export OTEL_EXPORTER_OTLP_ENDPOINT=https://api.honeycomb.io
export OTEL_EXPORTER_OTLP_HEADERS="x-honeycomb-team=YOUR_KEY"
shipgate verify src/
```

---

## Programmatic Configuration

If you embed the CLI as a library or build a custom pipeline, initialise
tracing in code:

```ts
import { initTracing, shutdownTracing } from '@isl-lang/observability';

// Console exporter (default)
initTracing({ enabled: true });

// OTLP exporter
initTracing({
  enabled: true,
  exporter: {
    type: 'otlp',
    endpoint: 'http://localhost:4318/v1/traces',
    headers: { 'x-honeycomb-team': process.env.HNY_KEY! },
  },
});

// Custom exporter
import { createOTLPExporter } from '@isl-lang/observability/exporters/otlp';
initTracing({
  enabled: true,
  exporter: {
    type: 'custom',
    factory: () => createOTLPExporter({ endpoint: 'http://localhost:4318/v1/traces' }),
  },
});

// ... run your pipeline ...

await shutdownTracing(); // flush pending spans before exit
```

---

## Trace Span Hierarchy

When you run `shipgate verify src/`, the following spans are emitted:

```
cli.verify                          ← root span for the verify command
├── verify.file [src/auth.ts]       ← per-file verification
│   └── (ISL parse + verify)
├── verify.file [src/payments.ts]
│   └── (specless gate check)
└── verify.file [src/utils.ts]
```

When you run `shipgate gen ts spec.isl`:

```
cli.gen                             ← root span for the gen command
├── codegen.parse                   ← ISL file parsing
└── codegen.emit                    ← code generation for target
```

---

## Semantic Attributes

All spans carry ISL-specific attributes under the `isl.*` namespace:

| Attribute | Type | Description |
|-----------|------|-------------|
| `isl.cli.command` | string | CLI command name (`verify`, `gen`, etc.) |
| `isl.cli.exit_code` | number | Process exit code |
| `isl.spec_file` | string | ISL spec file path |
| `isl.impl_file` | string | Implementation file path |
| `isl.verify.mode` | string | `isl`, `specless`, or `mixed` |
| `isl.verify.verdict` | string | `SHIP`, `NO_SHIP`, or `WARN` |
| `isl.verify.score` | number | Overall score (0.00–1.00) |
| `isl.verify.file_status` | string | Per-file status: `PASS`, `WARN`, `FAIL` |
| `isl.codegen.target` | string | Generation target (`ts`, `rust`, `go`, `openapi`) |
| `isl.codegen.source_file` | string | Source ISL file |
| `isl.codegen.output_file` | string | Generated output file(s) |
| `isl.duration_ms` | number | Operation duration in milliseconds |
| `isl.file_count` | number | Number of files processed |

---

## Swapping Exporters

The `@isl-lang/observability` package provides an abstraction layer so
exporters can be swapped without touching instrumentation code:

- **Console** (built-in, zero deps) — `{ type: 'console' }` or default
- **OTLP/HTTP** (real wiring) — `{ type: 'otlp' }`, requires peer dep
- **None** (for tests) — `{ type: 'none' }`
- **Custom** — `{ type: 'custom', factory: () => yourExporter }`

The exporter is resolved once at `initTracing()` time. If the OTLP peer
dependency is missing, the provider falls back to console with a warning.

---

## Disabling Tracing

Tracing is **off by default**. It only activates when:

1. `ISL_TRACE=1` or `SHIPGATE_TRACE=1` environment variable is set, **or**
2. `initTracing({ enabled: true })` is called programmatically.

When disabled, all `withSpan` calls delegate to the OTel noop tracer —
zero overhead in production.

---

## Architecture

```
┌─────────────────────────────────────────────────┐
│  @isl-lang/observability                        │
│                                                 │
│  initTracing() ─► NodeTracerProvider            │
│  withSpan()    ─► OTel Tracer.startActiveSpan   │
│  ISL_ATTR      ─► semantic attribute constants  │
│                                                 │
│  Exporters:                                     │
│    console  ─► ConsoleSpanExporter (built-in)   │
│    otlp     ─► OTLPTraceExporter   (peer dep)   │
│    custom   ─► user-supplied factory            │
└─────────────────────────────────────────────────┘
         │
         ▼ context propagation via OTel API
┌─────────────────────────────────────────────────┐
│  CLI (packages/cli)                             │
│    cli.verify  ──► verify.file (per-file)       │
│    cli.gen     ──► codegen.parse ► codegen.emit │
└─────────────────────────────────────────────────┘
```

Trace context is propagated automatically through nested `withSpan` calls
because the OTel SDK uses Node.js `AsyncLocalStorage` under the hood.
This means every child span (e.g. `verify.file`) is correctly parented
under the root span (`cli.verify`) without any manual context passing.
