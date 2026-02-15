domain ScenariosChaos {
  version: "1.0.0"

  entity Payment {
    id: UUID [immutable, unique]
    amount: Decimal
    status: String
  }

  behavior CreatePayment {
    input {
      amount: Decimal
      idempotency_key: String
    }
    output {
      success: Payment
      errors {
        DUPLICATE { when: "Idempotency key reused" retriable: false }
      }
    }
    postconditions {
      success implies {
        - Payment.exists(result.id)
        - Payment.lookup(result.id).amount == input.amount
      }
    }
  }

  scenarios CreatePayment {
    scenario "successful payment" {
      given {
        initial_count = Payment.count
      }
      when {
        result = CreatePayment(amount: 100.00, idempotency_key: "test-1")
      }
      then {
        result != null
        Payment.count == initial_count + 1
      }
    }
    scenario "duplicate idempotency key" {
      given {
        existing = CreatePayment(amount: 50.00, idempotency_key: "dupe-key")
      }
      when {
        result = CreatePayment(amount: 100.00, idempotency_key: "dupe-key")
      }
      then {
        result is DUPLICATE
        Payment.count == old(Payment.count)
      }
    }
  }

  chaos CreatePayment {
    scenario "database failure" {
      inject {
        database_failure(target: PaymentRepository, mode: UNAVAILABLE)
      }
      when {
        result = CreatePayment(amount: 100.00, idempotency_key: "chaos-1")
      }
      then {
        result is error
        Payment.count == old(Payment.count)
      }
    }
  }
}
