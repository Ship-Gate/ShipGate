
isl 1.0

domain PaymentsDomain {
  entity Payment {
    id: UUID
    amount: Decimal
    currency: String
    status: String
  }

  behavior ProcessPayment {
    input {
      amount: Decimal
      currency: String
      cardToken: String
    }
    output {
      success: Payment
      error: { code: String, message: String }
    }
    preconditions {
      "Amount must be positive" => input.amount > 0
      "Currency must be valid" => ["USD", "EUR", "GBP"].contains(input.currency)
    }
    postconditions {
      "Payment recorded" => result.success implies payment.exists
    }
    chaos {
      "Database timeout" => inject database_failure for 5s
      "Network latency" => inject network_latency of 2000ms
      "Service unavailable" => inject service_unavailable
    }
  }
}
