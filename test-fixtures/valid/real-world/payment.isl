// NOTE: simplified for parser compatibility (optional Map types not supported).
// Real-world payment processing domain
// Realistic spec for payment service

domain Payment {
  version: "1.0.0"
  owner: "Payments Team"
  
  // === TYPES ===
  
  type Money = Decimal {
    min: 0
    precision: 2
  }
  
  type CardNumber = String {
    min_length: 13
    max_length: 19
  }
  
  type CVV = String {
    min_length: 3
    max_length: 4
  }
  
  type IdempotencyKey = String {
    max_length: 64
  }
  
  enum Currency {
    USD
    EUR
    GBP
    CAD
    AUD
    JPY
  }
  
  enum PaymentStatus {
    PENDING
    PROCESSING
    COMPLETED
    FAILED
    REFUNDED
    CANCELLED
  }
  
  enum RefundStatus {
    PENDING
    COMPLETED
    FAILED
  }
  
  type CardDetails = {
    number: String
    expiry_month: Int
    expiry_year: Int
    cvv: String
    cardholder_name: String
  }
  
  type BillingAddress = {
    line1: String
    line2: String?
    city: String
    state: String?
    postal_code: String
    country: String
  }
  
  // === ENTITIES ===
  
  entity Payment {
    id: UUID [immutable, unique]
    merchant_id: UUID [indexed]
    customer_id: UUID? [indexed]
    idempotency_key: String [unique, indexed]
    
    amount: Decimal
    currency: Currency
    description: String?
    
    status: PaymentStatus
    
    card_last_four: String?
    card_brand: String?
    
    processor_id: String?
    processor_response: String?
    
    billing_address: BillingAddress?
    
    metadata: Map<String, String>
    
    failure_code: String?
    failure_message: String?
    
    created_at: Timestamp [immutable]
    updated_at: Timestamp
    completed_at: Timestamp?
    
    invariants {
      amount > 0
      card_last_four == null or card_last_four.length == 4
      status == COMPLETED implies completed_at != null
    }
    
    lifecycle {
      PENDING -> PROCESSING
      PROCESSING -> COMPLETED
      PROCESSING -> FAILED
      PENDING -> CANCELLED
      COMPLETED -> REFUNDED
    }
  }
  
  entity Refund {
    id: UUID [immutable, unique]
    payment_id: UUID [indexed]
    idempotency_key: String [unique]
    
    amount: Decimal
    reason: String?
    status: RefundStatus
    
    processor_id: String?
    processor_response: String?
    
    failure_code: String?
    failure_message: String?
    
    created_at: Timestamp [immutable]
    completed_at: Timestamp?
    
    invariants {
      amount > 0
    }
  }
  
  entity PaymentMethod {
    id: UUID [immutable, unique]
    customer_id: UUID [indexed]
    
    type: String
    card_last_four: String
    card_brand: String
    card_expiry_month: Int
    card_expiry_year: Int
    
    is_default: Boolean
    
    billing_address: BillingAddress?
    
    created_at: Timestamp [immutable]
    
    invariants {
      card_last_four.length == 4
      card_expiry_month >= 1
      card_expiry_month <= 12
    }
  }
  
  // === BEHAVIORS ===
  
  behavior CreatePayment {
    description: "Create and process a payment"
    
    actors {
      Merchant { must: authenticated }
      System { }
    }
    
    input {
      amount: Decimal
      currency: Currency
      idempotency_key: String
      description: String?
      card: CardDetails [sensitive]
      billing_address: BillingAddress?
      customer_id: UUID?
      metadata: Map<String, String>
    }
    
    output {
      success: Payment
      
      errors {
        DUPLICATE_IDEMPOTENCY_KEY {
          when: "Idempotency key already used"
          retriable: false
        }
        CARD_DECLINED {
          when: "Card was declined by issuer"
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
          when: "Transaction flagged as fraudulent"
          retriable: false
        }
        PROCESSOR_ERROR {
          when: "Payment processor error"
          retriable: true
          retry_after: 5.seconds
        }
        RATE_LIMITED {
          when: "Too many requests"
          retriable: true
          retry_after: 1.minutes
        }
      }
    }
    
    preconditions {
      input.amount > 0
      input.card.expiry_year >= 2024
      not Payment.exists(idempotency_key: input.idempotency_key)
    }
    
    postconditions {
      success implies {
        Payment.exists(result.id)
        Payment.lookup(result.id).amount == input.amount
        Payment.lookup(result.id).currency == input.currency
        Payment.lookup(result.id).idempotency_key == input.idempotency_key
        Payment.lookup(result.id).status == COMPLETED or Payment.lookup(result.id).status == PROCESSING
      }
      
      DUPLICATE_IDEMPOTENCY_KEY implies {
        Payment.count == old(Payment.count)
      }
      
      any_error implies {
        not Payment.exists(id: result.id) or Payment.lookup(result.id).status == FAILED
      }
    }
    
    invariants {
      input.card.number never_appears_in logs
      input.card.cvv never_appears_in logs
      input.card.number never_appears_in result
      input.card.cvv never_appears_in result
    }
    
    temporal {
      response within 5.seconds
      eventually within 30.seconds: payment_settled
    }
    
    security {
      rate_limit 100 per actor
      rate_limit 1000 per merchant_id
      // fraud_check removed - bare identifier not supported
    }
    
    // compliance block removed - bare identifiers (pci_dss, audit_trail) not supported
  }
  
  behavior GetPayment {
    description: "Retrieve payment details"
    
    actors {
      Merchant { must: authenticated }
    }
    
    input {
      payment_id: UUID
    }
    
    output {
      success: Payment
      
      errors {
        PAYMENT_NOT_FOUND {
          when: "Payment does not exist"
          retriable: false
        }
        UNAUTHORIZED {
          when: "Not authorized to view this payment"
          retriable: false
        }
      }
    }
    
    preconditions {
      Payment.exists(input.payment_id)
    }
  }
  
  behavior RefundPayment {
    description: "Refund a completed payment"
    
    actors {
      Merchant { must: authenticated }
      Admin { must: authenticated }
    }
    
    input {
      payment_id: UUID
      amount: Decimal?
      reason: String?
      idempotency_key: String
    }
    
    output {
      success: Refund
      
      errors {
        PAYMENT_NOT_FOUND {
          when: "Payment does not exist"
          retriable: false
        }
        PAYMENT_NOT_REFUNDABLE {
          when: "Payment cannot be refunded"
          retriable: false
        }
        REFUND_EXCEEDS_AMOUNT {
          when: "Refund amount exceeds payment amount"
          retriable: false
        }
        DUPLICATE_IDEMPOTENCY_KEY {
          when: "Idempotency key already used"
          retriable: false
        }
        PROCESSOR_ERROR {
          when: "Payment processor error"
          retriable: true
          retry_after: 5.seconds
        }
      }
    }
    
    preconditions {
      Payment.exists(input.payment_id)
      Payment.lookup(input.payment_id).status == COMPLETED
      input.amount == null or input.amount > 0
      input.amount == null or input.amount <= Payment.lookup(input.payment_id).amount
    }
    
    postconditions {
      success implies {
        Refund.exists(result.id)
        Refund.lookup(result.id).payment_id == input.payment_id
        Refund.lookup(result.id).status == COMPLETED or Refund.lookup(result.id).status == PENDING
      }
    }
    
    temporal {
      response within 10.seconds
      eventually within 5.minutes: refund_processed
    }
  }
  
  behavior CancelPayment {
    description: "Cancel a pending payment"
    
    actors {
      Merchant { must: authenticated }
    }
    
    input {
      payment_id: UUID
    }
    
    output {
      success: Payment
      
      errors {
        PAYMENT_NOT_FOUND {
          when: "Payment does not exist"
          retriable: false
        }
        PAYMENT_NOT_CANCELLABLE {
          when: "Payment is not in cancellable state"
          retriable: false
        }
      }
    }
    
    preconditions {
      Payment.exists(input.payment_id)
      Payment.lookup(input.payment_id).status == PENDING
    }
    
    postconditions {
      success implies {
        Payment.lookup(input.payment_id).status == CANCELLED
      }
    }
  }
  
  // === SCENARIOS ===
  
  scenarios CreatePayment {
    scenario "successful payment" {
      given {
        initial_count = Payment.count
      }
      
      when {
        result = CreatePayment(
          amount: 99.99,
          currency: USD,
          idempotency_key: "pay-123",
          card: {
            number: "4111111111111111",
            expiry_month: 12,
            expiry_year: 2025,
            cvv: "123",
            cardholder_name: "John Doe"
          }
        )
      }
      
      then {
        result is success
        Payment.count == initial_count + 1
        result.amount == 99.99
        result.currency == USD
      }
    }
    
    scenario "idempotency key reuse returns same payment" {
      given {
        first = CreatePayment(
          amount: 50.00,
          currency: USD,
          idempotency_key: "idempotent-key",
          card: {
            number: "4111111111111111",
            expiry_month: 12,
            expiry_year: 2025,
            cvv: "123",
            cardholder_name: "John Doe"
          }
        )
      }
      
      when {
        result = CreatePayment(
          amount: 50.00,
          currency: USD,
          idempotency_key: "idempotent-key",
          card: {
            number: "4111111111111111",
            expiry_month: 12,
            expiry_year: 2025,
            cvv: "123",
            cardholder_name: "John Doe"
          }
        )
      }
      
      then {
        result is DUPLICATE_IDEMPOTENCY_KEY or result.id == first.id
      }
    }
    
    scenario "expired card rejection" {
      when {
        result = CreatePayment(
          amount: 100.00,
          currency: USD,
          idempotency_key: "expired-card",
          card: {
            number: "4111111111111111",
            expiry_month: 1,
            expiry_year: 2020,
            cvv: "123",
            cardholder_name: "John Doe"
          }
        )
      }
      
      then {
        result is EXPIRED_CARD
      }
    }
  }
  
  scenarios RefundPayment {
    scenario "full refund" {
      given {
        payment = CreatePayment(
          amount: 100.00,
          currency: USD,
          idempotency_key: "refund-test",
          card: {
            number: "4111111111111111",
            expiry_month: 12,
            expiry_year: 2025,
            cvv: "123",
            cardholder_name: "John Doe"
          }
        )
      }
      
      when {
        result = RefundPayment(
          payment_id: payment.id,
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
        payment = CreatePayment(
          amount: 100.00,
          currency: USD,
          idempotency_key: "partial-refund-test",
          card: {
            number: "4111111111111111",
            expiry_month: 12,
            expiry_year: 2025,
            cvv: "123",
            cardholder_name: "John Doe"
          }
        )
      }
      
      when {
        result = RefundPayment(
          payment_id: payment.id,
          amount: 25.00,
          idempotency_key: "refund-partial"
        )
      }
      
      then {
        result is success
        result.amount == 25.00
      }
    }
  }
  
  // === CHAOS TESTS ===
  
  chaos CreatePayment {
    chaos "processor timeout" {
      inject {
        latency(target: PaymentProcessor, delay: 30.seconds)
      }
      
      when {
        result = CreatePayment(
          amount: 50.00,
          currency: USD,
          idempotency_key: "chaos-timeout",
          card: {
            number: "4111111111111111",
            expiry_month: 12,
            expiry_year: 2025,
            cvv: "123",
            cardholder_name: "John Doe"
          }
        )
      }
      
      then {
        result is PROCESSOR_ERROR or result is success
        // Should timeout gracefully or succeed if processor responds
      }
    }
    
    chaos "processor unavailable" {
      inject {
        service_unavailable(target: PaymentProcessor)
      }
      
      when {
        result = CreatePayment(
          amount: 50.00,
          currency: USD,
          idempotency_key: "chaos-unavailable",
          card: {
            number: "4111111111111111",
            expiry_month: 12,
            expiry_year: 2025,
            cvv: "123",
            cardholder_name: "John Doe"
          }
        )
      }
      
      then {
        result is PROCESSOR_ERROR
        // Payment should fail gracefully, not hang
      }
    }
  }
}
