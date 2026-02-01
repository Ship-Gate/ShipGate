# @intentos/stdlib-idempotency

ISL Standard Library for **Idempotency Key Management**. Provides exactly-once semantics for API operations with support for multiple storage backends and web framework integrations.

## Features

- **Multiple Storage Backends**: Memory (development), Redis (production), PostgreSQL (durable)
- **Framework Middleware**: Express and Fastify integrations
- **Distributed Locking**: Atomic lock acquisition with timeout and extension
- **Request Fingerprinting**: Detect duplicate vs. modified requests
- **Automatic Cleanup**: TTL-based expiration with configurable retention
- **Type-Safe**: Full TypeScript support with branded types

## Installation

```bash
npm install @intentos/stdlib-idempotency
# or
pnpm add @intentos/stdlib-idempotency
```

## Quick Start

### Express Middleware

```typescript
import express from 'express';
import { createIdempotencyMiddleware, createMemoryStore } from '@intentos/stdlib-idempotency';

const app = express();
const store = createMemoryStore();

app.use(express.json());
app.use(createIdempotencyMiddleware({ store }));

app.post('/payments', async (req, res) => {
  // This operation will only execute once per Idempotency-Key
  const payment = await processPayment(req.body);
  res.status(201).json(payment);
});
```

### Fastify Plugin

```typescript
import Fastify from 'fastify';
import { idempotencyPlugin, createMemoryStore } from '@intentos/stdlib-idempotency';

const fastify = Fastify();
const store = createMemoryStore();

fastify.register(idempotencyPlugin, { store });

fastify.post('/orders', async (request, reply) => {
  const order = await createOrder(request.body);
  return reply.code(201).send(order);
});
```

### Programmatic Usage

```typescript
import { IdempotencyManager, createMemoryStore } from '@intentos/stdlib-idempotency';

const manager = new IdempotencyManager({
  store: createMemoryStore(),
});

// Execute with automatic idempotency
const result = await manager.execute(
  'payment-123',  // Idempotency key
  { amount: 100, currency: 'USD' },  // Request payload (for hashing)
  async () => {
    // This only executes once per key
    return await processPayment({ amount: 100, currency: 'USD' });
  }
);

if (result.success) {
  console.log(result.data);  // Payment result
  console.log(result.replayed);  // true if cached response
}
```

## Storage Backends

### Memory Store (Development)

```typescript
import { createMemoryStore } from '@intentos/stdlib-idempotency';

const store = createMemoryStore({
  defaultTtl: 24 * 60 * 60 * 1000,  // 24 hours
  lockTimeout: 30 * 1000,  // 30 seconds
  maxRecords: 10000,
  cleanupInterval: 60000,  // Auto-cleanup every minute
});
```

### Redis Store (Production)

```typescript
import Redis from 'ioredis';
import { createRedisStore } from '@intentos/stdlib-idempotency';

const redis = new Redis(process.env.REDIS_URL);
const store = createRedisStore({
  client: redis,
  keyPrefix: 'idempotency',
  defaultTtl: 24 * 60 * 60 * 1000,
});
```

### PostgreSQL Store (Durable)

```typescript
import { Pool } from 'pg';
import { createPostgresStore } from '@intentos/stdlib-idempotency';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const store = createPostgresStore({
  client: pool,
  tableName: 'idempotency_records',
  autoCreateTable: true,
});

// Initialize (creates table if needed)
await store.initialize();
```

## How It Works

1. **Client sends request** with `Idempotency-Key` header
2. **Check for existing key**:
   - If found with matching request hash → Return cached response
   - If found with different hash → Return 422 (request mismatch)
   - If processing → Return 409 (concurrent request) or wait
3. **Acquire lock** and mark as `PROCESSING`
4. **Execute operation** and capture response
5. **Record response** with TTL for future replays
6. **Subsequent requests** with same key return cached response

## API Reference

### IdempotencyStore Interface

All storage backends implement this interface:

```typescript
interface IdempotencyStore {
  check(input: CheckInput): Promise<CheckResult>;
  startProcessing(input: StartProcessingInput): Promise<LockResult>;
  record(input: RecordInput): Promise<IdempotencyRecord>;
  releaseLock(input: ReleaseLockInput): Promise<ReleaseResult>;
  extendLock(input: ExtendLockInput): Promise<ExtendResult>;
  cleanup(input: CleanupInput): Promise<CleanupResult>;
  get(key: string): Promise<IdempotencyRecord | null>;
  delete(key: string): Promise<boolean>;
  healthCheck(): Promise<boolean>;
  close(): Promise<void>;
}
```

### Configuration Options

```typescript
interface IdempotencyConfig {
  defaultTtl?: number;      // TTL in ms (default: 24 hours)
  lockTimeout?: number;     // Lock timeout in ms (default: 30s)
  maxResponseSize?: number; // Max response size in bytes (default: 1MB)
  maxKeyLength?: number;    // Max key length (default: 256)
  keyPrefix?: string;       // Namespace prefix
  fingerprintHeaders?: string[];  // Headers to include in hash
}
```

### Middleware Options

```typescript
interface IdempotencyMiddlewareOptions {
  store: IdempotencyStore;
  config?: IdempotencyConfig;
  keyHeader?: string;       // Header name (default: 'Idempotency-Key')
  methods?: string[];       // HTTP methods (default: ['POST', 'PUT', 'PATCH'])
  excludePaths?: (string | RegExp)[];
  requireKey?: boolean;     // Require idempotency key
  concurrentRequestHandling?: 'wait' | 'reject';
  maxWaitTime?: number;     // Max wait for concurrent request
}
```

## Best Practices

### Key Generation

```typescript
import { generateIdempotencyKey, generateDeterministicKey } from '@intentos/stdlib-idempotency';

// From components
const key = generateIdempotencyKey('user', userId, 'create-order', orderId);
// → "user:123:create-order:order-456"

// Deterministic (includes timestamp bucket)
const key = generateDeterministicKey(clientId, 'transfer', accountId);
```

### Error Handling

```typescript
const result = await manager.execute(key, payload, operation);

if (!result.success) {
  switch (result.error.code) {
    case 'REQUEST_MISMATCH':
      // Different payload for same key - client error
      throw new BadRequestError('Idempotency key reused with different payload');
    
    case 'CONCURRENT_REQUEST':
      // Request in progress - retry later
      if (result.error.retriable) {
        await sleep(result.error.retryAfterMs);
        // Retry...
      }
      break;
  }
}
```

### Long-Running Operations

```typescript
const lock = await manager.startProcessing({ key, requestHash });

if (lock.acquired) {
  try {
    // For long operations, extend the lock periodically
    const interval = setInterval(async () => {
      await manager.extendLock({
        key,
        lockToken: lock.lockToken,
        extension: 30000,  // 30 more seconds
      });
    }, 20000);

    const result = await longRunningOperation();
    clearInterval(interval);

    await manager.record({
      key,
      requestHash,
      response: JSON.stringify(result),
      lockToken: lock.lockToken,
    });
  } catch (error) {
    await manager.releaseLock({
      key,
      lockToken: lock.lockToken,
      markFailed: true,
      errorMessage: error.message,
    });
    throw error;
  }
}
```

## ISL Domain Definition

```isl
domain Idempotency {
  version: "1.0.0"
  
  entity IdempotencyRecord {
    key: IdempotencyKey [unique]
    request_hash: String
    response: String
    status: RecordStatus
    created_at: Timestamp [immutable]
    expires_at: Timestamp
  }
  
  enum RecordStatus {
    PROCESSING
    COMPLETED
    FAILED
  }
  
  behavior Check {
    input { key: IdempotencyKey, request_hash: String }
    output { success: CheckResult }
    temporal { response within 5.ms (p99) }
  }
  
  behavior Record {
    input { key: IdempotencyKey, response: String, ttl: Duration? }
    output { success: IdempotencyRecord }
  }
}
```

## License

MIT
