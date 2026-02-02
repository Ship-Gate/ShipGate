// Payments: Process refunds
domain PaymentsRefund {
  version: "1.0.0"

  type Money = Decimal { min: 0, precision: 2 }

  enum RefundStatus {
    PENDING
    PROCESSING
    SUCCEEDED
    FAILED
    CANCELLED
  }

  enum RefundReason {
    REQUESTED_BY_CUSTOMER
    DUPLICATE
    FRAUDULENT
    ORDER_CANCELLED
    PRODUCT_NOT_RECEIVED
    PRODUCT_UNACCEPTABLE
    OTHER
  }

  entity Charge {
    id: UUID [immutable, unique]
    amount: Decimal
    refunded_amount: Decimal [default: 0]
    merchant_id: UUID [indexed]
    created_at: Timestamp [immutable]

    invariants {
      refunded_amount >= 0
      refunded_amount <= amount
    }
  }

  entity Refund {
    id: UUID [immutable, unique]
    charge_id: UUID [indexed]
    idempotency_key: String [unique, indexed]
    amount: Decimal
    reason: RefundReason?
    description: String?
    status: RefundStatus
    processor_id: String?
    failure_code: String?
    failure_message: String?
    created_at: Timestamp [immutable]
    updated_at: Timestamp

    invariants {
      amount > 0
    }

    lifecycle {
      PENDING -> PROCESSING
      PROCESSING -> SUCCEEDED
      PROCESSING -> FAILED
      PENDING -> CANCELLED
    }
  }

  behavior CreateRefund {
    description: "Refund a charge"

    actors {
      Merchant { must: authenticated }
      Admin { must: authenticated }
    }

    input {
      charge_id: UUID
      idempotency_key: String
      amount: Decimal?
      reason: RefundReason?
      description: String?
    }

    output {
      success: Refund

      errors {
        CHARGE_NOT_FOUND {
          when: "Charge does not exist"
          retriable: false
        }
        CHARGE_NOT_REFUNDABLE {
          when: "Charge cannot be refunded"
          retriable: false
        }
        REFUND_EXCEEDS_AMOUNT {
          when: "Refund amount exceeds charge"
          retriable: false
        }
        DUPLICATE_IDEMPOTENCY_KEY {
          when: "Idempotency key already used"
          retriable: false
        }
        PROCESSOR_ERROR {
          when: "Processor error"
          retriable: true
          retry_after: 5s
        }
      }
    }

    pre {
      Charge.exists(input.charge_id)
      input.amount == null or input.amount > 0
      input.amount == null or input.amount <= (Charge.lookup(input.charge_id).amount - Charge.lookup(input.charge_id).refunded_amount)
    }

    post success {
      - Refund.exists(result.id)
      - result.charge_id == input.charge_id
      - result.status == SUCCEEDED or result.status == PROCESSING
      - Charge.lookup(input.charge_id).refunded_amount >= old(Charge.lookup(input.charge_id).refunded_amount)
    }

    temporal {
      - within 10s (p99): response returned
      - eventually within 5m: refund processed
    }
  }

  behavior GetRefund {
    description: "Get refund details"

    actors {
      Merchant { must: authenticated }
    }

    input {
      refund_id: UUID
    }

    output {
      success: Refund

      errors {
        REFUND_NOT_FOUND {
          when: "Refund does not exist"
          retriable: false
        }
        UNAUTHORIZED {
          when: "Not authorized"
          retriable: false
        }
      }
    }

    pre {
      Refund.exists(input.refund_id)
    }
  }

  behavior ListRefunds {
    description: "List refunds for a charge"

    actors {
      Merchant { must: authenticated }
    }

    input {
      charge_id: UUID?
      status: RefundStatus?
      from: Timestamp?
      to: Timestamp?
      page: Int?
      page_size: Int?
    }

    output {
      success: {
        refunds: List<Refund>
        total_count: Int
        has_more: Boolean
      }
    }
  }

  behavior CancelRefund {
    description: "Cancel a pending refund"

    actors {
      Merchant { must: authenticated }
    }

    input {
      refund_id: UUID
    }

    output {
      success: Refund

      errors {
        REFUND_NOT_FOUND {
          when: "Refund does not exist"
          retriable: false
        }
        REFUND_NOT_CANCELLABLE {
          when: "Refund is not in pending state"
          retriable: false
        }
      }
    }

    pre {
      Refund.exists(input.refund_id)
      Refund.lookup(input.refund_id).status == PENDING
    }

    post success {
      - result.status == CANCELLED
    }
  }

  scenarios CreateRefund {
    scenario "full refund" {
      given {
        charge = Charge.create(amount: 100.00, refunded_amount: 0)
      }

      when {
        result = CreateRefund(
          charge_id: charge.id,
          idempotency_key: "refund-full"
        )
      }

      then {
        result is success
        result.amount == 100.00
      }
    }

    scenario "partial refund" {
      given {
        charge = Charge.create(amount: 100.00, refunded_amount: 0)
      }

      when {
        result = CreateRefund(
          charge_id: charge.id,
          idempotency_key: "refund-partial",
          amount: 25.00
        )
      }

      then {
        result is success
        result.amount == 25.00
      }
    }

    scenario "exceeds remaining amount" {
      given {
        charge = Charge.create(amount: 100.00, refunded_amount: 80.00)
      }

      when {
        result = CreateRefund(
          charge_id: charge.id,
          idempotency_key: "refund-exceed",
          amount: 50.00
        )
      }

      then {
        result is REFUND_EXCEEDS_AMOUNT
      }
    }
  }
}
