---
title: Postconditions
description: Assertion syntax for specifying what must be true after a behavior executes.
---

Postconditions define what must be true after a behavior executes. They are the core of ISL's verification power — they let you express the exact expected outcome of an operation.

## Basic syntax

```isl
postconditions {
  // Simple assertion
  result.status == COMPLETED

  // Branching on outcome
  success implies {
    // Must be true when behavior succeeds
  }
  failure implies {
    // Must be true when behavior fails
  }
}
```

## The `old()` expression

`old(expr)` captures the value of an expression **before** the behavior executed. This is essential for expressing state transitions:

```isl
postconditions {
  success implies {
    // Balance was decremented by the transfer amount
    account.balance == old(account.balance) - amount

    // Counter was incremented
    User.count == old(User.count) + 1

    // Status changed from what it was
    order.status != old(order.status)
  }
}
```

Without `old()`, you can't express "changed from X to Y" — only "is now Y".

### Common patterns with `old()`

```isl
// Incrementing a counter
Entity.count == old(Entity.count) + 1

// Decrementing a value
account.balance == old(account.balance) - amount

// Conservation (total unchanged)
account_a.balance + account_b.balance ==
  old(account_a.balance) + old(account_b.balance)

// State transition
order.status == COMPLETED and old(order.status) == PROCESSING

// Unchanged on failure
failure implies {
  account.balance == old(account.balance)
}
```

## The `result` expression

`result` refers to the return value of the behavior:

```isl
behavior CreateUser {
  output {
    success: User
  }

  postconditions {
    success implies {
      // Result field matches input
      result.email == email
      result.name == name

      // Result has expected state
      result.status == PENDING
      result.id != null

      // Result timestamp is recent
      result.created_at <= now()
    }
  }
}
```

## Success and failure branches

### `success implies`

Assertions that must hold when the behavior completes successfully:

```isl
postconditions {
  success implies {
    // New entity was created
    Order.count == old(Order.count) + 1

    // Result is well-formed
    result.id != null
    result.total > 0

    // Side effects occurred
    notification.sent(customer.email)
  }
}
```

### `failure implies`

Assertions that must hold when the behavior returns an error:

```isl
postconditions {
  failure implies {
    // No state changes
    Order.count == old(Order.count)
    account.balance == old(account.balance)

    // Error is informative
    result.error != null
  }
}
```

### Why both matter

The `failure implies` branch is critical for catching "fake features" — implementations that appear to work but silently corrupt state on error paths:

```isl
behavior TransferMoney {
  postconditions {
    // Without this, a buggy implementation could
    // debit the sender but fail to credit the receiver
    failure implies {
      Account.find(from).balance == old(Account.find(from).balance)
      Account.find(to).balance == old(Account.find(to).balance)
    }
  }
}
```

## Logical operators in postconditions

```isl
postconditions {
  // AND (both must hold)
  result.email == email and result.name == name

  // OR (at least one must hold)
  result.status == ACTIVE or result.status == PENDING

  // NOT
  not result.deleted

  // IMPLIES (if A then B)
  result.premium implies result.features.length > 5

  // IFF (if and only if)
  result.verified iff email_confirmed
}
```

## Quantifiers in postconditions

Use quantifiers to assert over collections:

```isl
postconditions {
  success implies {
    // All items are valid
    all(item in result.items: item.quantity > 0)

    // At least one item is discounted
    any(item in result.items: item.discount > 0)

    // No items are out of stock
    none(item in result.items: item.stock == 0)

    // Correct count
    count(item in result.items: item.status == SHIPPED) == shipped_count

    // Sum matches total
    result.total == sum(item in result.items: item.price * item.quantity)
  }
}
```

## Entity lookup in postconditions

```isl
postconditions {
  success implies {
    // Entity exists after creation
    User.exists(result.id)

    // Entity count changed
    User.count == old(User.count) + 1

    // Entity state matches
    User.find(result.id).status == ACTIVE

    // Lookup by unique field
    User.lookup(email).id == result.id
  }
}
```

## Complex postcondition example

```isl
behavior CheckoutCart {
  input {
    cart_id: UUID
    payment_method: PaymentMethodId
  }

  output {
    success: Order
    errors {
      EMPTY_CART { when: "Cart has no items" }
      PAYMENT_FAILED { when: "Payment could not be processed" }
      STOCK_INSUFFICIENT { when: "Items are out of stock" }
    }
  }

  postconditions {
    success implies {
      // Order created from cart items
      result.items.length == old(Cart.find(cart_id).items.length)

      // Total computed correctly
      result.total == sum(item in result.items: item.price * item.quantity)

      // Inventory decremented for each item
      all(item in result.items:
        Product.find(item.product_id).stock_count ==
          old(Product.find(item.product_id).stock_count) - item.quantity
      )

      // Payment recorded
      result.payment_status == CAPTURED
      result.payment_amount == result.total

      // Cart cleared after checkout
      Cart.find(cart_id).items.length == 0

      // Conservation: money debited equals order total
      result.payment_amount == result.total
    }

    failure implies {
      // Cart unchanged
      Cart.find(cart_id).items.length == old(Cart.find(cart_id).items.length)

      // No inventory changes
      all(item in old(Cart.find(cart_id).items):
        Product.find(item.product_id).stock_count ==
          old(Product.find(item.product_id).stock_count)
      )

      // No payment captured
      not Payment.exists_for(cart_id)
    }
  }
}
```

## Postconditions vs invariants

| Concept          | When checked            | Scope                     |
| ---------------- | ----------------------- | ------------------------- |
| **Postcondition** | After behavior executes | Specific to one behavior |
| **Invariant**     | Always                  | Entity-level or behavior-level |

Invariants on an entity are implicitly part of every behavior's postconditions — if a behavior violates an entity invariant, verification fails.
