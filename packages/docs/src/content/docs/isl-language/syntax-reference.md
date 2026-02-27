---
title: Syntax Reference
description: Complete ISL grammar and syntax reference.
---

This is the complete syntax reference for ISL (Intent Specification Language). ISL uses a declarative, contract-first syntax for specifying software behavior.

## Program structure

An ISL program consists of one `domain` block containing types, entities, behaviors, scenarios, and chaos blocks.

```isl
domain DomainName {
  version: "1.0.0"
  owner: "Team Name"

  // Type declarations
  // Entity declarations
  // Behavior declarations
  // Scenarios
  // Chaos blocks
}
```

## Modules and imports

ISL supports a module system for organizing and reusing specifications.

```isl
// Import a standard library module
use @isl/string
use @isl/math as math

// Import specific items
use { Length, Trim, Contains } from @isl/string

// Module declaration
module MyModule {
  version: "1.0.0"
}
```

## Domain declaration

```isl
domain ServiceName {
  version: "1.0.0"    // Semantic version (required)
  owner: "Team Name"   // Owning team (optional)

  // ... members
}
```

## Type declarations

### Custom types with constraints

```isl
type Email = String {
  pattern: "^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$"
  max_length: 254
}

type Money = Decimal {
  min: 0
  precision: 2
}

type PositiveInt = Int {
  min: 1
}

type NonEmptyList<T> = List<T> {
  min_length: 1
}
```

### Enumerations

```isl
enum Status {
  ACTIVE
  INACTIVE
  DELETED
}
```

## Entity declarations

```isl
entity EntityName {
  field_name: Type [modifier1, modifier2]

  invariants {
    // Conditions that must always hold
  }

  lifecycle {
    STATE_A -> STATE_B
    STATE_B -> STATE_C
  }
}
```

### Field modifiers

| Modifier      | Description                                |
| ------------- | ------------------------------------------ |
| `immutable`   | Cannot be changed after creation           |
| `unique`      | Must be unique across all instances        |
| `indexed`     | Should be queryable/indexed                |
| `sensitive`   | Contains sensitive data (PII, secrets)     |
| `secret`      | Must never be logged or exposed            |
| `optional`    | Field may be absent (equivalent to `T?`)   |
| `required`    | Field must be present (default)            |
| `readonly`    | Can be read but not directly written       |

## Behavior declarations

```isl
behavior BehaviorName {
  description: "What this behavior does"

  actors {
    RoleName { must: permission1, owns: resource }
  }

  input {
    param_name: Type [modifier]
  }

  output {
    success: ReturnType
    errors {
      ERROR_CODE {
        when: "Human-readable condition"
        retriable: true
      }
    }
  }

  preconditions {
    // Must be true before execution
  }

  postconditions {
    success implies { /* ... */ }
    failure implies { /* ... */ }
  }

  invariants {
    // Must remain true throughout
  }

  temporal {
    within 1s (p99): response returned
    eventually: data.replicated
  }

  security {
    rate_limit 100 per actor
  }

  compliance {
    // Regulatory requirements
  }
}
```

## Expressions

### Operators (by precedence, low to high)

| Precedence | Operators               | Description             |
| ---------- | ----------------------- | ----------------------- |
| 1 (lowest) | `or`, `\|\|`            | Logical OR              |
| 2          | `and`, `&&`             | Logical AND             |
| 3          | `implies`, `iff`        | Logical implication     |
| 4          | `==`, `!=`              | Equality                |
| 5          | `<`, `>`, `<=`, `>=`, `in` | Comparison / membership |
| 6          | `+`, `-`                | Addition, subtraction   |
| 7          | `*`, `/`, `%`           | Multiplication, division, modulo |
| 8 (highest)| `not`, `-` (unary)      | Negation                |

### Member access

```isl
entity.field          // Field access
entity.method(arg)    // Method call
list[index]           // Index access
map[key]              // Map access
entity.field.subfield // Chained access
```

### Special expressions

| Expression     | Description                                    |
| -------------- | ---------------------------------------------- |
| `old(expr)`    | Value of expression before behavior executed   |
| `result`       | Return value of the behavior                   |
| `result.field` | Field on the return value                      |
| `input.field`  | Input parameter value                          |
| `now()`        | Current timestamp                              |

### Quantifiers

```isl
// All items satisfy condition
all(item in items: item.valid)

// At least one item satisfies condition
any(item in items: item.active)

// No items satisfy condition
none(item in items: item.deleted)

// Count items satisfying condition
count(item in items: item.enabled) > 3

// Sum values
sum(item in items: item.amount) <= budget

// Filter items
filter(item in items: item.status == ACTIVE)
```

## Scenarios

```isl
scenarios BehaviorName {
  scenario "description" {
    given {
      // Setup: bind variables
      var_name = expression
    }
    when {
      // Action: invoke behavior
      result = BehaviorName(param: value)
    }
    then {
      // Assertions
      result is success
      result.field == expected
    }
  }
}
```

## Chaos blocks

```isl
chaos BehaviorName {
  scenario "failure description" {
    inject fault_type(parameters)
    expect expected_behavior
    retries: count
  }
}
```

### Injection types

| Injection                | Parameters                              |
| ------------------------ | --------------------------------------- |
| `database_failure`       | `target`, `mode` (UNAVAILABLE, TIMEOUT) |
| `network_latency`        | `target`, `delay`                       |
| `network_partition`      | `target`, `duration`                    |
| `service_unavailable`    | `target`, `duration`                    |
| `cpu_pressure`           | `target`, `load`                        |
| `memory_pressure`        | `target`, `usage`                       |
| `clock_skew`             | `target`, `offset`                      |
| `concurrent_requests`    | `count`                                 |

## Temporal constraints

```isl
temporal {
  // Response time SLA
  within 1s (p99): response returned

  // Eventual consistency
  eventually: data.replicated

  // Immediate effect
  immediately: cache.invalidated

  // Ordering
  before: notification.sent
  after: payment.processed

  // Negative constraint
  never: data.corrupted

  // Always true
  always: audit_log.appended
}
```

## Comments

```isl
// Single-line comment

/* Multi-line
   comment */
```

## Reserved keywords

```
domain entity behavior type enum struct
input output preconditions postconditions invariants
temporal security compliance actors errors lifecycle
version description scope module use from as
extends implements import export policy view
intent pre post invariant scenario chaos
given when then inject expect retries with
success failure result this self null true false
implies iff old if else return where for in
eventually within immediately never always before after
all any none count sum filter exists forall
and or not
```
