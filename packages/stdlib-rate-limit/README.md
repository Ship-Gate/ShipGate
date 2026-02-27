# @isl-lang/stdlib-rate-limit

ISL Standard Library - Rate Limiting and Throttling

## Overview

This package provides comprehensive rate limiting capabilities with:

- **ISL Specifications**: Complete behavioral contracts for rate limiting
- **TypeScript Implementation**: Production-ready reference implementation
- **Multiple Storage Backends**: In-memory and Redis support
- **Framework Adapters**: Express middleware included

## Installation

```bash
pnpm add @isl-lang/stdlib-rate-limit
```

## ISL Specification

### Import in ISL

```isl
domain MyApp version "1.0.0"

import { CheckRateLimit, BlockIdentifier, UnblockIdentifier } from "@isl/stdlib-rate-limit"
import { RateLimitAction, IdentifierType } from "@isl/stdlib-rate-limit/types"

behavior ProtectedEndpoint {
  input {
    user_id: UUID
    ip_address: String
  }
  
  flow {
    step 1: CheckRateLimit(
      key: input.ip_address,
      identifier_type: IP,
      config_name: "api"
    )
    step 2: when step_1.action == DENY {
      return error RATE_LIMITED
    }
    step 3: process_request()
  }
}
```

### Behaviors

| Behavior | Description |
|----------|-------------|
| `CheckRateLimit` | Check if request should be allowed |
| `IncrementCounter` | Increment counter after request |
| `CheckAndIncrement` | Atomic check and increment |
| `GetBucketStatus` | Get current bucket status |
| `BlockIdentifier` | Manually block an identifier |
| `UnblockIdentifier` | Remove a block |
| `IsBlocked` | Check if identifier is blocked |
| `RecordViolation` | Record violation for analytics |
| `GetViolationHistory` | Query violation history |

## TypeScript Usage

### Basic Usage

```typescript
import { 
  createRateLimiter, 
  createMemoryStorage,
  RateLimitAction,
  IdentifierType
} from '@isl-lang/stdlib-rate-limit';

// Create rate limiter
const limiter = createRateLimiter({
  storage: createMemoryStorage(),
  configs: [
    {
      name: 'api',
      limit: 100,
      windowMs: 60 * 1000, // 1 minute
      warnThreshold: 0.8,
    },
    {
      name: 'login',
      limit: 5,
      windowMs: 15 * 60 * 1000, // 15 minutes
      blockDurationMs: 30 * 60 * 1000, // 30 min block on exceed
    }
  ]
});

// Check rate limit
const result = await limiter.check({
  key: '192.168.1.1',
  identifierType: IdentifierType.IP,
  configName: 'api'
});

if (result.allowed) {
  // Process request
  console.log(`Remaining: ${result.remaining}/${result.limit}`);
} else {
  console.log(`Rate limited. Retry after ${result.retryAfterMs}ms`);
}
```

### Express Middleware

```typescript
import express from 'express';
import { 
  createRateLimiter, 
  createMemoryStorage,
  rateLimitMiddleware,
  ipRateLimit,
  userRateLimit
} from '@isl-lang/stdlib-rate-limit';

const app = express();

const limiter = createRateLimiter({
  storage: createMemoryStorage(),
  configs: [
    { name: 'general', limit: 100, windowMs: 60000 },
    { name: 'auth', limit: 5, windowMs: 900000 },
  ]
});

// Apply to all routes
app.use(rateLimitMiddleware({
  limiter,
  configName: 'general'
}));

// Stricter limit for auth endpoints
app.use('/api/auth', ipRateLimit(limiter, 'auth'));

// User-based limit for authenticated routes
app.use('/api/user', userRateLimit(limiter, 'general'));
```

### Redis Storage (Distributed)

```typescript
import Redis from 'ioredis';
import { createRateLimiter, createRedisStorage } from '@isl-lang/stdlib-rate-limit';

const redis = new Redis(process.env.REDIS_URL);

const limiter = createRateLimiter({
  storage: createRedisStorage({
    client: redis,
    keyPrefix: 'myapp:ratelimit:'
  }),
  configs: [
    { name: 'api', limit: 1000, windowMs: 60000 }
  ]
});
```

### Manual Blocking

```typescript
// Block an IP for 1 hour
await limiter.block({
  key: '192.168.1.100',
  identifierType: IdentifierType.IP,
  durationMs: 60 * 60 * 1000,
  reason: 'Suspicious activity detected'
});

// Check if blocked
const { blocked, reason, expiresAt } = await limiter.isBlocked(
  '192.168.1.100',
  IdentifierType.IP
);

// Unblock
await limiter.unblock({
  key: '192.168.1.100',
  identifierType: IdentifierType.IP,
  reason: 'Verified legitimate user'
});
```

## Rate Limit Actions

| Action | Description |
|--------|-------------|
| `ALLOW` | Request allowed, under limit |
| `WARN` | Request allowed, approaching limit |
| `THROTTLE` | Request should be delayed |
| `DENY` | Request rejected, limit exceeded |
| `CAPTCHA` | Require captcha verification |

## Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `name` | string | required | Unique config identifier |
| `limit` | number | required | Max requests per window |
| `windowMs` | number | required | Window size in milliseconds |
| `algorithm` | enum | SLIDING_WINDOW | Rate limit algorithm |
| `warnThreshold` | number | - | Percentage to trigger WARN |
| `throttleThreshold` | number | - | Percentage to trigger THROTTLE |
| `blockDurationMs` | number | - | Auto-block duration on exceed |
| `escalationMultiplier` | number | 2 | Multiplier for repeated violations |
| `bypassRoles` | string[] | - | Roles that bypass limit |
| `bypassIps` | string[] | - | IPs that bypass limit |

## Response Headers

Standard headers are automatically added:

```
RateLimit-Limit: 100
RateLimit-Remaining: 95
RateLimit-Reset: 1704067200
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1704067200
Retry-After: 60  (only when rate limited)
```

## Contract Guarantees

### Preconditions
- Key must be non-empty string
- Config must exist
- Weight must be >= 1

### Postconditions
- Remaining count never negative
- Reset time always in future
- Headers match result values

### Temporal Constraints
- Check: < 10ms p50, < 50ms p99
- Increment: < 20ms p99
- Block operations: < 100ms p99

### Invariants
- Atomic check-and-increment operations
- No double-counting on retry
- Consistent state across distributed nodes (with Redis)

## Versioning

| Package Version | ISL Version | Node.js | Breaking Changes |
|-----------------|-------------|---------|------------------|
| 1.0.x | 1.0.0 | >= 18 | Initial release |

## License

MIT
