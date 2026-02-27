---
title: Behaviors
description: Behavior contracts — inputs, outputs, preconditions, postconditions, and more.
---

Behaviors are the core of ISL specifications. They describe operations that your system performs, with explicit contracts defining what must be true before, during, and after execution.

## Basic structure

```isl
behavior BehaviorName {
  description: "What this behavior does"

  input { /* parameters */ }
  output { /* return type and errors */ }
  preconditions { /* must be true before */ }
  postconditions { /* must be true after */ }
}
```

## Inputs

The `input` block declares the parameters the behavior accepts:

```isl
behavior CreateUser {
  input {
    email: Email
    name: String
    password: String [sensitive]
    role: UserRole?              // Optional parameter
  }
}
```

Inputs can have modifiers:
- **`[sensitive]`** — parameter contains sensitive data, must not be logged
- **`[secret]`** — parameter contains secrets
- **`[unique]`** — value must be unique (e.g., idempotency keys)

## Outputs

The `output` block declares the success return type and possible error cases:

```isl
behavior CreateUser {
  output {
    success: User

    errors {
      DUPLICATE_EMAIL {
        when: "A user with this email already exists"
        retriable: false
      }
      INVALID_INPUT {
        when: "Email format is invalid or name is empty"
        retriable: false
      }
      SERVICE_UNAVAILABLE {
        when: "Database is temporarily unavailable"
        retriable: true
      }
    }
  }
}
```

Each error case has:
- A **name** (e.g., `DUPLICATE_EMAIL`) — used in postconditions and scenarios
- A **`when`** description — human-readable condition
- An optional **`retriable`** flag — whether the caller should retry

## Preconditions

Preconditions are assertions that must be true before the behavior executes. If any precondition fails, the behavior should not execute.

```isl
behavior TransferMoney {
  input {
    from: UUID
    to: UUID
    amount: Money
  }

  preconditions {
    // Input validation
    amount > 0
    from != to

    // State validation
    Account.find(from).status == ACTIVE
    Account.find(to).status == ACTIVE
    Account.find(from).balance >= amount
  }
}
```

Preconditions can use:
- Input parameters directly
- Entity lookups (`Entity.find()`, `Entity.exists()`)
- Logical operators (`and`, `or`, `not`, `implies`)
- Comparison operators (`==`, `!=`, `<`, `>`, `<=`, `>=`)
- Quantifiers (`all`, `any`, `none`)

## Postconditions

Postconditions are assertions that must be true after the behavior executes. They can branch on success or failure:

```isl
behavior TransferMoney {
  postconditions {
    success implies {
      // Sender is debited
      Account.find(from).balance ==
        old(Account.find(from).balance) - amount

      // Receiver is credited
      Account.find(to).balance ==
        old(Account.find(to).balance) + amount

      // Transfer record exists
      result.status == COMPLETED
      result.amount == amount
    }

    failure implies {
      // No state changes on failure
      Account.find(from).balance == old(Account.find(from).balance)
      Account.find(to).balance == old(Account.find(to).balance)
    }
  }
}
```

See [Postconditions](/isl-language/postconditions/) for the full assertion syntax.

## Invariants

Behavior-level invariants must hold throughout the behavior's execution:

```isl
behavior ProcessPayment {
  invariants {
    // Passwords must never be logged
    password never_logged

    // Total money in system is conserved
    Account.find(from).balance + Account.find(to).balance ==
      old(Account.find(from).balance) + old(Account.find(to).balance)
  }
}
```

## Actors

The `actors` block specifies who can invoke the behavior and what permissions they need:

```isl
behavior DeleteUser {
  actors {
    Admin { must: authenticated }
  }
}

behavior UpdateProfile {
  actors {
    User { must: authenticated, owns: user_id }
  }
}

behavior ViewPublicProfile {
  actors {
    // No actor constraints — public access
  }
}
```

Actor constraints:
- **`must: authenticated`** — caller must be authenticated
- **`owns: field`** — caller must own the referenced resource
- Multiple roles can be listed to allow different access levels

## Temporal constraints

The `temporal` block specifies timing and ordering requirements:

```isl
behavior CreateOrder {
  temporal {
    // Latency SLA
    within 500ms (p99): response returned
    within 2s (p99): order.confirmed

    // Eventual consistency
    eventually: inventory.decremented

    // Ordering
    before: notification.sent
    after: payment.authorized

    // Immediate effects
    immediately: audit_log.appended

    // Negative constraints
    never: data.corrupted
  }
}
```

| Keyword         | Meaning                                    |
| --------------- | ------------------------------------------ |
| `within D`      | Must happen within duration D              |
| `eventually`    | Must happen at some point                  |
| `immediately`   | Must happen without delay                  |
| `always`        | Must hold in all states                    |
| `never`         | Must never happen                          |
| `before`        | Must happen before another event           |
| `after`         | Must happen after another event            |

## Security constraints

The `security` block specifies rate limiting and access control:

```isl
behavior Login {
  security {
    rate_limit 5 per actor           // Max 5 attempts per user
    rate_limit 1000 per minute       // Global rate limit
  }
}

behavior AdminAction {
  security {
    rate_limit 100 per actor
  }
}
```

## Complete example

```isl
behavior PlaceOrder {
  description: "Place a new order for a customer"

  actors {
    Customer { must: authenticated }
  }

  input {
    items: List<OrderItem>
    shipping_address: Address
    payment_method: PaymentMethodId
    coupon_code: String?
  }

  output {
    success: Order
    errors {
      EMPTY_CART { when: "No items in order" }
      OUT_OF_STOCK { when: "One or more items are out of stock" }
      INVALID_PAYMENT { when: "Payment method is invalid" }
      ADDRESS_INVALID { when: "Shipping address cannot be verified" }
    }
  }

  preconditions {
    items.length > 0
    all(item in items: item.quantity > 0)
    all(item in items: Product.find(item.product_id).stock_count >= item.quantity)
    PaymentMethod.find(payment_method).is_valid
  }

  postconditions {
    success implies {
      // Order created
      Order.count == old(Order.count) + 1
      result.status == CREATED
      result.items.length == items.length

      // Inventory decremented
      all(item in items:
        Product.find(item.product_id).stock_count ==
          old(Product.find(item.product_id).stock_count) - item.quantity
      )

      // Total calculated correctly
      result.total == sum(item in items: item.price * item.quantity)
    }

    failure implies {
      Order.count == old(Order.count)
      all(item in items:
        Product.find(item.product_id).stock_count ==
          old(Product.find(item.product_id).stock_count)
      )
    }
  }

  temporal {
    within 1s (p99): response returned
    eventually: confirmation_email.sent
  }

  security {
    rate_limit 10 per actor
  }
}
```
