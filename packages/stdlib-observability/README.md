# @isl-lang/stdlib-observability

Structured logging, metrics, tracing, and health checks for ISL applications.

## Features

- **Structured Logging**: JSON-formatted logs with correlation support
- **Metrics**: Counters, gauges, histograms, and summaries
- **Distributed Tracing**: OpenTelemetry-compatible tracing without OTel dependency
- **Health Checks**: Configurable health check registry
- **Correlation**: Automatic trace/span correlation across async boundaries

## Installation

```bash
pnpm add @isl-lang/stdlib-observability
```

## Usage

```typescript
import {
  Logger,
  LogLevel,
  MetricsRegistry,
  Tracer,
  HealthCheckRegistry,
  withCorrelationContext,
} from '@isl-lang/stdlib-observability';

// Initialize
const logger = new Logger({
  minLevel: LogLevel.INFO,
  service: 'my-service',
  environment: 'production',
});

const metrics = new MetricsRegistry();
const tracer = new Tracer({
  serviceName: 'my-service',
  serviceVersion: '1.0.0',
});

// Use with correlation (AsyncLocalStorage-based)
await withCorrelationContext({ traceId: 'abc123', userId: 'u1' }, async () => {
  // Logger automatically picks up correlation context
  await logger.info('Processing request');
  
  const counter = metrics.registerCounter({
    name: 'requests_total',
    description: 'Total requests',
  });
  await counter.increment();
  
  const result = tracer.startSpan({ name: 'operation' });
  if (result.success) {
    const { span } = result.value;
    tracer.endSpan({ spanId: span.spanId });
  }
});
```

> **Note:** Correlation context propagation uses Node.js `AsyncLocalStorage`.
> Context flows automatically through `async/await`, `setTimeout`, and `Promise` chains.

## API

### Logging
- `Logger` - Structured logger with correlation support
- `ConsoleLogExporter` - Export logs to console
- `InMemoryLogExporter` - Store logs in memory (testing)

### Metrics
- `MetricsRegistry` - Registry for all metric types
- Counter, Gauge, Histogram, Summary metric types
- `ConsoleMetricExporter` - Export metrics in Prometheus format
- `InMemoryMetricExporter` - Store metrics in memory (testing)

### Tracing
- `Tracer` - Create and manage spans
- `ConsoleSpanExporter` - Export spans to console
- `InMemorySpanExporter` - Store spans in memory (testing)
- Context injection/extraction for distributed tracing

### Health Checks
- `HealthCheckRegistry` - Register and check health of dependencies
- `createHttpHealthCheck` - HTTP endpoint health check
- `createTcpHealthCheck` - TCP connection health check
- `createCustomHealthCheck` - Custom health check function

### Correlation
- `withCorrelationContext` - Execute code with correlation context
- `extractCorrelationFromHeaders` / `injectCorrelationIntoHeaders` - HTTP header propagation
- `createCorrelationMiddleware` - Middleware for request correlation

## Development

```bash
pnpm build        # Build the package
pnpm test         # Run tests
pnpm typecheck    # Type-check without emit
pnpm clean        # Remove dist/
```

## License

MIT
