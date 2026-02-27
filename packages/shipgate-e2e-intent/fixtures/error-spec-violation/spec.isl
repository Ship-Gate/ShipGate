domain PaymentService {
  version: "1.0.0"

  entity Payment {
    id: UUID [immutable, unique]
    amount: Float
    currency: String
    status: String
  }

  behavior ProcessPayment {
    input {
      amount: Float
      currency: String
      card_token: String
    }

    output {
      success: Payment
      errors {
        INVALID_AMOUNT {
          when: "Amount must be positive"
          retriable: false
        }
        INVALID_CURRENCY {
          when: "Currency code must be 3 characters"
          retriable: false
        }
        CARD_DECLINED {
          when: "Payment card was declined"
          retriable: true
        }
      }
    }

    preconditions {
      - input.amount > 0
      - input.currency.length == 3
    }

    postconditions {
      success implies {
        - result.amount == input.amount
        - result.currency == input.currency
        - result.status == "completed"
      }
    }
  }
}
