# Payment Processing Domain
# Phase 3 verification spec for chaos and temporal testing

domain PaymentProcessing {
  version: "1.0.0"

  enum TransactionStatus {
    PENDING
    PROCESSING
    COMPLETED
    FAILED
    REFUNDED
  }

  enum PaymentMethod {
    CREDIT_CARD
    DEBIT_CARD
    BANK_TRANSFER
    DIGITAL_WALLET
  }

  entity Account {
    id: UUID [immutable, unique]
    balance: Decimal [indexed]
    currency: String
    is_active: Boolean [indexed]
    created_at: Timestamp [immutable]
  }

  entity Transaction {
    id: UUID [immutable, unique]
    sender_id: UUID [immutable, indexed]
    receiver_id: UUID [immutable, indexed]
    amount: Decimal
    currency: String
    status: TransactionStatus [indexed]
    created_at: Timestamp [immutable]
    completed_at: Timestamp
    payment_method: PaymentMethod
  }

  behavior TransferFunds {
    input {
      sender_id: UUID
      receiver_id: UUID
      amount: Decimal
      currency: String
      payment_method: PaymentMethod
    }

    output {
      success: Transaction
      errors {
        INSUFFICIENT_FUNDS {
          when: "Sender balance is less than amount"
          retriable: false
        }
        SENDER_NOT_FOUND {
          when: "Sender account does not exist"
          retriable: false
        }
        RECEIVER_NOT_FOUND {
          when: "Receiver account does not exist"
          retriable: false
        }
        ACCOUNT_INACTIVE {
          when: "Either account is inactive"
          retriable: true
        }
        INVALID_AMOUNT {
          when: "Amount is zero or negative"
          retriable: false
        }
        CURRENCY_MISMATCH {
          when: "Currency does not match account currency"
          retriable: false
        }
      }
    }

    pre {
      amount > 0
      sender_id != receiver_id
      Account.exists(sender_id)
      Account.exists(receiver_id)
    }

    post success {
      - Transaction.exists(result.id)
      - Transaction.status == COMPLETED
      - Account.lookup(sender_id).balance >= 0
      - Account.lookup(sender_id).balance == old(Account.lookup(sender_id).balance) - amount
      - Account.lookup(receiver_id).balance == old(Account.lookup(receiver_id).balance) + amount
    }

    invariants {
      - amount never_negative
      - total_balance_conserved
    }

    temporal {
      - completes_within 5s
      - eventually status == COMPLETED or status == FAILED
    }
  }

  behavior GetBalance {
    input {
      account_id: UUID
    }

    output {
      success: Decimal
      errors {
        ACCOUNT_NOT_FOUND {
          when: "Account does not exist"
          retriable: false
        }
      }
    }

    pre {
      account_id.is_valid
    }

    post success {
      - result >= 0
    }

    temporal {
      - completes_within 100ms
    }
  }

  behavior RefundTransaction {
    input {
      transaction_id: UUID
    }

    output {
      success: Transaction
      errors {
        TRANSACTION_NOT_FOUND {
          when: "Transaction does not exist"
          retriable: false
        }
        ALREADY_REFUNDED {
          when: "Transaction was already refunded"
          retriable: false
        }
        NOT_REFUNDABLE {
          when: "Transaction is not in a refundable state"
          retriable: false
        }
      }
    }

    pre {
      Transaction.exists(transaction_id)
      Transaction.status == COMPLETED
    }

    post success {
      - Transaction.lookup(transaction_id).status == REFUNDED
      - balances_restored
    }

    temporal {
      - completes_within 10s
    }
  }
}
