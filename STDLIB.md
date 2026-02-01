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
