---
title: Your First Spec
description: Learn ISL by writing a real specification for a money transfer system.
---

This tutorial walks through writing a complete ISL specification for a money transfer service. You'll learn domains, entities, behaviors, preconditions, postconditions, invariants, and scenarios.

## The problem

You're building a money transfer system. Users can send money to other users. The system must ensure:

- Transfers are atomic (no partial transfers)
- Balances never go negative
- The total money in the system is conserved
- Concurrent transfers don't corrupt balances

## Step 1: Define the domain

Every ISL specification starts with a `domain` block. This is the top-level container for all your types, entities, and behaviors.

```isl
domain TransferService {
  version: "1.0.0"
  owner: "Payments Team"
}
```

## Step 2: Define entities

Entities are the core data structures with identity and lifecycle. Each entity has fields with type annotations and optional modifiers.

```isl
domain TransferService {
  version: "1.0.0"

  entity Account {
    id: UUID [immutable, unique]
    owner_id: UUID [immutable]
    balance: Money
    currency: String
    status: AccountStatus [indexed]
    created_at: Timestamp [immutable]

    invariants {
      balance >= 0
      currency.length == 3
    }
  }

  entity Transfer {
    id: UUID [immutable, unique]
    from_account: UUID [immutable]
    to_account: UUID [immutable]
    amount: Money [immutable]
    status: TransferStatus
    created_at: Timestamp [immutable]

    invariants {
      amount > 0
      from_account != to_account
    }
  }

  enum AccountStatus {
    ACTIVE
    FROZEN
    CLOSED
  }

  enum TransferStatus {
    PENDING
    COMPLETED
    FAILED
    REVERSED
  }
}
```

**Key concepts:**

- **`[immutable]`** — field cannot change after creation
- **`[unique]`** — field values must be unique across all instances
- **`[indexed]`** — field should be queryable
- **`invariants`** — conditions that must always be true for every instance

## Step 3: Define behaviors

Behaviors describe operations with explicit inputs, outputs, preconditions, and postconditions.

```isl
behavior SendMoney {
  description: "Transfer money between two accounts"

  actors {
    User { must: authenticated, owns: from_account }
  }

  input {
    from_account: UUID
    to_account: UUID
    amount: Money
    idempotency_key: String [unique]
  }

  output {
    success: Transfer
    errors {
      INSUFFICIENT_FUNDS {
        when: "Sender balance is less than transfer amount"
        retriable: false
      }
      ACCOUNT_FROZEN {
        when: "Either account is frozen"
        retriable: false
      }
      SAME_ACCOUNT {
        when: "Source and destination are the same"
        retriable: false
      }
    }
  }

  preconditions {
    amount > 0
    from_account != to_account
    Account.find(from_account).status == ACTIVE
    Account.find(to_account).status == ACTIVE
    Account.find(from_account).balance >= amount
  }

  postconditions {
    success implies {
      // Sender debited
      Account.find(from_account).balance ==
        old(Account.find(from_account).balance) - amount

      // Receiver credited
      Account.find(to_account).balance ==
        old(Account.find(to_account).balance) + amount

      // Conservation of money
      Account.find(from_account).balance + Account.find(to_account).balance ==
        old(Account.find(from_account).balance) + old(Account.find(to_account).balance)

      // Transfer record created
      result.status == COMPLETED
      result.amount == amount
    }

    failure implies {
      // No balance changes on failure
      Account.find(from_account).balance == old(Account.find(from_account).balance)
      Account.find(to_account).balance == old(Account.find(to_account).balance)
    }
  }

  temporal {
    within 2s (p99): response returned
  }

  security {
    rate_limit 100 per actor
  }
}
```

**Key concepts:**

- **`actors`** — who can invoke this behavior and what permissions they need
- **`preconditions`** — conditions that must be true before execution
- **`postconditions`** — conditions that must be true after execution
- **`old(expr)`** — refers to the value before the behavior executed
- **`result`** — refers to the return value
- **`success implies`** / **`failure implies`** — branch postconditions on outcome
- **`temporal`** — latency and ordering requirements
- **`security`** — rate limiting and access control

## Step 4: Add scenarios

Scenarios are concrete test cases in `given/when/then` format:

```isl
scenarios SendMoney {
  scenario "successful transfer" {
    given {
      sender_balance = Account.find(from_account).balance
      receiver_balance = Account.find(to_account).balance
    }
    when {
      result = SendMoney(
        from_account: "acc-1",
        to_account: "acc-2",
        amount: 50.00,
        idempotency_key: "tx-001"
      )
    }
    then {
      result is success
      result.amount == 50.00
      Account.find("acc-1").balance == sender_balance - 50.00
      Account.find("acc-2").balance == receiver_balance + 50.00
    }
  }

  scenario "insufficient funds" {
    given {
      Account.find("acc-1").balance == 10.00
    }
    when {
      result = SendMoney(
        from_account: "acc-1",
        to_account: "acc-2",
        amount: 100.00,
        idempotency_key: "tx-002"
      )
    }
    then {
      result is failure
      result.error == INSUFFICIENT_FUNDS
      Account.find("acc-1").balance == 10.00
    }
  }
}
```

## Step 5: Add chaos testing

Chaos blocks define how the system should behave under failure conditions:

```isl
chaos SendMoney {
  scenario "concurrent duplicate requests" {
    inject {
      concurrent_requests(count: 10)
    }
    with {
      idempotency_key: "dup-test"
    }
    expect {
      exactly_one_created
      all_return_same_result
    }
    retries: 0
  }

  scenario "database failure during transfer" {
    inject database_failure(target: "AccountRepository", mode: UNAVAILABLE)
    expect error_returned(SERVICE_UNAVAILABLE)
    retries: 3
    expect successful_retry_after_recovery
  }
}
```

## Step 6: Verify

Run the full verification pipeline:

```bash
# Parse and type-check
shipgate check transfer-service.isl

# Generate TypeScript
shipgate gen typescript transfer-service.isl -o ./src/generated

# Verify against implementation
shipgate verify transfer-service.isl --impl ./src/transfer-service.ts

# Run the full build pipeline
shipgate build transfer-service.isl
```

## Complete specification

Here's the full spec for reference. Save it as `transfer-service.isl`:

```isl
domain TransferService {
  version: "1.0.0"
  owner: "Payments Team"

  entity Account {
    id: UUID [immutable, unique]
    owner_id: UUID [immutable]
    balance: Money
    currency: String
    status: AccountStatus [indexed]
    created_at: Timestamp [immutable]

    invariants {
      balance >= 0
      currency.length == 3
    }
  }

  entity Transfer {
    id: UUID [immutable, unique]
    from_account: UUID [immutable]
    to_account: UUID [immutable]
    amount: Money [immutable]
    status: TransferStatus
    created_at: Timestamp [immutable]

    invariants {
      amount > 0
      from_account != to_account
    }
  }

  enum AccountStatus { ACTIVE, FROZEN, CLOSED }
  enum TransferStatus { PENDING, COMPLETED, FAILED, REVERSED }

  behavior SendMoney {
    description: "Transfer money between two accounts"

    actors {
      User { must: authenticated, owns: from_account }
    }

    input {
      from_account: UUID
      to_account: UUID
      amount: Money
      idempotency_key: String [unique]
    }

    output {
      success: Transfer
      errors {
        INSUFFICIENT_FUNDS { when: "Sender balance < transfer amount" }
        ACCOUNT_FROZEN { when: "Either account is frozen" }
        SAME_ACCOUNT { when: "Source and destination are the same" }
      }
    }

    preconditions {
      amount > 0
      from_account != to_account
      Account.find(from_account).status == ACTIVE
      Account.find(to_account).status == ACTIVE
      Account.find(from_account).balance >= amount
    }

    postconditions {
      success implies {
        Account.find(from_account).balance ==
          old(Account.find(from_account).balance) - amount
        Account.find(to_account).balance ==
          old(Account.find(to_account).balance) + amount
        result.status == COMPLETED
      }
      failure implies {
        Account.find(from_account).balance ==
          old(Account.find(from_account).balance)
        Account.find(to_account).balance ==
          old(Account.find(to_account).balance)
      }
    }

    temporal {
      within 2s (p99): response returned
    }

    security {
      rate_limit 100 per actor
    }
  }

  scenarios SendMoney {
    scenario "successful transfer" {
      given { sender_balance = Account.find("acc-1").balance }
      when {
        result = SendMoney(
          from_account: "acc-1", to_account: "acc-2",
          amount: 50.00, idempotency_key: "tx-001"
        )
      }
      then {
        result is success
        result.amount == 50.00
      }
    }
  }

  chaos SendMoney {
    scenario "concurrent duplicates" {
      inject concurrent_requests(count: 10)
      with { idempotency_key: "dup-test" }
      expect { exactly_one_created }
      retries: 0
    }
  }
}
```

## What's next?

- [Syntax Reference](/isl-language/syntax-reference/) — full language grammar
- [Behaviors](/isl-language/behaviors/) — deep dive into behavior contracts
- [Postconditions](/isl-language/postconditions/) — assertion syntax reference
- [Best Practices](/guides/best-practices/) — writing effective specs
