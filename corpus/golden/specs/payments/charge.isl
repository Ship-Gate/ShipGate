// Payments: Create a charge
domain PaymentsCharge {
  version: "1.0.0"

  type Money = Decimal { min: 0, precision: 2 }

  enum Currency {
    USD
    EUR
    GBP
    CAD
    AUD
  }

  enum ChargeStatus {
    PENDING
    PROCESSING
    SUCCEEDED
    FAILED
    REFUNDED
    DISPUTED
  }

  type CardDetails = {
    number: String
    exp_month: Int
    exp_year: Int
    cvv: String
    cardholder_name: String
  }

  entity Charge {
    id: UUID [immutable, unique]
    merchant_id: UUID [indexed]
    customer_id: UUID? [indexed]
    idempotency_key: String [unique, indexed]
    amount: Decimal
    currency: Currency
    description: String?
    status: ChargeStatus
    card_last_four: String?
    card_brand: String?
    processor_id: String?
    failure_code: String?
    failure_message: String?
    metadata: Map<String, String>
    created_at: Timestamp [immutable]
    updated_at: Timestamp

    invariants {
      amount > 0
      card_last_four == null or card_last_four.length == 4
    }

    lifecycle {
      PENDING -> PROCESSING
      PROCESSING -> SUCCEEDED
      PROCESSING -> FAILED
      SUCCEEDED -> REFUNDED
      SUCCEEDED -> DISPUTED
    }
  }

  behavior CreateCharge {
    description: "Create and process a card charge"

    actors {
      Merchant { must: authenticated }
      System { }
    }

    input {
      amount: Decimal
      currency: Currency
      idempotency_key: String
      card: CardDetails [sensitive]
      description: String?
      customer_id: UUID?
      metadata: Map<String, String>?
    }

    output {
      success: Charge

      errors {
        DUPLICATE_IDEMPOTENCY_KEY {
          when: "Idempotency key already used"
          retriable: false
        }
        CARD_DECLINED {
          when: "Card was declined"
          retriable: true
        }
        INSUFFICIENT_FUNDS {
          when: "Insufficient funds"
          retriable: true
        }
        INVALID_CARD {
          when: "Card number is invalid"
          retriable: false
        }
        EXPIRED_CARD {
          when: "Card has expired"
          retriable: false
        }
        FRAUD_DETECTED {
          when: "Suspected fraud"
          retriable: false
        }
        PROCESSOR_ERROR {
          when: "Payment processor error"
          retriable: true
          retry_after: 5s
        }
      }
    }

    pre {
      input.amount > 0
      input.card.exp_year >= 2024
      input.card.exp_month >= 1 and input.card.exp_month <= 12
      not Charge.exists(idempotency_key: input.idempotency_key)
    }

    post success {
      - Charge.exists(result.id)
      - result.amount == input.amount
      - result.currency == input.currency
      - result.status == SUCCEEDED or result.status == PROCESSING
    }

    post failure {
      - not Charge.exists(id: result.id) or Charge.lookup(result.id).status == FAILED
    }

    invariants {
      - input.card.number never_logged
      - input.card.cvv never_logged
      - PCI-DSS compliance
    }

    temporal {
      - within 5s (p99): response returned
      - eventually within 30s: charge settled
    }

    security {
      - rate_limit 100 per merchant_id
      - fraud_check enabled
    }
  }

  behavior GetCharge {
    description: "Retrieve charge details"

    actors {
      Merchant { must: authenticated }
    }

    input {
      charge_id: UUID
    }

    output {
      success: Charge

      errors {
        CHARGE_NOT_FOUND {
          when: "Charge does not exist"
          retriable: false
        }
        UNAUTHORIZED {
          when: "Not authorized"
          retriable: false
        }
      }
    }

    pre {
      Charge.exists(input.charge_id)
    }
  }

  behavior ListCharges {
    description: "List charges with filtering"

    actors {
      Merchant { must: authenticated }
    }

    input {
      customer_id: UUID?
      status: ChargeStatus?
      from: Timestamp?
      to: Timestamp?
      page: Int?
      page_size: Int?
    }

    output {
      success: {
        charges: List<Charge>
        total_count: Int
        has_more: Boolean
      }
    }

    pre {
      input.page == null or input.page >= 1
      input.page_size == null or (input.page_size >= 1 and input.page_size <= 100)
    }
  }

  scenarios CreateCharge {
    scenario "successful charge" {
      when {
        result = CreateCharge(
          amount: 99.99,
          currency: USD,
          idempotency_key: "charge-123",
          card: {
            number: "4111111111111111",
            exp_month: 12,
            exp_year: 2025,
            cvv: "123",
            cardholder_name: "John Doe"
          }
        )
      }

      then {
        result is success
        result.amount == 99.99
        result.status == SUCCEEDED
      }
    }

    scenario "declined card" {
      when {
        result = CreateCharge(
          amount: 100.00,
          currency: USD,
          idempotency_key: "charge-declined",
          card: {
            number: "4000000000000002",
            exp_month: 12,
            exp_year: 2025,
            cvv: "123",
            cardholder_name: "Declined Card"
          }
        )
      }

      then {
        result is CARD_DECLINED
      }
    }
  }
}
