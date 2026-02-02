// Payments: Payout to connected accounts
domain PaymentsPayout {
  version: "1.0.0"

  type Money = Decimal { min: 0, precision: 2 }

  enum PayoutStatus {
    PENDING
    IN_TRANSIT
    PAID
    FAILED
    CANCELLED
  }

  enum PayoutType {
    BANK_ACCOUNT
    CARD
    INSTANT
  }

  entity BankAccount {
    id: UUID [immutable, unique]
    account_id: UUID [indexed]
    bank_name: String
    last_four: String
    routing_number_last_four: String
    currency: String
    is_default: Boolean
    verified: Boolean
    created_at: Timestamp [immutable]

    invariants {
      last_four.length == 4
    }
  }

  entity Payout {
    id: UUID [immutable, unique]
    account_id: UUID [indexed]
    bank_account_id: UUID [indexed]
    amount: Decimal
    currency: String
    description: String?
    status: PayoutStatus
    type: PayoutType
    arrival_date: Timestamp?
    failure_code: String?
    failure_message: String?
    created_at: Timestamp [immutable]
    updated_at: Timestamp

    invariants {
      amount > 0
    }

    lifecycle {
      PENDING -> IN_TRANSIT
      IN_TRANSIT -> PAID
      IN_TRANSIT -> FAILED
      PENDING -> CANCELLED
    }
  }

  entity Balance {
    id: UUID [immutable, unique]
    account_id: UUID [unique]
    available: Decimal
    pending: Decimal
    currency: String
    updated_at: Timestamp

    invariants {
      available >= 0
      pending >= 0
    }
  }

  behavior CreatePayout {
    description: "Create a payout to bank account"

    actors {
      Merchant { must: authenticated }
    }

    input {
      amount: Decimal
      currency: String?
      bank_account_id: UUID?
      description: String?
      type: PayoutType?
    }

    output {
      success: Payout

      errors {
        INSUFFICIENT_BALANCE {
          when: "Available balance too low"
          retriable: true
        }
        NO_BANK_ACCOUNT {
          when: "No bank account configured"
          retriable: false
        }
        BANK_ACCOUNT_UNVERIFIED {
          when: "Bank account not verified"
          retriable: false
        }
        PAYOUT_DISABLED {
          when: "Payouts are disabled"
          retriable: false
        }
        AMOUNT_TOO_SMALL {
          when: "Amount below minimum"
          retriable: false
        }
      }
    }

    pre {
      input.amount > 0
      Balance.lookup(actor.account_id).available >= input.amount
    }

    post success {
      - Payout.exists(result.id)
      - result.amount == input.amount
      - result.status == PENDING or result.status == IN_TRANSIT
      - Balance.lookup(actor.account_id).available == old(Balance.lookup(actor.account_id).available) - input.amount
    }

    temporal {
      - within 2s (p99): response returned
      - eventually within 2.days: payout arrives
    }
  }

  behavior CancelPayout {
    description: "Cancel a pending payout"

    actors {
      Merchant { must: authenticated }
    }

    input {
      payout_id: UUID
    }

    output {
      success: Payout

      errors {
        PAYOUT_NOT_FOUND {
          when: "Payout does not exist"
          retriable: false
        }
        NOT_CANCELLABLE {
          when: "Payout cannot be cancelled"
          retriable: false
        }
      }
    }

    pre {
      Payout.exists(input.payout_id)
      Payout.lookup(input.payout_id).status == PENDING
    }

    post success {
      - result.status == CANCELLED
      - Balance.lookup(actor.account_id).available == old(Balance.lookup(actor.account_id).available) + result.amount
    }
  }

  behavior GetPayout {
    description: "Get payout details"

    actors {
      Merchant { must: authenticated }
    }

    input {
      payout_id: UUID
    }

    output {
      success: Payout

      errors {
        PAYOUT_NOT_FOUND {
          when: "Payout does not exist"
          retriable: false
        }
      }
    }
  }

  behavior ListPayouts {
    description: "List payouts"

    actors {
      Merchant { must: authenticated }
    }

    input {
      status: PayoutStatus?
      from: Timestamp?
      to: Timestamp?
      page: Int?
      page_size: Int?
    }

    output {
      success: {
        payouts: List<Payout>
        total_count: Int
        has_more: Boolean
      }
    }
  }

  behavior GetBalance {
    description: "Get account balance"

    actors {
      Merchant { must: authenticated }
    }

    input {
      account_id: UUID?
    }

    output {
      success: Balance
    }
  }

  scenarios CreatePayout {
    scenario "successful payout" {
      given {
        balance = Balance.create(available: 1000.00, pending: 0)
      }

      when {
        result = CreatePayout(amount: 500.00)
      }

      then {
        result is success
        result.amount == 500.00
        Balance.lookup(actor.account_id).available == 500.00
      }
    }

    scenario "insufficient balance" {
      given {
        balance = Balance.create(available: 100.00, pending: 0)
      }

      when {
        result = CreatePayout(amount: 500.00)
      }

      then {
        result is INSUFFICIENT_BALANCE
      }
    }
  }
}
