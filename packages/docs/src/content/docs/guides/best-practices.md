---
title: Best Practices
description: Writing effective ISL specifications that catch real bugs.
---

Good ISL specs catch fake features, prevent regressions, and serve as living documentation. Here are the patterns that work.

## Spec structure

### Start with the domain model

Define your entities and their invariants first. This establishes the "rules of the world" before specifying behaviors:

```isl
domain OrderService {
  // 1. Types first
  type Money = Decimal { min: 0, precision: 2 }

  // 2. Entities with invariants
  entity Order {
    id: UUID [immutable, unique]
    total: Money
    items: List<OrderItem>
    status: OrderStatus

    invariants {
      total >= 0
      items.length > 0 implies total > 0
    }
  }

  // 3. Then behaviors that operate on those entities
  behavior PlaceOrder { /* ... */ }
}
```

### One domain per file

Keep each domain in its own `.isl` file. Name the file after the domain:

```
specs/
  user-service.isl
  order-service.isl
  payment-service.isl
  notification-service.isl
```

## Postconditions

### Always specify failure postconditions

The most common source of bugs is incorrect failure handling. Always specify what should happen when a behavior fails:

```isl
// BAD: Only specifying success
postconditions {
  success implies {
    Account.balance == old(Account.balance) - amount
  }
}

// GOOD: Also specifying failure
postconditions {
  success implies {
    Account.balance == old(Account.balance) - amount
  }
  failure implies {
    Account.balance == old(Account.balance)
  }
}
```

### Use `old()` for state transitions

Express changes relative to previous state, not absolute values:

```isl
// BAD: Absolute value (fragile, tied to test data)
postconditions {
  success implies {
    User.count == 5
  }
}

// GOOD: Relative change (works regardless of starting state)
postconditions {
  success implies {
    User.count == old(User.count) + 1
  }
}
```

### Conservation invariants

For systems that move resources (money, inventory, tokens), express conservation:

```isl
postconditions {
  success implies {
    // Money is conserved — total in system unchanged
    Account.find(from).balance + Account.find(to).balance ==
      old(Account.find(from).balance) + old(Account.find(to).balance)
  }
}
```

## Preconditions

### Be explicit about validation

Don't assume inputs are valid. State validation requirements explicitly:

```isl
preconditions {
  // Input validation
  email.is_valid
  name.length > 0
  amount > 0

  // State validation
  Account.find(from).status == ACTIVE
  Account.find(from).balance >= amount
}
```

### Avoid overly permissive preconditions

If a behavior has no preconditions, any input is valid — which is rarely correct:

```isl
// BAD: No preconditions = anything goes
behavior TransferMoney {
  input { from: UUID, to: UUID, amount: Money }
  preconditions { }
}

// GOOD: Explicit requirements
behavior TransferMoney {
  input { from: UUID, to: UUID, amount: Money }
  preconditions {
    amount > 0
    from != to
    Account.find(from).status == ACTIVE
  }
}
```

## Error cases

### Define all expected errors

Enumerate every error case with a clear `when` description:

```isl
output {
  success: Order
  errors {
    INSUFFICIENT_STOCK {
      when: "Requested quantity exceeds available stock"
      retriable: true
    }
    PAYMENT_DECLINED {
      when: "Payment processor declined the charge"
      retriable: true
    }
    INVALID_ADDRESS {
      when: "Shipping address could not be verified"
      retriable: false
    }
  }
}
```

### Mark retriability

Indicate whether callers should retry on each error:

- **`retriable: true`** — transient failures (network, temporary unavailability)
- **`retriable: false`** — permanent failures (invalid input, business rule violation)

## Scenarios

### Cover the critical paths

At minimum, write scenarios for:
1. The happy path (normal success)
2. Each error case
3. Edge cases (boundary values, empty inputs)

```isl
scenarios CreateUser {
  scenario "successful creation" { /* happy path */ }
  scenario "duplicate email" { /* error case */ }
  scenario "empty name rejected" { /* edge case */ }
  scenario "email without @ rejected" { /* validation edge case */ }
}
```

### Use realistic values

Avoid synthetic test data. Use values that look like production data:

```isl
// BAD
when {
  result = CreateUser(email: "test", name: "x")
}

// GOOD
when {
  result = CreateUser(
    email: "alice.johnson@company.com",
    name: "Alice Johnson"
  )
}
```

## Security

### Always specify actors

If a behavior requires authentication, declare it:

```isl
behavior DeleteUser {
  actors {
    Admin { must: authenticated }
  }
}
```

### Add rate limits to public endpoints

```isl
security {
  rate_limit 100 per actor
  rate_limit 5000 per minute   // Global limit
}
```

### Mark sensitive fields

```isl
entity User {
  password_hash: String [secret]     // Never logged
  ssn: String [sensitive]            // PII
  email: Email [sensitive]           // PII
}

behavior Login {
  input {
    password: String [sensitive]     // Sensitive parameter
  }

  invariants {
    password never_logged            // Enforce at behavior level
  }
}
```

## Chaos testing

### Test idempotency

Any behavior that creates resources should be tested for duplicate handling:

```isl
chaos CreatePayment {
  scenario "concurrent duplicates" {
    inject concurrent_requests(count: 10)
    with { idempotency_key: "dup-test" }
    expect { exactly_one_created }
    retries: 0
  }
}
```

### Test failure recovery

```isl
chaos PlaceOrder {
  scenario "database failure" {
    inject database_failure(target: "OrderDB", mode: UNAVAILABLE)
    expect error_returned(SERVICE_UNAVAILABLE)
    retries: 3
    expect successful_retry_after_recovery
  }
}
```

## Naming conventions

| Element    | Convention                        | Example                  |
| ---------- | --------------------------------- | ------------------------ |
| Domain     | PascalCase + "Service"            | `PaymentService`         |
| Entity     | PascalCase, singular noun         | `User`, `Order`          |
| Behavior   | PascalCase, verb + noun           | `CreateUser`, `SendMoney`|
| Enum       | PascalCase                        | `OrderStatus`            |
| Enum values| SCREAMING_SNAKE_CASE              | `PENDING`, `COMPLETED`   |
| Fields     | snake_case                        | `created_at`, `user_id`  |
| Error codes| SCREAMING_SNAKE_CASE              | `INSUFFICIENT_FUNDS`     |

## Verification checklist

Before shipping a spec, verify:

- [ ] All behaviors have preconditions
- [ ] All behaviors have success AND failure postconditions
- [ ] All behaviors define error cases
- [ ] Entities have invariants
- [ ] Sensitive fields are marked `[sensitive]` or `[secret]`
- [ ] Rate limits are set on public behaviors
- [ ] Scenarios cover happy path and each error case
- [ ] Spec quality score is above team threshold (`shipgate spec-quality`)
