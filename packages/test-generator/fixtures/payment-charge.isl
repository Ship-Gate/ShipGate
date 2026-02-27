// Billing fixture: ChargePayment behavior
domain Billing {
  version: "1.0.0"

  entity Charge {
    id: UUID [immutable]
    amount: Decimal
    currency: String
    status: String
    customer_id: UUID
    created_at: Timestamp [immutable]
  }

  entity Customer {
    id: UUID [immutable]
    balance: Decimal
  }

  behavior ChargePayment {
    description: "Charge a payment to a customer"

    input {
      customer_id: UUID
      amount: Decimal
      currency: String
      description: String
    }

    output {
      success: {
        id: UUID
        amount: Decimal
        currency: String
        status: String
      }

      errors {
        INSUFFICIENT_FUNDS {
          when: "Customer does not have enough balance"
          retriable: false
        }
        INVALID_AMOUNT {
          when: "Amount is not positive"
          retriable: false
        }
        CUSTOMER_NOT_FOUND {
          when: "Customer does not exist"
          retriable: false
        }
      }
    }

    preconditions {
      input.amount > 0
      Customer.exists(id: input.customer_id)
    }

    postconditions {
      success implies {
        Charge.exists(result.id)
        result.amount == input.amount
        result.currency == input.currency
        result.status == "COMPLETED"
        old(Customer.lookup(input.customer_id).balance) - input.amount == Customer.lookup(input.customer_id).balance
      }

      INSUFFICIENT_FUNDS implies {
        Charge.count == old(Charge.count)
      }
    }

    invariants {
      input.customer_id never_appears_in logs
    }

    temporal {
      completes_within 5s
    }
  }
}
