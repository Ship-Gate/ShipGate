domain Payments {
  version: "1.0.0"
  owner: "IntentOS Standard Library"
  
  // ============================================================================
  // CORE TYPES
  // ============================================================================
  
  type PaymentId = UUID
  type InvoiceId = UUID
  type SubscriptionId = UUID
  type CustomerId = UUID
  
  type Money = Decimal {
    precision: 2
    min: 0
  }
  
  type Currency = String {
    pattern: /^[A-Z]{3}$/
  }
  
  type PaymentMethodId = UUID
  
  // ============================================================================
  // ENUMS
  // ============================================================================
  
  enum PaymentStatus {
    PENDING
    PROCESSING
    COMPLETED
    FAILED
    REFUNDED
    PARTIALLY_REFUNDED
    CANCELLED
  }
  
  enum PaymentMethodType {
    CARD
    BANK_ACCOUNT
    PAYPAL
    APPLE_PAY
    GOOGLE_PAY
    CRYPTO
  }
  
  enum InvoiceStatus {
    DRAFT
    SENT
    PAID
    OVERDUE
    CANCELLED
  }
  
  enum SubscriptionStatus {
    ACTIVE
    CANCELLED
    PAST_DUE
    TRIALING
    EXPIRED
  }
  
  // ============================================================================
  // ENTITIES
  // ============================================================================
  
  entity Payment {
    id: PaymentId [immutable, unique, indexed]
    customer_id: CustomerId [indexed]
    
    amount: Money
    currency: Currency
    status: PaymentStatus
    
    payment_method_id: PaymentMethodId
    
    description: String?
    metadata: Map<String, String>?
    
    created_at: Timestamp [immutable]
    completed_at: Timestamp?
    failed_at: Timestamp?
    
    failure_reason: String?
    
    refund_amount: Money?
    refunded_at: Timestamp?
    
    invariants {
      amount > 0
      refund_amount == null or refund_amount <= amount
      status == COMPLETED implies completed_at != null
      status == FAILED implies failed_at != null
    }
  }
  
  entity PaymentMethod {
    id: PaymentMethodId [immutable, unique, indexed]
    customer_id: CustomerId [indexed]
    
    type: PaymentMethodType
    is_default: Boolean
    
    // Type-specific data (encrypted)
    card_last4: String?
    card_brand: String?
    card_exp_month: Int?
    card_exp_year: Int?
    
    bank_account_last4: String?
    bank_account_type: String?
    
    created_at: Timestamp [immutable]
    
    invariants {
      type == CARD implies card_last4 != null
      type == BANK_ACCOUNT implies bank_account_last4 != null
    }
  }
  
  entity Invoice {
    id: InvoiceId [immutable, unique, indexed]
    customer_id: CustomerId [indexed]
    
    amount: Money
    currency: Currency
    status: InvoiceStatus
    
    due_date: Timestamp
    paid_at: Timestamp?
    
    line_items: List<InvoiceLineItem>
    
    created_at: Timestamp [immutable]
    
    invariants {
      amount > 0
      due_date > created_at
      status == PAID implies paid_at != null
    }
  }
  
  entity Subscription {
    id: SubscriptionId [immutable, unique, indexed]
    customer_id: CustomerId [indexed]
    
    plan_id: String
    status: SubscriptionStatus
    
    current_period_start: Timestamp
    current_period_end: Timestamp
    
    cancel_at_period_end: Boolean
    cancelled_at: Timestamp?
    
    payment_method_id: PaymentMethodId?
    
    created_at: Timestamp [immutable]
    
    invariants {
      current_period_end > current_period_start
      status == CANCELLED implies cancelled_at != null
    }
  }
  
  type InvoiceLineItem = {
    description: String
    quantity: Int
    unit_price: Money
    total: Money
  }
  
  // ============================================================================
  // BEHAVIORS
  // ============================================================================
  
  behavior Charge {
    description: "Process a payment charge"
    
    input {
      customer_id: CustomerId
      amount: Money
      currency: Currency
      payment_method_id: PaymentMethodId
      description: String?
    }
    
    output {
      success: Payment
      errors {
        INSUFFICIENT_FUNDS { when: "Payment method has insufficient funds" }
        PAYMENT_METHOD_INVALID { when: "Payment method is invalid or expired" }
        AMOUNT_TOO_SMALL { when: "Amount is below minimum" }
        AMOUNT_TOO_LARGE { when: "Amount exceeds maximum" }
      }
    }
    
    preconditions {
      amount > 0
      PaymentMethod.exists(id: input.payment_method_id)
      PaymentMethod.lookup(id: input.payment_method_id).customer_id == input.customer_id
    }
    
    postconditions {
      success implies {
        Payment.exists(result.id)
        result.amount == input.amount
        result.status == COMPLETED
        result.completed_at != null
      }
    }
    
    temporal {
      response within 5.seconds (p99)
    }
    
    security {
      rate_limit 100/minute per customer_id
    }
  }
  
  behavior Refund {
    description: "Refund a payment"
    
    input {
      payment_id: PaymentId
      amount: Money?  // Partial refund if specified
    }
    
    output {
      success: Payment
      errors {
        PAYMENT_NOT_FOUND { }
        PAYMENT_NOT_REFUNDABLE { when: "Payment is not in a refundable state" }
        REFUND_AMOUNT_EXCEEDS_PAYMENT { when: "Refund amount exceeds payment amount" }
      }
    }
    
    preconditions {
      Payment.exists(id: input.payment_id)
      Payment.lookup(id: input.payment_id).status == COMPLETED
    }
    
    postconditions {
      success implies {
        result.refund_amount == (input.amount ?? result.amount)
        result.status == REFUNDED or result.status == PARTIALLY_REFUNDED
        result.refunded_at != null
      }
    }
    
    temporal {
      response within 10.seconds (p99)
    }
  }
  
  behavior CreateInvoice {
    description: "Create an invoice"
    
    input {
      customer_id: CustomerId
      line_items: List<InvoiceLineItem>
      due_date: Timestamp
      currency: Currency
    }
    
    output {
      success: Invoice
      errors {
        INVALID_LINE_ITEMS { when: "Line items are invalid" }
        DUE_DATE_IN_PAST { when: "Due date cannot be in the past" }
      }
    }
    
    preconditions {
      input.line_items.length > 0
      input.due_date > now()
    }
    
    postconditions {
      success implies {
        Invoice.exists(result.id)
        result.status == DRAFT
        result.amount == sum(input.line_items.map(item => item.total))
      }
    }
  }
  
  behavior CreateSubscription {
    description: "Create a subscription"
    
    input {
      customer_id: CustomerId
      plan_id: String
      payment_method_id: PaymentMethodId?
      trial_days: Int?
    }
    
    output {
      success: Subscription
      errors {
        PLAN_NOT_FOUND { }
        PAYMENT_METHOD_REQUIRED { when: "Payment method required for non-trial subscriptions" }
      }
    }
    
    postconditions {
      success implies {
        Subscription.exists(result.id)
        result.status == TRIALING or result.status == ACTIVE
      }
    }
  }
  
  behavior CancelSubscription {
    description: "Cancel a subscription"
    
    input {
      subscription_id: SubscriptionId
      cancel_immediately: Boolean?
    }
    
    output {
      success: Subscription
      errors {
        SUBSCRIPTION_NOT_FOUND { }
        ALREADY_CANCELLED { }
      }
    }
    
    postconditions {
      success implies {
        input.cancel_immediately implies {
          result.status == CANCELLED
          result.cancelled_at != null
        }
        not input.cancel_immediately implies {
          result.cancel_at_period_end == true
        }
      }
    }
  }
}
