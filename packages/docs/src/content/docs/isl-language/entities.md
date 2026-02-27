---
title: Entities
description: Entity declarations, fields, invariants, and lifecycle management in ISL.
---

Entities are the core data structures in ISL. They represent objects with identity, state, and lifecycle. Entities have fields with types and modifiers, invariants that must always hold, and optional lifecycle state machines.

## Basic entity declaration

```isl
entity User {
  id: UUID [immutable, unique]
  email: Email [unique]
  name: String
  created_at: Timestamp [immutable]
}
```

Every entity typically has:
- An `id` field that uniquely identifies the instance
- Fields with types and modifiers
- Invariants that define valid states

## Field modifiers

Modifiers appear in square brackets after the type and constrain how the field can be used:

```isl
entity Product {
  id: UUID [immutable, unique]          // Cannot change, must be unique
  sku: String [unique, indexed]         // Unique and queryable
  name: String [required]               // Must always have a value
  description: String?                  // Optional (shorthand)
  price: Money                          // No modifiers
  secret_key: String [secret]           // Never logged or exposed
  ssn: String [sensitive]               // PII, special handling
  internal_notes: String [internal]     // Not exposed externally
  category: String [indexed]            // Optimized for queries
}
```

| Modifier    | Effect                                             |
| ----------- | -------------------------------------------------- |
| `immutable` | Field value cannot change after entity creation    |
| `unique`    | No two entities can have the same value            |
| `indexed`   | Field should be indexed for efficient queries      |
| `required`  | Field must have a value (default behavior)         |
| `optional`  | Field may be absent (same as `Type?`)              |
| `sensitive` | Contains personally identifiable information       |
| `secret`    | Must never appear in logs, responses, or errors    |
| `readonly`  | Can be read but not written directly               |
| `internal`  | Not exposed in public APIs                         |

Multiple modifiers are comma-separated:

```isl
email: Email [unique, indexed, required]
```

## Invariants

Invariants are conditions that must be true for every valid instance of the entity, at all times:

```isl
entity BankAccount {
  id: UUID [immutable, unique]
  owner_id: UUID [immutable]
  balance: Money
  currency: String
  overdraft_limit: Money
  status: AccountStatus

  invariants {
    // Balance must not exceed overdraft limit
    balance >= -overdraft_limit

    // Currency code must be 3 characters
    currency.length == 3

    // Overdraft limit is non-negative
    overdraft_limit >= 0

    // Active accounts must have an owner
    status == ACTIVE implies owner_id != null
  }
}
```

Invariants are checked:
- After entity creation
- After every state change
- During verification of behaviors that modify the entity

## Lifecycle state machines

The `lifecycle` block defines valid state transitions:

```isl
entity Order {
  id: UUID [immutable, unique]
  status: OrderStatus

  lifecycle {
    CREATED -> CONFIRMED
    CREATED -> CANCELLED
    CONFIRMED -> PROCESSING
    PROCESSING -> SHIPPED
    SHIPPED -> DELIVERED
    CONFIRMED -> CANCELLED
    PROCESSING -> CANCELLED
  }
}

enum OrderStatus {
  CREATED
  CONFIRMED
  PROCESSING
  SHIPPED
  DELIVERED
  CANCELLED
}
```

The lifecycle block ensures:
- Only declared transitions are valid
- You can't skip states (e.g., `CREATED -> SHIPPED` is not allowed unless declared)
- Behaviors that change the status must respect the state machine

## Entity methods

Entities can reference built-in collection methods in preconditions and postconditions:

```isl
// In preconditions or postconditions:
User.exists(email)           // Check if an entity with this email exists
User.find(id)                // Look up entity by ID
User.count                   // Total number of entities
User.lookup(email)           // Find by a unique field
```

## Entity relationships

Entities reference each other through ID fields:

```isl
entity Order {
  id: UUID [immutable, unique]
  customer_id: UUID [immutable]   // References User.id
  items: List<OrderItem>
}

entity OrderItem {
  id: UUID [immutable, unique]
  order_id: UUID [immutable]      // References Order.id
  product_id: UUID [immutable]    // References Product.id
  quantity: Int
  price: Money

  invariants {
    quantity > 0
    price >= 0
  }
}
```

## Full example

```isl
domain Inventory {
  entity Product {
    id: UUID [immutable, unique]
    sku: String [unique, indexed]
    name: String
    description: String?
    price: Money
    stock_count: Int
    status: ProductStatus [indexed]
    created_at: Timestamp [immutable]
    updated_at: Timestamp

    invariants {
      price >= 0
      stock_count >= 0
      name.length > 0
      sku.length > 0
      status == ACTIVE implies stock_count >= 0
    }

    lifecycle {
      DRAFT -> ACTIVE
      ACTIVE -> DISCONTINUED
      ACTIVE -> OUT_OF_STOCK
      OUT_OF_STOCK -> ACTIVE
      DISCONTINUED -> ARCHIVED
    }
  }

  enum ProductStatus {
    DRAFT
    ACTIVE
    OUT_OF_STOCK
    DISCONTINUED
    ARCHIVED
  }
}
```
