domain Payments {
  version: "1.0.0"

  entity Payment {
    id: UUID
    amount: Decimal
    currency: String
    status: String
  }

  behavior CreatePayment {
    input {
      amount: Decimal
      currency: String
    }

    output {
      success: Payment
      errors {
        INVALID_AMOUNT {
          when: "Amount must be greater than 0"
        }
      }
    }

    pre {
      amount > 0
      currency.length == 3
    }

    post success {
      - Payment.exists(result.id)
      - Payment.amount == amount
      - Payment.status == "pending"
    }
  }

  scenarios CreatePayment {
    scenario "successful payment creation" {
      given {
        amount = 100.00
        currency = "USD"
      }
      when {
        result = CreatePayment(amount: amount, currency: currency)
      }
      then {
        result is success
        result.amount == amount
        result.currency == currency
      }
    }

    scenario "invalid amount" {
      given {
        amount = -10.00
        currency = "USD"
      }
      when {
        result = CreatePayment(amount: amount, currency: currency)
      }
      then {
        result is failure
        result.error == INVALID_AMOUNT
      }
    }
  }
}
