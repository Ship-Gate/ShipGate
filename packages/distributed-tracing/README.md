# @isl-lang/distributed-tracing

OpenTelemetry-based distributed tracing for ISL behaviors with correlation ID propagation.

## Features

- ✅ **Vendor-agnostic** - Uses OpenTelemetry standard, works with any tracing backend
- ✅ **Correlation ID propagation** - Automatic correlation across service boundaries
- ✅ **Fastify plugin** - Easy integration with Fastify applications
- ✅ **Fetch wrapper** - Automatic correlation ID injection for HTTP requests
- ✅ **Log integration** - Correlation IDs available for logging
- ✅ **Header propagation** - W3C Trace Context and custom headers supported

## Installation

```bash
pnpm add @isl-lang/distributed-tracing
```

For Fastify integration, also install Fastify:

```bash
pnpm add fastify
```

## Quick Start

### Fastify Plugin

```typescript
import Fastify from 'fastify';
import { fastifyTracingPlugin } from '@isl-lang/distributed-tracing/adapters/fastify';

const app = Fastify();

await app.register(fastifyTracingPlugin, {
  serviceName: 'my-service',
  serviceVersion: '1.0.0',
});

app.get('/users', async (request, reply) => {
  // Correlation ID is automatically extracted and propagated
  const correlationId = app.getCorrelationId();
  return { users: [], correlationId };
});
```

### Fetch Wrapper

```typescript
import { createTracedFetch } from '@isl-lang/distributed-tracing/adapters/fetch';

const tracedFetch = createTracedFetch(fetch, 'my-service');

// Use like normal fetch - correlation IDs are automatically injected
const response = await tracedFetch('https://api.example.com/users', {
  method: 'GET',
  headers: { 'Authorization': 'Bearer token' },
});
```

### Correlation ID Utilities

```typescript
import {
  getCorrelationId,
  getCorrelationMetadata,
  extractCorrelationFromHeaders,
  injectCorrelationToHeaders,
} from '@isl-lang/distributed-tracing';

// Get current correlation ID
const correlationId = getCorrelationId();

// Get full correlation metadata (traceId, spanId, correlationId)
const metadata = getCorrelationMetadata();

// Extract from incoming headers
const ctx = extractCorrelationFromHeaders(request.headers);

// Inject into outgoing headers
const headers = injectCorrelationToHeaders({ 'Authorization': 'Bearer token' });
```

## API Reference

### Fastify Plugin

#### `fastifyTracingPlugin(options)`

Register the tracing plugin with Fastify.

**Options:**

- `serviceName` (string, optional): Service name for traces (default: `'fastify-service'`)
- `serviceVersion` (string, optional): Service version
- `recordRequestBody` (boolean, optional): Include request body in spans (default: `false`)
- `recordResponseBody` (boolean, optional): Include response body in spans (default: `false`)
- `ignorePaths` (string[], optional): Paths to skip tracing (default: `['/health', '/metrics']`)
- `shouldTrace` (function, optional): Custom function to determine if request should be traced
- `getAttributes` (function, optional): Add custom attributes to spans

**Decorators:**

- `app.getCorrelationId()`: Get current correlation ID
- `app.getCorrelationMetadata()`: Get correlation metadata object

### Fetch Adapter

#### `createTracedFetch(baseFetch, defaultServiceName)`

Create a traced fetch wrapper.

**Parameters:**

- `baseFetch` (function, optional): Base fetch function (defaults to global `fetch`)
- `defaultServiceName` (string, optional): Default service name for spans (default: `'http-client'`)

**Returns:** Traced fetch function

**Options (passed to fetch call):**

- `serviceName` (string, optional): Service name for this request
- `createSpan` (boolean, optional): Whether to create a span (default: `true`)
- `spanName` (string, optional): Custom span name
- `spanAttributes` (object, optional): Additional span attributes
- `recordBody` (boolean, optional): Record request/response bodies in span

### Correlation Utilities

#### `getCorrelationContext()`

Get current correlation context from active span.

**Returns:** `CorrelationContext | null`

```typescript
interface CorrelationContext {
  traceId: string;
  spanId: string;
  correlationId: string;
  traceFlags?: number;
  traceState?: string;
}
```

#### `getCorrelationId()`

Get current correlation ID (shorthand).

**Returns:** `string | null`

#### `getCorrelationMetadata()`

Get correlation metadata for logging.

**Returns:** `Record<string, string> | null`

#### `extractCorrelationFromHeaders(headers)`

Extract correlation context from HTTP headers.

**Parameters:**

- `headers`: Record of header name to value(s)

**Returns:** `CorrelationContext | null`

#### `injectCorrelationToHeaders(headers)`

Inject correlation context into headers.

**Parameters:**

- `headers`: Existing headers object (optional)

**Returns:** Headers object with correlation IDs added

## Cross-Service Correlation

Correlation IDs automatically propagate across service boundaries:

```typescript
// Service A
import { fastifyTracingPlugin } from '@isl-lang/distributed-tracing/adapters/fastify';
import { createTracedFetch } from '@isl-lang/distributed-tracing/adapters/fetch';

const app = Fastify();
await app.register(fastifyTracingPlugin, { serviceName: 'service-a' });

const tracedFetch = createTracedFetch(fetch, 'service-a');

app.get('/proxy', async (request, reply) => {
  // Correlation ID from incoming request is automatically propagated
  const response = await tracedFetch('http://service-b:3000/data');
  return response.json();
});
```

```typescript
// Service B
import { fastifyTracingPlugin } from '@isl-lang/distributed-tracing/adapters/fastify';

const app = Fastify();
await app.register(fastifyTracingPlugin, { serviceName: 'service-b' });

app.get('/data', async (request, reply) => {
  // Receives correlation ID from Service A automatically
  const correlationId = app.getCorrelationId();
  return { data: '...', correlationId };
});
```

## Logging Integration

Use correlation IDs in your logs:

```typescript
import { getCorrelationMetadata } from '@isl-lang/distributed-tracing';
import logger from './logger';

app.get('/users', async (request, reply) => {
  const correlation = getCorrelationMetadata();
  
  logger.info('Fetching users', {
    ...correlation,
    userId: request.user.id,
  });
  
  // ... rest of handler
});
```

## Supported Headers

The package supports multiple header formats:

- **W3C Trace Context**: `traceparent`, `tracestate` (standard)
- **Custom headers**: `x-correlation-id`, `x-trace-id`, `x-span-id`

All formats are automatically handled and converted.

## Configuration

### OpenTelemetry Setup

The package uses OpenTelemetry for tracing. Configure your exporter:

```typescript
import { ISLTracer } from '@isl-lang/distributed-tracing';
import { TracingConfig } from '@isl-lang/distributed-tracing';

const config: TracingConfig = {
  serviceName: 'my-service',
  serviceVersion: '1.0.0',
  exporter: {
    type: 'otlp',
    endpoint: 'http://localhost:4318/v1/traces',
  },
};

const tracer = new ISLTracer(config);
await tracer.initialize();
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
