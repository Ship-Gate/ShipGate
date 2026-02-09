# Payments + Idempotency — Canonical Sample
# Fund transfers with idempotency keys, refunds, and balance invariants
# Covers: pre/post, invariants, temporal, scenarios

domain PaymentsIdempotency {
  version: "1.0.0"

  enum TransactionStatus {
    PENDING
    COMPLETED
    FAILED
    REFUNDED
  }

  enum Currency {
    USD
    EUR
    GBP
  }

  entity Account {
    id: UUID [immutable, unique]
    owner_id: UUID [indexed]
    balance: Decimal [default: 0]
    currency: Currency
    is_active: Boolean [default: true]
    created_at: Timestamp [immutable]

    invariants {
      balance >= 0
    }
  }

  entity Transaction {
    id: UUID [immutable, unique]
    idempotency_key: String [unique, indexed]
    from_account_id: UUID [indexed]
    to_account_id: UUID [indexed]
    amount: Decimal
    currency: Currency
    status: TransactionStatus [default: PENDING, indexed]
    created_at: Timestamp [immutable]
    completed_at: Timestamp?

    invariants {
      amount > 0
      from_account_id != to_account_id
      status == COMPLETED implies completed_at != null
    }
  }

  behavior TransferFunds {
    description: "Transfer funds between two accounts with idempotency"

    input {
      idempotency_key: String
      from_account_id: UUID
      to_account_id: UUID
      amount: Decimal
      currency: Currency
    }

    output {
      success: Transaction
      errors {
        DUPLICATE_REQUEST {
          when: "Idempotency key already used — returns original result"
          retriable: false
        }
        INSUFFICIENT_FUNDS {
          when: "Sender account balance too low"
          retriable: true
        }
        ACCOUNT_NOT_FOUND {
          when: "Sender or receiver account does not exist"
          retriable: false
        }
        ACCOUNT_INACTIVE {
          when: "One of the accounts is deactivated"
          retriable: false
        }
        CURRENCY_MISMATCH {
          when: "Account currencies do not match transaction currency"
          retriable: false
        }
        SELF_TRANSFER {
          when: "Cannot transfer to the same account"
          retriable: false
        }
      }
    }

    pre {
      amount > 0
      from_account_id != to_account_id
      Account.exists(from_account_id)
      Account.exists(to_account_id)
      Account.lookup(from_account_id).is_active
      Account.lookup(to_account_id).is_active
      Account.lookup(from_account_id).currency == currency
      Account.lookup(to_account_id).currency == currency
      Account.lookup(from_account_id).balance >= amount
    }

    post success {
      - Transaction.exists(result.id)
      - result.idempotency_key == input.idempotency_key
      - result.status == COMPLETED
      - Account.lookup(from_account_id).balance == old(Account.lookup(from_account_id).balance) - amount
      - Account.lookup(to_account_id).balance == old(Account.lookup(to_account_id).balance) + amount
    }

    invariants {
      - total money in system is conserved (sum of all balances unchanged)
      - idempotency_key replay returns same Transaction without re-executing
      - balance never goes negative
    }

    temporal {
      within 2s (p99): response returned
      eventually within 30s: transaction finalized
    }
  }

  behavior RefundTransaction {
    description: "Refund a completed transaction"

    input {
      transaction_id: UUID
      reason: String
    }

    output {
      success: Transaction
      errors {
        TRANSACTION_NOT_FOUND {
          when: "Transaction does not exist"
          retriable: false
        }
        ALREADY_REFUNDED {
          when: "Transaction has already been refunded"
          retriable: false
        }
        NOT_COMPLETED {
          when: "Only completed transactions can be refunded"
          retriable: false
        }
        INSUFFICIENT_FUNDS {
          when: "Receiver account lacks funds to return"
          retriable: true
        }
      }
    }

    pre {
      Transaction.exists(transaction_id)
      Transaction.lookup(transaction_id).status == COMPLETED
    }

    post success {
      - Transaction.lookup(transaction_id).status == REFUNDED
      - Account.lookup(original.to_account_id).balance == old(balance) - original.amount
      - Account.lookup(original.from_account_id).balance == old(balance) + original.amount
    }

    invariants {
      - a transaction can be refunded at most once
      - total money conserved across refund
    }
  }

  behavior GetBalance {
    description: "Get current account balance"

    input {
      account_id: UUID
    }

    output {
      success: {
        balance: Decimal
        currency: Currency
      }
      errors {
        ACCOUNT_NOT_FOUND {
          when: "Account does not exist"
          retriable: false
        }
      }
    }

    pre {
      Account.exists(account_id)
    }

    post success {
      - result.balance == Account.lookup(account_id).balance
      - result.balance >= 0
    }
  }

  scenario "Idempotent transfer" {
    step t1 = TransferFunds({ idempotency_key: "key-1", from_account_id: alice.id, to_account_id: bob.id, amount: 50.00, currency: USD })
    assert t1.success
    assert t1.result.status == COMPLETED

    step t2 = TransferFunds({ idempotency_key: "key-1", from_account_id: alice.id, to_account_id: bob.id, amount: 50.00, currency: USD })
    assert t2.error == DUPLICATE_REQUEST or t2.result.id == t1.result.id

    # Balance should reflect only one deduction
    step bal = GetBalance({ account_id: alice.id })
    assert bal.result.balance == original_alice_balance - 50.00
  }

  scenario "Transfer then refund conserves money" {
    step transfer = TransferFunds({ idempotency_key: "key-2", from_account_id: alice.id, to_account_id: bob.id, amount: 100.00, currency: USD })
    assert transfer.success

    step refund = RefundTransaction({ transaction_id: transfer.result.id, reason: "Customer request" })
    assert refund.success

    step alice_bal = GetBalance({ account_id: alice.id })
    step bob_bal = GetBalance({ account_id: bob.id })
    assert alice_bal.result.balance == original_alice_balance
    assert bob_bal.result.balance == original_bob_balance
  }
}
