# IntentOS Standard Library

The ISL Standard Library provides pre-built domains for common software patterns. Each package includes ISL intent specifications and TypeScript implementations.

## Standard Library Packages

| Package | Description | Key Behaviors |
|---------|-------------|---------------|
| **stdlib-core** | Primitive types, patterns, utilities | Timestamps, Money, Pagination, Tree |
| **stdlib-auth** | Authentication & authorization | Login, Register, Sessions, RBAC, OAuth |
| **stdlib-api** | API definitions (REST, GraphQL) | CRUD, Endpoints, OpenAPI generation |
| **stdlib-events** | Event sourcing & CQRS | Event Store, Projections, Sagas |
| **stdlib-workflow** | State machines & sagas | Workflows, Steps, Compensation |
| **stdlib-realtime** | WebSockets & pub/sub | Connections, Channels, Presence |
| **stdlib-search** | Full-text search | Query DSL, Facets, Highlighting |
| **stdlib-queue** | Job processing | Queues, Jobs, Scheduling, Workers |
| **stdlib-ai** | LLM & ML integration | Completions, Embeddings, Agents, RAG |
| **stdlib-observability** | Logs, metrics, traces | Logging, Metrics, Spans, Alerts, SLOs |
| **stdlib-payments** | Payment processing | Charges, Refunds, Subscriptions |
| **stdlib-messaging** | Email, SMS, push | Send, Templates, Delivery tracking |
| **stdlib-notifications** | In-app notifications | Create, Read, Preferences |
| **stdlib-scheduling** | Time-based scheduling | Cron, Appointments, Availability |
| **stdlib-files** | File management | Upload, Download, Folders |

## Domain Relationship Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                          YOUR APPLICATION                            │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        STDLIB-API (REST/GraphQL)                     │
│         Endpoints, CRUD, Versioning, Rate Limiting, CORS            │
└─────────────────────────────────────────────────────────────────────┘
          │                    │                    │
          ▼                    ▼                    ▼
┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
│   STDLIB-AUTH    │  │  STDLIB-SEARCH   │  │ STDLIB-REALTIME  │
│  Authentication  │  │   Full-text      │  │   WebSockets     │
│  Authorization   │  │   Facets         │  │   Pub/Sub        │
└──────────────────┘  └──────────────────┘  └──────────────────┘
          │                                          │
          ▼                                          ▼
┌──────────────────────────────────────────────────────────────────────┐
│                          STDLIB-EVENTS (CQRS)                         │
│            Event Store, Projections, Aggregates, Process Managers     │
└──────────────────────────────────────────────────────────────────────┘
          │                    │                    │
          ▼                    ▼                    ▼
┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
│ STDLIB-WORKFLOW  │  │  STDLIB-QUEUE    │  │    STDLIB-AI     │
│  State Machines  │  │  Background Jobs │  │  LLMs, Agents    │
│  Sagas           │  │  Scheduling      │  │  Embeddings      │
└──────────────────┘  └──────────────────┘  └──────────────────┘
          │                    │                    │
          └────────────────────┼────────────────────┘
                               ▼
┌──────────────────────────────────────────────────────────────────────┐
│                      STDLIB-OBSERVABILITY                             │
│                Logging, Metrics, Tracing, Alerts, SLOs                │
└──────────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌──────────────────────────────────────────────────────────────────────┐
│                          STDLIB-CORE                                  │
│           Primitives, Patterns, Types, Validation, Utilities          │
└──────────────────────────────────────────────────────────────────────┘
```

## Usage

### Importing Standard Library

```isl
domain MyApp {
  imports {
    User, Session from "@intentos/stdlib-auth"
    Endpoint, Resource from "@intentos/stdlib-api"
    Workflow, Step from "@intentos/stdlib-workflow"
    SearchIndex, Query from "@intentos/stdlib-search"
    Model, Complete from "@intentos/stdlib-ai"
  }
  
  # Your domain extends stdlib types
  entity Customer extends User {
    stripe_customer_id: String?
    subscription_tier: SubscriptionTier
  }
}
```

### Example: E-Commerce Application

```isl
domain ECommerce {
  version: "1.0.0"
  
  imports {
    User from "@intentos/stdlib-auth"
    Money from "@intentos/stdlib-core"
    Workflow from "@intentos/stdlib-workflow"
    SearchIndex from "@intentos/stdlib-search"
    Queue from "@intentos/stdlib-queue"
  }
  
  entity Product {
    id: UUID [unique]
    name: String
    description: String
    price: Money
    inventory: Int [min: 0]
    
    # Searchable
    search_index: SearchIndex = "products"
  }
  
  entity Order {
    id: UUID [unique]
    customer: User
    items: List<OrderItem>
    status: OrderStatus
    
    # Workflow-managed
    workflow: Workflow = OrderFulfillmentWorkflow
  }
  
  # Order fulfillment saga
  workflow OrderFulfillmentWorkflow {
    steps: [
      ReserveInventory -> ChargePayment -> CreateShipment
    ]
    
    compensation: [
      CreateShipment -> CancelShipment,
      ChargePayment -> RefundPayment,
      ReserveInventory -> ReleaseInventory
    ]
  }
  
  behavior PlaceOrder {
    input {
      customer_id: UUID
      items: List<{ product_id: UUID, quantity: Int }>
    }
    
    effects {
      triggers OrderFulfillmentWorkflow
      enqueues SendOrderConfirmationEmail to notification_queue
    }
    
    temporal {
      within 500ms: order created
      eventually within 24h: order shipped or cancelled
    }
  }
}
```

## ISL Language Specification v2.0

The enhanced ISL language includes:

### Type System
- **Generics**: `List<T>`, `Map<K, V>`, bounded generics
- **Union types**: `String | Int`
- **Intersection types**: `Identifiable & Timestamped`
- **Refinement types**: `Int [min: 0, max: 100]`
- **Higher-kinded types**: `Functor<F<_>>`

### Effect System
- **Effect declarations**: `effect IO`, `effect Database`
- **Effect tracking**: Behaviors declare their effects
- **Effect handlers**: Transform or handle effects

### Temporal Logic
- **Temporal operators**: `always`, `eventually`, `within`, `until`
- **Performance constraints**: `within 100ms (p99)`
- **Ordering constraints**: `A before B`

### Verification
- **Preconditions**: Must be true before execution
- **Postconditions**: Must be true after execution
- **Invariants**: Must always be true
- **Frame conditions**: What can/cannot change

### Composition
- **Domain imports**: Reuse other domains
- **Type extension**: Extend imported types
- **Behavior composition**: Sequential (`>>`), parallel (`|&|`), alternative (`|||`)
- **Mixins & traits**: Reusable behavior bundles

### Pattern Matching
- **Destructuring**: `{ name, age }`
- **Type patterns**: `e: UserCreated`
- **Collection patterns**: `[first, ...rest]`
- **Result patterns**: `success(value)`, `error(e)`

## Code Generation Targets

ISL compiles to multiple languages:

| Target | Status | Features |
|--------|--------|----------|
| TypeScript | ✅ | Types, Zod schemas, tests |
| Python | ✅ | Pydantic models, pytest |
| Go | ✅ | Structs, interfaces |
| Rust | ✅ | Structs, traits |
| Java/Kotlin | ✅ | Records, data classes |
| OpenAPI | ✅ | 3.1 spec generation |
| GraphQL | ✅ | SDL schema |
| Protobuf | ✅ | gRPC definitions |
| SQL | ✅ | DDL, migrations |
| Terraform | ✅ | Infrastructure as code |

## Getting Started

```bash
# Install ISL CLI
npm install -g @intentos/isl-cli

# Create new project
isl init my-app

# Install stdlib packages
cd my-app
pnpm add @intentos/stdlib-auth @intentos/stdlib-api

# Write your domain
cat > domain.isl << 'EOF'
domain MyApp {
  imports {
    User from "@intentos/stdlib-auth"
  }
  
  entity Post {
    id: UUID [unique]
    author: User
    title: String
    content: String
  }
}
EOF

# Generate code
isl compile domain.isl --target typescript

# Run verification
isl verify domain.isl --impl ./src
```

## Philosophy

> "Intent in, verified software out."

ISL is not just a specification language—it's a new paradigm where:

1. **Intent is the source of truth** - Not code
2. **Tests are derived** - From postconditions and scenarios
3. **Implementation is generated** - By AI or humans
4. **Verification proves correctness** - Trust scores quantify confidence

The standard library provides battle-tested intent specifications for common patterns, so you can compose verified software instead of writing it from scratch.

---

## Core Module Deep Dive

The following sections provide detailed API documentation for the four most commonly used stdlib modules.

### stdlib-auth

Authentication and authorization with secure session management, OAuth, MFA, and RBAC.

#### Import Paths

```isl
# Domain-level import
import { User, Session } from "@isl/stdlib-auth"

# Module-specific imports
import { CreateSession, ValidateSession, RevokeSession } from "@isl/stdlib-auth/session"
import { InitiateOAuth, ExchangeOAuthCode } from "@isl/stdlib-auth/oauth"
import { CheckLoginRateLimit, RecordLoginAttempt } from "@isl/stdlib-auth/rate-limit"
```

#### Key Behaviors

| Behavior | Description | Temporal |
|----------|-------------|----------|
| `CreateSession` | Create authenticated session | < 200ms p99 |
| `ValidateSession` | Validate session token | < 50ms p99 |
| `RevokeSession` | Revoke single session | < 100ms p99 |
| `RevokeAllUserSessions` | Revoke all user sessions | < 1s p99 |
| `InitiateOAuth` | Start OAuth 2.0 flow | < 500ms p99 |
| `ExchangeOAuthCode` | Exchange code for tokens | < 2s p99 |
| `CheckLoginRateLimit` | Check brute-force protection | < 20ms p99 |
| `RecordLoginAttempt` | Record login attempt | < 50ms p99 |

#### TypeScript Usage

```typescript
import { AuthService } from '@isl-lang/stdlib-auth';

const auth = new AuthService({
  hashRounds: 12,
  sessionDuration: '24h',
  maxFailedAttempts: 5
});

// Create session
const session = await auth.createSession({
  userId: 'user-123',
  ipAddress: '192.168.1.1'
});

// Validate session
const { valid, user } = await auth.validateSession(session.token);
```

#### Contract Guarantees

- **Preconditions**: Valid email format, password min 8 chars
- **Postconditions**: Session token 64+ bytes, bcrypt/argon2 hash
- **Invariants**: Passwords never in plaintext or logs

---

### stdlib-payments

Payment processing with support for multiple providers, subscriptions, refunds, and webhooks.

#### Import Paths

```isl
import { Payment, Subscription } from "@isl/stdlib-payments"
import { CreatePayment, ProcessPaymentIntent } from "@isl/stdlib-payments/payments"
import { CreateSubscription, CancelSubscription } from "@isl/stdlib-payments/subscriptions"
import { ReceiveWebhook, ProcessWebhook } from "@isl/stdlib-payments/webhooks"
```

#### Key Behaviors

| Behavior | Description | Temporal |
|----------|-------------|----------|
| `CreatePayment` | Create payment intent | < 500ms p99 |
| `ProcessPaymentIntent` | Process payment | < 5s p99 |
| `CancelPayment` | Cancel pending payment | < 500ms p99 |
| `CreateRefund` | Create refund request | < 500ms p99 |
| `CreateSubscription` | Create subscription | < 2s p99 |
| `CancelSubscription` | Cancel subscription | < 500ms p99 |
| `ProcessWebhook` | Process payment webhook | < 30s |

#### TypeScript Usage

```typescript
import { PaymentService } from '@isl-lang/stdlib-payments';

const payments = new PaymentService({
  provider: 'stripe',
  apiKey: process.env.STRIPE_SECRET_KEY
});

const payment = await payments.createPayment({
  customerId: 'cus-123',
  amount: 9999,
  currency: 'USD'
});

const result = await payments.processPayment(payment.id, { cardId: 'card-456' });
```

#### Contract Guarantees

- **Preconditions**: Amount > 0, customer exists
- **Postconditions**: Payment has processor_id on success
- **Invariants**: PCI DSS compliant, idempotent operations

---

### stdlib-rate-limit

Comprehensive rate limiting with multiple algorithms and distributed storage support.

#### Import Paths

```isl
import { RateLimitBucket, RateLimitBlock } from "@isl/stdlib-rate-limit"
import { CheckRateLimit, CheckAndIncrement } from "@isl/stdlib-rate-limit/check"
import { BlockIdentifier, UnblockIdentifier } from "@isl/stdlib-rate-limit/block"
```

#### Key Behaviors

| Behavior | Description | Temporal |
|----------|-------------|----------|
| `CheckRateLimit` | Check if request allowed | < 10ms p50, < 50ms p99 |
| `IncrementCounter` | Increment counter | < 20ms p99 |
| `CheckAndIncrement` | Atomic check + increment | < 75ms p99 |
| `BlockIdentifier` | Manually block | < 100ms p99 |
| `UnblockIdentifier` | Remove block | < 100ms p99 |
| `RecordViolation` | Record violation | < 50ms p99 |

#### Rate Limit Actions

| Action | Description |
|--------|-------------|
| `ALLOW` | Request allowed, under limit |
| `WARN` | Allowed but approaching limit |
| `THROTTLE` | Should be delayed |
| `DENY` | Rejected, limit exceeded |
| `CAPTCHA` | Require captcha verification |

#### TypeScript Usage

```typescript
import { createRateLimiter, createMemoryStorage, IdentifierType } from '@isl-lang/stdlib-rate-limit';

const limiter = createRateLimiter({
  storage: createMemoryStorage(),
  configs: [
    { name: 'api', limit: 100, windowMs: 60000 },
    { name: 'login', limit: 5, windowMs: 900000 }
  ]
});

const result = await limiter.check({
  key: '192.168.1.1',
  identifierType: IdentifierType.IP,
  configName: 'api'
});

if (!result.allowed) {
  throw new Error(`Rate limited. Retry after ${result.retryAfterMs}ms`);
}
```

#### Express Middleware

```typescript
import { rateLimitMiddleware } from '@isl-lang/stdlib-rate-limit/adapters/express';

app.use('/api', rateLimitMiddleware({ limiter, configName: 'api' }));
```

---

### stdlib-audit

Compliance-ready audit logging with PII handling, event chaining, and multiple export formats.

#### Import Paths

```isl
import { AuditEvent, Actor, Resource } from "@isl/stdlib-audit"
import { Record, RecordBatch } from "@isl/stdlib-audit/record"
import { Query, GetStats } from "@isl/stdlib-audit/query"
import { Export } from "@isl/stdlib-audit/export"
```

#### Event Categories

| Category | Description |
|----------|-------------|
| `AUTHENTICATION` | Login, logout, password changes |
| `AUTHORIZATION` | Permission checks, role changes |
| `DATA_ACCESS` | Read operations on sensitive data |
| `DATA_MODIFICATION` | Create, update, delete operations |
| `ADMIN_ACTION` | Administrative operations |
| `SECURITY_EVENT` | Security-related events |

#### TypeScript Usage

```typescript
import { createAuditLogger, EventCategory, EventOutcome } from '@isl-lang/stdlib-audit';
import { PostgresAuditStorage } from '@isl-lang/stdlib-audit/storage/postgres';

const audit = createAuditLogger({
  storage: new PostgresAuditStorage(pool),
  service: 'my-app',
  enableHashing: true
});

await audit.logAuthentication('login', {
  id: 'user-123',
  type: 'USER',
  email: 'user@example.com',
  ip_address: req.ip
}, EventOutcome.SUCCESS);

await audit.logDataModification('update', actor, {
  type: 'User',
  id: 'user-123'
}, EventOutcome.SUCCESS, [
  { field: 'email', old_value: 'old@example.com', new_value: 'new@example.com' }
]);
```

#### Compliance Features

- SOC2, PCI-DSS, HIPAA, SOX, GDPR ready
- Tamper-evident hash chain
- Configurable retention policies
- PII masking/redaction
- Export to CSV, JSON, NDJSON, Parquet

---

## Import Resolution & Verification

### How `use stdlib-*` Resolves

When you write ISL imports, the compiler resolves them as follows:

```isl
import { CreateSession } from "@isl/stdlib-auth/session"
```

**Resolution steps:**
1. Parse import path: `@isl/stdlib-auth/session`
2. Locate package: `node_modules/@isl-lang/stdlib-auth`
3. Find ISL spec: `intents/behaviors/session.isl`
4. Load types: Resolve `Session`, `SessionToken`, etc.
5. Export mapping: Map `CreateSession` to behavior definition

### Verification Example

```bash
# Verify your implementation against stdlib contracts
isl verify ./src --contracts @isl/stdlib-auth

# Output:
# ✓ CreateSession contract satisfied
#   - Preconditions: 5/5 verified
#   - Postconditions: 8/8 verified
#   - Invariants: 3/3 maintained
#   - Temporal: 2/2 satisfied
# Trust Score: 96/100
```

---

## Versioning & Compatibility

### Semantic Versioning

All stdlib modules follow [Semantic Versioning](https://semver.org/):

| Change Type | Version Bump | Example |
|-------------|--------------|---------|
| Breaking contract changes | MAJOR | 1.x → 2.0 |
| New behaviors (backward-compatible) | MINOR | 1.0 → 1.1 |
| Bug fixes, docs | PATCH | 1.0.0 → 1.0.1 |

### Compatibility Matrix

| ISL Version | stdlib-auth | stdlib-payments | stdlib-rate-limit | stdlib-audit |
|-------------|-------------|-----------------|-------------------|--------------|
| 1.0.x | 1.0.x | 1.0.x | 1.0.x | 1.0.x |

### Runtime Requirements

| Package | Node.js | TypeScript | Redis (optional) |
|---------|---------|------------|------------------|
| All stdlib | >= 18.0 | >= 5.0 | >= 6.0 |

### Breaking Change Policy

1. Features deprecated in minor version with `@deprecated`
2. Minimum 2 minor versions before removal
3. Migration guide provided for all breaking changes
4. LTS versions supported for 18 months

---

## Complete Example: Secure API Endpoint

```isl
domain MyAPI version "1.0.0"

import { ValidateSession } from "@isl/stdlib-auth/session"
import { CheckRateLimit } from "@isl/stdlib-rate-limit/check"
import { Record as AuditRecord } from "@isl/stdlib-audit/record"

behavior SecureEndpoint {
  description: "Rate-limited, authenticated API endpoint with audit logging"
  
  input {
    session_token: String
    ip_address: String
    request_data: Map<String, Any>
  }
  
  output {
    success: { data: Any }
    errors {
      UNAUTHORIZED { when: "Invalid or expired session" }
      RATE_LIMITED { when: "Too many requests", retriable: true }
    }
  }
  
  flow {
    # Step 1: Rate limit check
    step rate_check: CheckRateLimit(
      key: input.ip_address,
      identifier_type: IP,
      config_name: "api"
    )
    
    when rate_check.action == DENY {
      return error RATE_LIMITED { retry_after: rate_check.retry_after }
    }
    
    # Step 2: Session validation
    step session: ValidateSession(token: input.session_token)
    
    when not session.valid {
      AuditRecord(action: "api.unauthorized", outcome: FAILURE)
      return error UNAUTHORIZED
    }
    
    # Step 3: Process request
    step result: process_request(session.user, input.request_data)
    
    # Step 4: Audit success
    AuditRecord(
      action: "api.request",
      outcome: SUCCESS,
      actor: { id: session.user.id, type: USER }
    )
    
    return success { data: result }
  }
  
  temporal {
    within 100ms (p50): response returned
    within 500ms (p99): response returned
  }
  
  security {
    requires authentication
    rate_limit 100 per minute per ip
    audit_log required
  }
}
```

---

## Next Steps

1. **Install**: `pnpm add @isl-lang/stdlib-auth @isl-lang/stdlib-rate-limit @isl-lang/stdlib-audit`
2. **Import**: Use the import patterns shown above
3. **Verify**: Run `isl verify` to check your implementation
4. **Deploy**: Generated code satisfies all contracts

For detailed package documentation, see individual package READMEs in `packages/stdlib-*`.
