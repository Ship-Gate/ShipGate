# Stripe-like Payments Domain
# 
# Defines behavioral contracts for payment processing including
# charges, refunds, subscriptions, and webhook handling.

domain PaymentProcessing {
  version: "1.0.0"
  owner: "flagship-demo"

  # ============================================
  # Types
  # ============================================

  type PaymentId = UUID { immutable: true, unique: true }
  type CustomerId = UUID { immutable: true, unique: true }
  type SubscriptionId = UUID { immutable: true, unique: true }
  type Money = Decimal { precision: 2, min: 0 }
  type Currency = String { length: 3, format: "ISO4217" }
  type CardNumber = String { format: "credit_card", length: 16 }
  type CardLast4 = String { length: 4, pattern: "^[0-9]{4}$" }

  # ============================================
  # Enums
  # ============================================

  enum PaymentStatus {
    PENDING
    PROCESSING
    SUCCEEDED
    FAILED
    CANCELED
    REFUNDED
    PARTIALLY_REFUNDED
  }

  enum PaymentMethod {
    CARD
    BANK_TRANSFER
    WALLET
  }

  enum SubscriptionStatus {
    ACTIVE
    PAST_DUE
    CANCELED
    PAUSED
    TRIALING
  }

  enum RefundReason {
    REQUESTED_BY_CUSTOMER
    DUPLICATE
    FRAUDULENT
    OTHER
  }

  # ============================================
  # Entities
  # ============================================

  entity Customer {
    id: CustomerId [immutable, unique]
    email: String [indexed]
    name: String?
    default_payment_method_id: String?
    created_at: Timestamp [immutable]
    metadata: Map<String, String>?

    invariants {
      email.length > 0
    }
  }

  entity PaymentMethod {
    id: String [immutable, unique]
    customer_id: CustomerId [indexed]
    type: PaymentMethod
    card_brand: String?
    card_last4: CardLast4? [pii]
    card_exp_month: Int?
    card_exp_year: Int?
    is_default: Boolean [default: false]
    created_at: Timestamp [immutable]

    invariants {
      type == CARD implies card_last4 != null
      card_exp_month != null implies card_exp_month >= 1 and card_exp_month <= 12
    }
  }

  entity Payment {
    id: PaymentId [immutable, unique]
    customer_id: CustomerId [indexed]
    amount: Money
    currency: Currency
    status: PaymentStatus [indexed]
    payment_method_id: String
    description: String?
    metadata: Map<String, String>?
    refunded_amount: Money [default: 0]
    failure_code: String?
    failure_message: String?
    created_at: Timestamp [immutable]
    updated_at: Timestamp

    invariants {
      amount > 0
      refunded_amount <= amount
      status == REFUNDED implies refunded_amount == amount
      status == PARTIALLY_REFUNDED implies refunded_amount > 0 and refunded_amount < amount
    }
  }

  entity Refund {
    id: UUID [immutable, unique]
    payment_id: PaymentId [indexed]
    amount: Money
    reason: RefundReason
    status: PaymentStatus
    created_at: Timestamp [immutable]

    invariants {
      amount > 0
    }
  }

  entity Subscription {
    id: SubscriptionId [immutable, unique]
    customer_id: CustomerId [indexed]
    plan_id: String [indexed]
    status: SubscriptionStatus [indexed]
    current_period_start: Timestamp
    current_period_end: Timestamp
    cancel_at_period_end: Boolean [default: false]
    trial_end: Timestamp?
    created_at: Timestamp [immutable]
    canceled_at: Timestamp?

    invariants {
      current_period_end > current_period_start
      status == TRIALING implies trial_end != null
      status == CANCELED implies canceled_at != null
    }

    lifecycle {
      TRIALING -> ACTIVE
      ACTIVE -> PAST_DUE
      PAST_DUE -> ACTIVE
      ACTIVE -> PAUSED
      PAUSED -> ACTIVE
      ACTIVE -> CANCELED
      PAST_DUE -> CANCELED
    }
  }

  # ============================================
  # Behaviors
  # ============================================

  behavior CreatePayment {
    description: "Create and process a new payment charge"

    actors {
      Customer {
        must: authenticated
      }
      System {
        for: automated_billing
      }
    }

    input {
      customer_id: CustomerId
      amount: Money
      currency: Currency
      payment_method_id: String?
      description: String?
      metadata: Map<String, String>?
      idempotency_key: String?
    }

    output {
      success: Payment { status: SUCCEEDED }

      errors {
        CUSTOMER_NOT_FOUND {
          when: "Customer does not exist"
          retriable: false
        }
        PAYMENT_METHOD_NOT_FOUND {
          when: "Payment method does not exist or not attached to customer"
          retriable: false
        }
        INSUFFICIENT_FUNDS {
          when: "Card declined due to insufficient funds"
          retriable: true
          retry_after: 24h
        }
        CARD_DECLINED {
          when: "Card was declined by the issuer"
          retriable: true
        }
        EXPIRED_CARD {
          when: "Card has expired"
          retriable: false
        }
        PROCESSOR_ERROR {
          when: "Payment processor returned an error"
          retriable: true
          retry_after: 5s
        }
        AMOUNT_TOO_SMALL {
          when: "Amount is below minimum charge amount"
          retriable: false
        }
        AMOUNT_TOO_LARGE {
          when: "Amount exceeds maximum charge amount"
          retriable: false
        }
      }
    }

    pre {
      amount > 0
      amount >= 0.50
      amount <= 999999.99
      currency.length == 3
      Customer.exists(customer_id)
    }

    post success {
      - Payment.exists(result.id)
      - Payment.status == SUCCEEDED
      - Payment.amount == input.amount
      - Payment.customer_id == input.customer_id
      - Customer.balance_owed decreased by input.amount
    }

    post CARD_DECLINED {
      - Payment.exists with status FAILED
      - Payment.failure_code != null
      - Customer.balance unchanged
    }

    post failure {
      - no successful Payment created
      - Customer.balance unchanged
    }

    invariants {
      - card numbers never stored in plaintext
      - CVV never stored
      - PCI-DSS compliant
      - idempotency_key prevents duplicate charges
    }

    temporal {
      - within 5s (p50): response returned
      - within 15s (p99): response returned
      - eventually within 30s: webhook dispatched
    }

    security {
      - rate_limit 100 per minute per customer
      - fraud_detection enabled
    }

    compliance {
      pci_dss {
        - card data encrypted in transit
        - card data tokenized at rest
      }
    }
  }

  behavior CreateRefund {
    description: "Refund a payment fully or partially"

    actors {
      Admin {
        must: authenticated
        has_permission: refunds
      }
      System {
        for: automated_refunds
      }
    }

    input {
      payment_id: PaymentId
      amount: Money?
      reason: RefundReason
      metadata: Map<String, String>?
    }

    output {
      success: Refund

      errors {
        PAYMENT_NOT_FOUND {
          when: "Payment does not exist"
          retriable: false
        }
        ALREADY_REFUNDED {
          when: "Payment has already been fully refunded"
          retriable: false
        }
        REFUND_AMOUNT_EXCEEDS_PAYMENT {
          when: "Refund amount exceeds remaining refundable amount"
          retriable: false
        }
        REFUND_FAILED {
          when: "Refund failed at processor"
          retriable: true
          retry_after: 5s
        }
      }
    }

    pre {
      Payment.exists(payment_id)
      Payment.status in [SUCCEEDED, PARTIALLY_REFUNDED]
      input.amount == null or input.amount > 0
      input.amount == null or input.amount <= (Payment.amount - Payment.refunded_amount)
    }

    post success {
      - Refund.exists(result.id)
      - Refund.payment_id == input.payment_id
      - Payment.refunded_amount increased by refund_amount
      - Payment.status == REFUNDED or Payment.status == PARTIALLY_REFUNDED
    }

    post failure {
      - Payment.refunded_amount unchanged
      - Payment.status unchanged
    }

    temporal {
      - within 5s (p50): response returned
      - eventually within 5d: funds returned to customer
    }
  }

  behavior CreateSubscription {
    description: "Create a new subscription for a customer"

    actors {
      Customer {
        must: authenticated
      }
    }

    input {
      customer_id: CustomerId
      plan_id: String
      payment_method_id: String?
      trial_days: Int?
      metadata: Map<String, String>?
    }

    output {
      success: Subscription

      errors {
        CUSTOMER_NOT_FOUND {
          when: "Customer does not exist"
          retriable: false
        }
        PLAN_NOT_FOUND {
          when: "Plan does not exist"
          retriable: false
        }
        PAYMENT_METHOD_REQUIRED {
          when: "No payment method on file"
          retriable: false
        }
        ALREADY_SUBSCRIBED {
          when: "Customer already has an active subscription to this plan"
          retriable: false
        }
      }
    }

    pre {
      Customer.exists(customer_id)
      plan_id.length > 0
      input.trial_days == null or input.trial_days >= 0
    }

    post success {
      - Subscription.exists(result.id)
      - Subscription.customer_id == input.customer_id
      - Subscription.plan_id == input.plan_id
      - Subscription.status == ACTIVE or Subscription.status == TRIALING
      - input.trial_days > 0 implies Subscription.status == TRIALING
    }

    temporal {
      - within 2s (p99): response returned
      - eventually within 1m: welcome email sent
    }
  }

  behavior CancelSubscription {
    description: "Cancel an active subscription"

    actors {
      Customer {
        must: authenticated
        owns: subscription
      }
      Admin {
        must: authenticated
        has_permission: subscriptions
      }
    }

    input {
      subscription_id: SubscriptionId
      cancel_immediately: Boolean?
      reason: String?
    }

    output {
      success: Subscription { status: CANCELED }

      errors {
        SUBSCRIPTION_NOT_FOUND {
          when: "Subscription does not exist"
          retriable: false
        }
        ALREADY_CANCELED {
          when: "Subscription is already canceled"
          retriable: false
        }
      }
    }

    pre {
      Subscription.exists(subscription_id)
      Subscription.status != CANCELED
    }

    post success {
      - input.cancel_immediately implies Subscription.status == CANCELED
      - not input.cancel_immediately implies Subscription.cancel_at_period_end == true
      - Subscription.canceled_at == now() or Subscription.cancel_at_period_end == true
    }

    temporal {
      - within 1s (p99): response returned
      - eventually within 1m: cancellation email sent
    }
  }

  behavior GetPaymentHistory {
    description: "Retrieve paginated payment history for a customer"

    actors {
      Customer {
        must: authenticated
        owns: customer_id
      }
      Admin {
        must: authenticated
      }
    }

    input {
      customer_id: CustomerId
      limit: Int?
      starting_after: PaymentId?
      status: PaymentStatus?
    }

    output {
      success: {
        payments: List<Payment>
        has_more: Boolean
      }

      errors {
        CUSTOMER_NOT_FOUND {
          when: "Customer does not exist"
          retriable: false
        }
      }
    }

    pre {
      Customer.exists(customer_id)
      input.limit == null or (input.limit > 0 and input.limit <= 100)
    }

    post success {
      - all payments belong to customer_id
      - result.payments.length <= (input.limit or 10)
    }

    temporal {
      - within 100ms (p50): response returned
      - within 500ms (p99): response returned
    }
  }

  # ============================================
  # Scenarios
  # ============================================

  scenarios CreatePayment {
    scenario "successful payment" {
      given {
        customer = Customer.create(email: "buyer@example.com")
        payment_method = PaymentMethod.create(customer_id: customer.id, type: CARD, card_last4: "4242")
      }

      when {
        result = CreatePayment(
          customer_id: customer.id,
          amount: 99.99,
          currency: "USD",
          payment_method_id: payment_method.id,
          description: "Premium subscription"
        )
      }

      then {
        result is success
        result.status == SUCCEEDED
        result.amount == 99.99
      }
    }

    scenario "payment with insufficient funds" {
      given {
        customer = Customer.create(email: "broke@example.com")
        payment_method = PaymentMethod.create(customer_id: customer.id, type: CARD, card_last4: "0002")
      }

      when {
        result = CreatePayment(
          customer_id: customer.id,
          amount: 1000.00,
          currency: "USD",
          payment_method_id: payment_method.id
        )
      }

      then {
        result is INSUFFICIENT_FUNDS
      }
    }

    scenario "payment with idempotency" {
      given {
        customer = Customer.create(email: "careful@example.com")
        payment_method = PaymentMethod.create(customer_id: customer.id, type: CARD)
      }

      when {
        result1 = CreatePayment(customer_id: customer.id, amount: 50.00, currency: "USD", idempotency_key: "order-123")
        result2 = CreatePayment(customer_id: customer.id, amount: 50.00, currency: "USD", idempotency_key: "order-123")
      }

      then {
        result1 is success
        result2 is success
        result1.id == result2.id
      }
    }
  }

  scenarios CreateRefund {
    scenario "full refund" {
      given {
        payment = Payment.create(amount: 100.00, status: SUCCEEDED)
      }

      when {
        result = CreateRefund(payment_id: payment.id, reason: REQUESTED_BY_CUSTOMER)
      }

      then {
        result is success
        payment.status == REFUNDED
        payment.refunded_amount == 100.00
      }
    }

    scenario "partial refund" {
      given {
        payment = Payment.create(amount: 100.00, status: SUCCEEDED)
      }

      when {
        result = CreateRefund(payment_id: payment.id, amount: 30.00, reason: OTHER)
      }

      then {
        result is success
        payment.status == PARTIALLY_REFUNDED
        payment.refunded_amount == 30.00
      }
    }
  }

  # ============================================
  # Chaos Tests
  # ============================================

  chaos CreatePayment {
    chaos "processor timeout" {
      inject {
        latency(target: PaymentProcessor, delay: 30.seconds)
      }

      when {
        result = CreatePayment(customer_id: customer.id, amount: 50.00, currency: "USD")
      }

      then {
        result is PROCESSOR_ERROR or result is success
        no duplicate charges created
      }
    }

    chaos "processor unavailable" {
      inject {
        service_unavailable(target: PaymentProcessor)
      }

      when {
        result = CreatePayment(customer_id: customer.id, amount: 50.00, currency: "USD")
      }

      then {
        result is PROCESSOR_ERROR
        Customer.balance unchanged
      }
    }
  }

  # ============================================
  # Global Invariants
  # ============================================

  invariants PaymentSecurity {
    description: "Security invariants for payment processing"
    scope: global

    always {
      - card numbers never stored after tokenization
      - CVV never persisted
      - all payments logged with audit trail
      - idempotency prevents duplicate charges
      - PCI-DSS Level 1 compliance maintained
    }
  }
}
