---
title: Types
description: Built-in types, custom types, and the ISL type system.
---

ISL has a rich type system with built-in primitive types, collection types, and the ability to define custom constrained types.

## Primitive types

| Type         | Description                           | Example              |
| ------------ | ------------------------------------- | -------------------- |
| `Boolean`    | True or false                         | `true`, `false`      |
| `Int`        | Arbitrary precision integer           | `42`, `-1`           |
| `Decimal`    | Decimal number with precision         | `99.99`, `0.01`      |
| `String`     | UTF-8 string                          | `"hello"`            |
| `Bytes`      | Raw byte sequence                     | Binary data          |

## Built-in semantic types

These types carry semantic meaning and built-in validation rules:

| Type         | Description                           | Format               |
| ------------ | ------------------------------------- | -------------------- |
| `UUID`       | RFC 4122 UUID                         | `550e8400-e29b-...`  |
| `Email`      | RFC 5322 email address                | `user@example.com`   |
| `URL`        | RFC 3986 URL                          | `https://example.com`|
| `Phone`      | E.164 phone number                    | `+1234567890`        |
| `Timestamp`  | Unix timestamp with nanoseconds       | `1706745600`         |
| `Duration`   | Time duration                         | `1s`, `500ms`, `2h`  |
| `Money`      | Currency amount with precision        | `99.99 USD`          |
| `Percentage` | 0-100 value with precision            | `85.5`               |
| `Regex`      | Regular expression                    | Pattern string       |

## Collection types

| Type             | Description                       | Example                        |
| ---------------- | --------------------------------- | ------------------------------ |
| `List<T>`        | Ordered sequence                  | `List<String>`                 |
| `Map<K, V>`      | Key-value mapping                 | `Map<String, Int>`             |
| `Set<T>`         | Unique unordered elements         | `Set<UUID>`                    |
| `Optional<T>`    | Value that may be absent          | `Optional<Email>` or `Email?`  |
| `Result<T, E>`   | Success or error value            | `Result<User, Error>`          |

## Optional shorthand

Use `?` suffix as shorthand for `Optional<T>`:

```isl
entity User {
  id: UUID
  email: Email
  nickname: String?          // Same as Optional<String>
  avatar_url: URL?           // Same as Optional<URL>
}
```

## Custom type declarations

Define custom types with constraints applied to a base type:

```isl
// String with pattern constraint
type Email = String {
  pattern: "^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$"
  max_length: 254
}

// Decimal with range constraint
type Money = Decimal {
  min: 0
  precision: 2
}

// Integer with minimum
type PositiveInt = Int {
  min: 1
}

// String with length constraint
type Username = String {
  min_length: 3
  max_length: 32
  pattern: "^[a-zA-Z0-9_]+$"
}

// Constrained collection
type NonEmptyList<T> = List<T> {
  min_length: 1
}
```

### Available constraints

**String constraints:**

| Constraint    | Description                |
| ------------- | -------------------------- |
| `min_length`  | Minimum string length      |
| `max_length`  | Maximum string length      |
| `pattern`     | Regular expression pattern |

**Numeric constraints:**

| Constraint    | Description                |
| ------------- | -------------------------- |
| `min`         | Minimum value (inclusive)  |
| `max`         | Maximum value (inclusive)  |
| `precision`   | Decimal precision          |

**Collection constraints:**

| Constraint    | Description                |
| ------------- | -------------------------- |
| `min_length`  | Minimum number of elements |
| `max_length`  | Maximum number of elements |

## Enumeration types

Define a finite set of named values:

```isl
enum PaymentStatus {
  PENDING
  PROCESSING
  COMPLETED
  FAILED
  REFUNDED
}

enum Currency {
  USD
  EUR
  GBP
  JPY
}
```

Use enums in entity fields:

```isl
entity Payment {
  id: UUID [immutable, unique]
  status: PaymentStatus
  currency: Currency
}
```

## Type usage in entities

```isl
entity Order {
  id: UUID [immutable, unique]
  customer_id: UUID [immutable]
  items: List<OrderItem>
  total: Money
  status: OrderStatus
  notes: String?
  metadata: Map<String, String>
  tags: Set<String>
  created_at: Timestamp [immutable]

  invariants {
    total >= 0
    items.length > 0
  }
}
```

## Type usage in behaviors

```isl
behavior CreateOrder {
  input {
    customer_id: UUID
    items: List<OrderItem>    // Collection of items
    coupon_code: String?      // Optional input
  }

  output {
    success: Order
    errors {
      EMPTY_CART { when: "No items provided" }
    }
  }

  preconditions {
    items.length > 0
    all(item in items: item.quantity > 0)
  }

  postconditions {
    success implies {
      result.total == sum(item in items: item.price * item.quantity)
    }
  }
}
```

## Type compatibility

ISL uses structural typing for custom types. A value of type `PositiveInt` is compatible with `Int` because `PositiveInt` is a constrained `Int`. The reverse is not true — an arbitrary `Int` may not satisfy the constraints of `PositiveInt`.
