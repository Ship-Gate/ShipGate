# Tracing Quickstart - See Traces Locally in 5 Minutes

This guide shows you how to set up local tracing for ShipGate CLI commands and view them in Jaeger.

## Prerequisites

- Docker and Docker Compose installed
- Node.js and pnpm installed

## Step 1: Start the Local Collector Stack

Start Jaeger and the OpenTelemetry collector:

```bash
docker-compose -f docker-compose.tracing.yml up -d
```

This starts:
- **Jaeger UI** at http://localhost:16686
- **OTel Collector** receiving traces on ports 4317 (gRPC) and 4318 (HTTP)

## Step 2: Enable Tracing and Run a Command

Set the environment variable to enable tracing and point it to the local collector:

```bash
export ISL_TRACE=1
export OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318/v1/traces

# Run any ShipGate command
shipgate gate specs/auth.isl --impl src/auth.ts
```

Or use the shorter trace ID format:

```bash
ISL_TRACE=1 OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318/v1/traces shipgate gate specs/auth.isl --impl src/auth.ts
```

## Step 3: View Traces in Jaeger

1. Open http://localhost:16686 in your browser
2. Select **"shipgate-cli"** from the Service dropdown
3. Click **"Find Traces"**
4. You'll see traces with spans for:
   - `cli.gate` - Main gate command
   - `gate.parse` - ISL parsing
   - `gate.check` - Type checking
   - `gate.verify` - Verification execution

## Trace ID in CLI Output

When tracing is enabled, the CLI output includes a trace ID:

```
  Trace ID: abc123def4567890...
```

Use this trace ID to find the exact trace in Jaeger by searching for it in the Trace ID field.

## Standardized Span Names

All commands use consistent span naming:

- **Parse**: `cli.parse`, `gate.parse`
- **Check**: `cli.check`, `gate.check`
- **Gen**: `cli.gen`, `codegen.parse`, `codegen.emit`
- **Verify**: `cli.verify`, `gate.verify`
- **Gate**: `cli.gate` (parent span)

## Span Attributes

Each span includes useful attributes:

- `isl.cli.command` - Command name (parse, check, gen, verify, gate)
- `isl.spec_file` - Path to ISL spec file
- `isl.impl_file` - Path to implementation file
- `isl.verify.verdict` - SHIP or NO-SHIP
- `isl.verify.score` - Trust score (0-100)
- `isl.duration_ms` - Duration in milliseconds
- `isl.parse.error_count` - Number of parse errors
- `isl.check.error_count` - Number of type errors

## Troubleshooting

### No traces appearing in Jaeger

1. Check that tracing is enabled: `echo $ISL_TRACE` should output `1`
2. Verify collector is running: `docker ps | grep otel-collector`
3. Check collector logs: `docker logs <container-id>`
4. Ensure OTLP endpoint is correct: `echo $OTEL_EXPORTER_OTLP_ENDPOINT`

### Traces appear but spans are missing

- Make sure you're using the latest version of `@isl-lang/observability`
- Check that spans are being created (look for `cli.gate` or `cli.parse` spans)

### Collector connection errors

- Verify ports 4317/4318 are not in use: `lsof -i :4317`
- Check firewall settings if on Windows/Mac
- Try using `localhost` instead of `127.0.0.1`

## Advanced: Custom Exporter

To send traces to a different backend (e.g., Honeycomb, Grafana Cloud), configure the exporter:

```bash
export ISL_TRACE=1
export OTEL_EXPORTER_OTLP_ENDPOINT=https://api.honeycomb.io
export OTEL_EXPORTER_OTLP_HEADERS="x-honeycomb-team=YOUR_API_KEY"
```

## Stopping the Collector

```bash
docker-compose -f docker-compose.tracing.yml down
```

## Next Steps

- See [TRACING.md](./TRACING.md) for detailed tracing documentation
- Check span attributes in Jaeger to debug performance issues
- Use trace IDs to correlate CLI output with traces
