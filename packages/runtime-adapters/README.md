# Runtime Adapters for Verification

Runtime adapters for Fastify, Express, and Fetch to capture traces for verification with `shipgate verify`.

## Overview

This package provides simple, one-line adapters that intercept HTTP requests/responses and capture traces in the format required for temporal and coverage analysis. Traces are automatically collected and can be exported for use with `shipgate verify`.

## Features

- ✅ **Fastify adapter** - Plugin that intercepts requests/responses
- ✅ **Express adapter** - Middleware for Express apps
- ✅ **Fetch adapter** - Wrapper for outbound HTTP calls
- ✅ **Trace collection** - Automatic trace storage for verification
- ✅ **One-line wiring** - Simple integration

## Installation

```bash
pnpm add @isl-lang/runtime-adapters
```

## Quick Start

### Fastify

```typescript
import Fastify from 'fastify';
import { fastifyVerificationAdapter } from '@isl-lang/runtime-adapters/fastify';

const fastify = Fastify();

// One line of adapter wiring
await fastify.register(fastifyVerificationAdapter, {
  domain: 'Auth',
  behaviorExtractor: (req) => `${req.method} ${req.url}`,
});

fastify.post('/api/login', async (request, reply) => {
  // Your handler logic
  return { success: true };
});
```

### Express

```typescript
import express from 'express';
import { expressVerificationMiddleware } from '@isl-lang/runtime-adapters/express';

const app = express();

// One line of adapter wiring
app.use(expressVerificationMiddleware({
  domain: 'Auth',
  behaviorExtractor: (req) => `${req.method} ${req.path}`,
}));

app.post('/api/login', (req, res) => {
  // Your handler logic
  res.json({ success: true });
});
```

### Fetch

```typescript
import { createVerificationFetch } from '@isl-lang/runtime-adapters/fetch';

const fetchWithVerification = createVerificationFetch({
  domain: 'Auth',
  behaviorExtractor: (url, options) => `fetch ${options?.method || 'GET'} ${url}`,
});

// Use instead of global fetch
const response = await fetchWithVerification('https://api.example.com/users', {
  method: 'GET',
});
```

## Verification

After wiring the adapter, traces are automatically collected. Export them for verification:

```typescript
import { getCollector } from '@isl-lang/runtime-adapters';

// Export traces
const { traces, events } = getCollector().export();

// Or verify directly
// shipgate verify --spec auth.isl --impl server.ts
```

## API Reference

### Fastify Adapter

```typescript
interface FastifyVerificationOptions {
  domain: string;
  behaviorExtractor?: (req: FastifyRequest) => string;
  correlationIdExtractor?: (req: FastifyRequest) => string;
  captureRequestBody?: boolean;
  captureResponseBody?: boolean;
  ignorePaths?: string[];
  shouldTrace?: (req: FastifyRequest) => boolean;
}

await fastify.register(fastifyVerificationAdapter, options);
```

### Express Adapter

```typescript
interface ExpressVerificationOptions {
  domain: string;
  behaviorExtractor?: (req: Request) => string;
  correlationIdExtractor?: (req: Request) => string;
  captureRequestBody?: boolean;
  captureResponseBody?: boolean;
  ignorePaths?: string[];
  shouldTrace?: (req: Request) => boolean;
}

app.use(expressVerificationMiddleware(options));
```

### Fetch Adapter

```typescript
interface FetchVerificationOptions {
  domain: string;
  behaviorExtractor?: (url: string, options?: RequestInit) => string;
  correlationIdExtractor?: (options?: RequestInit) => string;
  captureRequestBody?: boolean;
  captureResponseBody?: boolean;
  ignoreUrls?: string[];
  shouldTrace?: (url: string, options?: RequestInit) => boolean;
}

const fetchWithVerification = createVerificationFetch(options);
```

### Trace Collector

```typescript
import { getCollector } from '@isl-lang/runtime-adapters';

const collector = getCollector();

// Get all traces
const traces = collector.getTraces();

// Get traces for a domain
const authTraces = collector.getTracesForDomain('Auth');

// Get events for a handler
const loginEvents = collector.getEventsForHandler('Login');

// Export for verification
const exported = collector.export();

// Get coverage statistics
const coverage = collector.getCoverage();

// Clear all traces
collector.clear();
```

## Example

See `examples/fastify-sample/` for a complete example:

```bash
cd examples/fastify-sample
pnpm start
# Server runs on http://localhost:3000

# In another terminal:
shipgate verify --spec auth.isl --impl server.ts
```

## Security

By default, the adapters:
- Do not capture request/response bodies (set `captureRequestBody`/`captureResponseBody` to `true` if needed)
- Redact sensitive fields (password, token, secret, etc.)
- Limit body size to 1024 bytes
- Filter authorization headers

## License

MIT
