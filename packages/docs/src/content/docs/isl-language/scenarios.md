---
title: Scenarios
description: Test scenarios with given/when/then syntax for concrete verification cases.
---

Scenarios are concrete test cases for behaviors, written in a `given/when/then` format. They provide example-based verification alongside the property-based verification of preconditions and postconditions.

## Basic syntax

```isl
scenarios BehaviorName {
  scenario "description of the test case" {
    given {
      // Setup: bind variables, establish state
    }
    when {
      // Action: invoke the behavior
    }
    then {
      // Assertions: check the result
    }
  }
}
```

## Given block

The `given` block sets up the test state. Use it to bind variables and establish preconditions:

```isl
scenarios CreateUser {
  scenario "successful user creation" {
    given {
      initial_count = User.count
      email = "alice@example.com"
      name = "Alice Johnson"
    }
    when {
      result = CreateUser(email: email, name: name)
    }
    then {
      result is success
      User.count == initial_count + 1
    }
  }
}
```

## When block

The `when` block invokes the behavior being tested. The result is captured in a variable:

```isl
when {
  result = SendMoney(
    from_account: "acc-001",
    to_account: "acc-002",
    amount: 100.00,
    idempotency_key: "tx-unique-001"
  )
}
```

## Then block

The `then` block contains assertions about the outcome:

```isl
then {
  // Check outcome type
  result is success

  // Check result fields
  result.amount == 100.00
  result.status == COMPLETED

  // Check state changes
  Account.find("acc-001").balance == sender_balance - 100.00
  Account.find("acc-002").balance == receiver_balance + 100.00
}
```

### Outcome assertions

```isl
// Behavior succeeded
result is success

// Behavior failed
result is failure

// Specific error
result.error == INSUFFICIENT_FUNDS
```

## Testing error cases

Scenarios should cover both success and failure paths:

```isl
scenarios SendMoney {
  scenario "successful transfer" {
    given {
      sender_balance = Account.find("acc-001").balance
    }
    when {
      result = SendMoney(
        from_account: "acc-001",
        to_account: "acc-002",
        amount: 50.00,
        idempotency_key: "tx-success"
      )
    }
    then {
      result is success
      result.amount == 50.00
    }
  }

  scenario "insufficient funds" {
    given {
      Account.find("acc-001").balance == 10.00
    }
    when {
      result = SendMoney(
        from_account: "acc-001",
        to_account: "acc-002",
        amount: 100.00,
        idempotency_key: "tx-fail"
      )
    }
    then {
      result is failure
      result.error == INSUFFICIENT_FUNDS
      // Balance unchanged
      Account.find("acc-001").balance == 10.00
    }
  }

  scenario "same account transfer rejected" {
    when {
      result = SendMoney(
        from_account: "acc-001",
        to_account: "acc-001",
        amount: 50.00,
        idempotency_key: "tx-same"
      )
    }
    then {
      result is failure
      result.error == SAME_ACCOUNT
    }
  }

  scenario "frozen account rejected" {
    given {
      Account.find("acc-001").status == FROZEN
    }
    when {
      result = SendMoney(
        from_account: "acc-001",
        to_account: "acc-002",
        amount: 50.00,
        idempotency_key: "tx-frozen"
      )
    }
    then {
      result is failure
      result.error == ACCOUNT_FROZEN
    }
  }
}
```

## Multiple scenarios for one behavior

Group related test cases under one `scenarios` block:

```isl
scenarios Login {
  scenario "successful login with valid credentials" {
    given {
      User.find("user-1").status == ACTIVE
    }
    when {
      result = Login(email: "user@test.com", password: "valid-pass")
    }
    then {
      result is success
      result.session_id != null
      result.expires_at > now()
    }
  }

  scenario "login with wrong password" {
    when {
      result = Login(email: "user@test.com", password: "wrong-pass")
    }
    then {
      result is failure
      result.error == INVALID_CREDENTIALS
    }
  }

  scenario "login to locked account" {
    given {
      User.find("user-2").status == LOCKED
    }
    when {
      result = Login(email: "locked@test.com", password: "valid-pass")
    }
    then {
      result is failure
      result.error == ACCOUNT_LOCKED
    }
  }
}
```

## Scenarios and verification

When you run `shipgate verify`, scenarios are used alongside preconditions and postconditions:

1. **Preconditions/postconditions** — verify properties hold for all valid inputs (property-based)
2. **Scenarios** — verify specific concrete examples work correctly (example-based)

Both are valuable:
- Postconditions catch general violations
- Scenarios catch specific edge cases and serve as documentation

```bash
$ shipgate verify user-service.isl --impl ./src/user-service.ts

CreateUser:
  Properties:
    ✓ Precondition: email.is_valid
    ✓ Postcondition: User.count == old(User.count) + 1
  Scenarios:
    ✓ "successful user creation"
    ✓ "duplicate email rejected"
    ✓ "invalid email rejected"

Verdict: SHIP ✓  Trust Score: 100/100
```

## Scenarios with property-based testing

Combine scenarios with the `--pbt` flag for comprehensive verification:

```bash
# Run scenarios + property-based testing
shipgate verify spec.isl --impl ./src/impl.ts --pbt --pbt-tests 200
```

This runs your concrete scenarios AND generates random test cases from the preconditions/postconditions to find edge cases you didn't think of.
