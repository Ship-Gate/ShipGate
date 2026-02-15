domain EcommercePayment {
  version: "1.0.0"

  type Money = Decimal { min: 0 }

  entity Payment {
    id: UUID [immutable, unique]
    order_id: UUID
    amount: Money
    status: String
  }

  enum PaymentStatus {
    PENDING
    COMPLETED
    FAILED
    REFUNDED
  }

  behavior ProcessPayment {
    input {
      order_id: UUID
      amount: Money
      idempotency_key: String
    }
    output {
      success: Payment
      errors {
        DUPLICATE { when: "Idempotency key reused" retriable: false }
        INSUFFICIENT_FUNDS { when: "Insufficient funds" retriable: true }
      }
    }
    postconditions {
      success implies {
        - Payment.exists(result.id)
        - Payment.lookup(result.id).amount == input.amount
      }
    }
  }
}
