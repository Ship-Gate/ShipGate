# Process Payment Module
# Provides secure payment processing behaviors

module ProcessPayment version "1.0.0"

# ============================================
# Types
# ============================================

type PaymentId = UUID { immutable: true, unique: true }

type Money = Decimal { min: 0, precision: 2 }

type Currency = enum { USD, EUR, GBP, CAD, AUD, JPY }

type PaymentMethod = enum { CARD, BANK_TRANSFER, WALLET, CRYPTO }

type PaymentStatus = enum {
  PENDING
  PROCESSING
  COMPLETED
  FAILED
  CANCELLED
  REFUNDED
  PARTIALLY_REFUNDED
}

type CardBrand = enum { VISA, MASTERCARD, AMEX, DISCOVER }

# ============================================
# Entities
# ============================================

entity Payment {
  id: PaymentId [immutable, unique]
  customer_id: UUID [indexed]
  amount: Money
  currency: Currency
  status: PaymentStatus [indexed]
  method: PaymentMethod
  description: String?
  metadata: Map<String, String>?
  processor_id: String? [indexed]  # External payment processor ID
  processor_response: String? [secret]
  created_at: Timestamp [immutable]
  updated_at: Timestamp
  completed_at: Timestamp?
  failed_at: Timestamp?
  failure_reason: String?
  idempotency_key: String? [unique]

  invariants {
    amount > 0
    completed_at != null implies status == COMPLETED
    failed_at != null implies status == FAILED
    status == COMPLETED implies processor_id != null
  }

  lifecycle {
    PENDING -> PROCESSING
    PROCESSING -> COMPLETED
    PROCESSING -> FAILED
    COMPLETED -> REFUNDED
    COMPLETED -> PARTIALLY_REFUNDED
    PENDING -> CANCELLED
  }
}

entity PaymentCard {
  id: UUID [immutable, unique]
  customer_id: UUID [indexed]
  last_four: String { length: 4 }
  brand: CardBrand
  exp_month: Int { min: 1, max: 12 }
  exp_year: Int { min: 2024, max: 2050 }
  fingerprint: String [indexed, secret]
  token: String [secret]  # Tokenized card from processor
  is_default: Boolean [default: false]
  created_at: Timestamp [immutable]

  invariants {
    exp_year >= 2024
    last_four.matches("^[0-9]{4}$")
  }
}

# ============================================
# Behaviors
# ============================================

behavior CreatePayment {
  description: "Create a new payment intent"

  input {
    customer_id: UUID
    amount: Money
    currency: Currency
    method: PaymentMethod
    description: String?
    metadata: Map<String, String>?
    idempotency_key: String?
  }

  output {
    success: Payment

    errors {
      CUSTOMER_NOT_FOUND {
        when: "Customer does not exist"
        retriable: false
      }
      INVALID_AMOUNT {
        when: "Amount is invalid or below minimum"
        retriable: false
      }
      DUPLICATE_REQUEST {
        when: "Idempotency key already used"
        retriable: false
      }
    }
  }

  pre {
    amount > 0
    Customer.exists(customer_id)
  }

  post success {
    Payment.exists(result.id)
    result.amount == input.amount
    result.currency == input.currency
    result.status == PENDING
    result.customer_id == input.customer_id
  }

  temporal {
    within 500ms (p99): response returned
  }
}

behavior ProcessPaymentIntent {
  description: "Process a pending payment"

  input {
    payment_id: PaymentId
    card_id: UUID?
    save_card: Boolean [default: false]
  }

  output {
    success: Payment

    errors {
      PAYMENT_NOT_FOUND {
        when: "Payment does not exist"
        retriable: false
      }
      INVALID_STATE {
        when: "Payment not in processable state"
        retriable: false
      }
      CARD_DECLINED {
        when: "Card was declined"
        retriable: true
      }
      INSUFFICIENT_FUNDS {
        when: "Insufficient funds"
        retriable: true
        retry_after: 24h
      }
      CARD_EXPIRED {
        when: "Card has expired"
        retriable: false
      }
      PROCESSOR_ERROR {
        when: "Payment processor error"
        retriable: true
        retry_after: 5s
      }
      FRAUD_DETECTED {
        when: "Potential fraud detected"
        retriable: false
      }
    }
  }

  pre {
    Payment.exists(payment_id)
    Payment.lookup(payment_id).status == PENDING
  }

  post success {
    result.status == COMPLETED
    result.completed_at == now()
    result.processor_id != null
  }

  post CARD_DECLINED {
    Payment.lookup(payment_id).status == FAILED
    Payment.lookup(payment_id).failure_reason != null
  }

  invariants {
    card data never stored in plaintext
    PCI DSS compliant
    idempotent operation
  }

  temporal {
    within 5s (p99): response returned
    eventually within 1m: payment_processed event emitted
  }

  security {
    rate_limit 100 per minute per customer_id
    fraud_check required
  }
}

behavior CancelPayment {
  description: "Cancel a pending payment"

  input {
    payment_id: PaymentId
    reason: String?
  }

  output {
    success: Payment

    errors {
      PAYMENT_NOT_FOUND {
        when: "Payment does not exist"
        retriable: false
      }
      INVALID_STATE {
        when: "Payment cannot be cancelled"
        retriable: false
      }
    }
  }

  pre {
    Payment.exists(payment_id)
    Payment.lookup(payment_id).status == PENDING
  }

  post success {
    result.status == CANCELLED
  }

  temporal {
    within 500ms (p99): response returned
  }
}

behavior GetPayment {
  description: "Retrieve payment details"

  input {
    payment_id: PaymentId
  }

  output {
    success: Payment

    errors {
      PAYMENT_NOT_FOUND {
        when: "Payment does not exist"
        retriable: false
      }
    }
  }

  pre {
    payment_id.is_valid_format
  }

  post success {
    result.id == input.payment_id
  }

  temporal {
    within 100ms (p99): response returned
  }
}

behavior ListCustomerPayments {
  description: "List all payments for a customer"

  input {
    customer_id: UUID
    status: PaymentStatus?
    limit: Int { min: 1, max: 100 } [default: 20]
    offset: Int { min: 0 } [default: 0]
  }

  output {
    success: {
      payments: List<Payment>
      total_count: Int
      has_more: Boolean
    }
  }

  pre {
    Customer.exists(customer_id)
  }

  post success {
    result.payments.length <= input.limit
    forall p in result.payments:
      p.customer_id == input.customer_id
      input.status == null or p.status == input.status
  }

  temporal {
    within 200ms (p99): response returned
  }
}
