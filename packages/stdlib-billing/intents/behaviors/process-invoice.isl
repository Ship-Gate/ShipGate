// ============================================================================
// Invoice Processing Behaviors
// ============================================================================

behavior CreateInvoice {
  description: "Create a new invoice for a customer"
  
  actors {
    admin: Admin
    service: Internal
  }
  
  input {
    customer_id: CustomerId
    subscription_id: SubscriptionId?
    
    // Line items
    line_items: List<CreateLineItem>?
    
    // Billing
    collection_method: CollectionMethod?
    days_until_due: Int { min: 1, max: 90 }?
    due_date: Timestamp?
    
    // Discounts
    discounts: List<DiscountId>?
    
    // Options
    auto_advance: Boolean?
    description: String?
    footer: String?
    statement_descriptor: String?
    
    // Metadata
    metadata: Map<String, String>?
    
    // Pending items
    pending_invoice_items_behavior: PendingItemsBehavior?
  }
  
  output {
    success: Invoice
    errors {
      CUSTOMER_NOT_FOUND { }
      SUBSCRIPTION_NOT_FOUND { }
      NO_LINE_ITEMS { when: "Invoice must have at least one line item" }
      INVALID_DISCOUNT { }
    }
  }
  
  preconditions {
    Customer.exists(input.customer_id)
    input.subscription_id != null implies Subscription.exists(input.subscription_id)
    input.line_items != null implies input.line_items.length > 0
  }
  
  postconditions {
    success implies {
      Invoice.exists(result.id)
      result.customer_id == input.customer_id
      result.status == DRAFT
    }
  }
  
  temporal {
    response within 1.second (p99)
  }
}

type CreateLineItem = {
  description: String
  quantity: Int { min: 1 }
  unit_amount: Money
  currency: Currency?
  period_start: Timestamp?
  period_end: Timestamp?
  metadata: Map<String, String>?
}

enum PendingItemsBehavior {
  INCLUDE            // Include pending invoice items
  EXCLUDE            // Don't include pending items
  INCLUDE_AND_CLEAR  // Include and remove from pending
}

// ============================================================================
// Finalize Invoice Behavior
// ============================================================================

behavior FinalizeInvoice {
  description: "Finalize a draft invoice for payment"
  
  input {
    invoice_id: InvoiceId
    auto_advance: Boolean?
  }
  
  output {
    success: Invoice
    errors {
      INVOICE_NOT_FOUND { }
      ALREADY_FINALIZED { when: "Invoice is already finalized" }
      CANNOT_FINALIZE { when: "Invoice cannot be finalized" }
    }
  }
  
  preconditions {
    Invoice.exists(input.invoice_id)
    Invoice.lookup(input.invoice_id).status == DRAFT
  }
  
  postconditions {
    success implies {
      result.status == OPEN
      result.finalized_at != null
      result.number != null  // Invoice number assigned
    }
  }
}

// ============================================================================
// Pay Invoice Behavior
// ============================================================================

behavior PayInvoice {
  description: "Pay an open invoice"
  
  actors {
    customer: Customer
    admin: Admin
    service: Internal
  }
  
  input {
    invoice_id: InvoiceId
    
    // Payment options
    payment_method_id: PaymentMethodId?
    paid_out_of_band: Boolean?  // Mark as paid externally
    forgive: Boolean?           // Write off remaining amount
    
    // Amount (for partial payment)
    amount: Money?
  }
  
  output {
    success: PayInvoiceResult
    errors {
      INVOICE_NOT_FOUND {
        retriable: false
      }
      ALREADY_PAID {
        when: "Invoice is already paid"
        retriable: false
      }
      CANNOT_PAY {
        when: "Invoice cannot be paid in current state"
        retriable: false
      }
      PAYMENT_METHOD_REQUIRED {
        when: "No payment method specified"
        retriable: false
      }
      PAYMENT_FAILED {
        when: "Payment processing failed"
        retriable: true
        retry_after: 10.seconds
      }
      AMOUNT_TOO_LARGE {
        when: "Payment amount exceeds amount due"
        retriable: false
      }
      AMOUNT_TOO_SMALL {
        when: "Payment amount is below minimum"
        retriable: false
      }
    }
  }
  
  preconditions {
    // Invoice must exist
    Invoice.exists(input.invoice_id)
    
    // Invoice must be open
    Invoice.lookup(input.invoice_id).status == OPEN
    
    // Must have amount remaining
    Invoice.lookup(input.invoice_id).amount_remaining > 0
    
    // Amount cannot exceed remaining
    input.amount != null implies input.amount <= Invoice.lookup(input.invoice_id).amount_remaining
  }
  
  postconditions {
    success implies {
      // Full payment
      (input.amount == null or input.amount == old(Invoice.lookup(input.invoice_id).amount_remaining)) implies {
        result.invoice.status == PAID
        result.invoice.paid == true
        result.invoice.paid_at != null
        result.invoice.amount_remaining == 0
      }
      
      // Partial payment
      (input.amount != null and input.amount < old(Invoice.lookup(input.invoice_id).amount_remaining)) implies {
        result.invoice.amount_paid == old(Invoice.lookup(input.invoice_id).amount_paid) + input.amount
        result.invoice.amount_remaining == old(Invoice.lookup(input.invoice_id).amount_remaining) - input.amount
      }
      
      // Forgive remaining
      input.forgive == true implies {
        result.invoice.status == PAID
      }
    }
  }
  
  temporal {
    response within 5.seconds (p99)
  }
  
  security {
    requires authentication
    
    actor is Customer implies {
      Invoice.lookup(input.invoice_id).customer_id == actor.id
    }
  }
  
  observability {
    metrics {
      invoices_paid: counter { labels: [payment_method_type, currency] }
      invoice_payment_amount: histogram { labels: [currency] }
      payment_success_rate: gauge { labels: [payment_method_type] }
    }
    
    logs {
      success: info { 
        include: [invoice_id, amount, payment_method_type] 
        exclude: [payment_method_id]
      }
      PAYMENT_FAILED: error {
        include: [invoice_id, error_code, decline_code]
      }
    }
  }
}

type PayInvoiceResult = {
  invoice: Invoice
  payment_intent: PaymentIntent?
  charge_id: String?
}

// ============================================================================
// Void Invoice Behavior
// ============================================================================

behavior VoidInvoice {
  description: "Void an invoice (cannot be paid)"
  
  actors {
    admin: Admin
    service: Internal
  }
  
  input {
    invoice_id: InvoiceId
    reason: String?
  }
  
  output {
    success: Invoice
    errors {
      INVOICE_NOT_FOUND { }
      CANNOT_VOID { when: "Invoice cannot be voided (already paid or voided)" }
    }
  }
  
  preconditions {
    Invoice.exists(input.invoice_id)
    Invoice.lookup(input.invoice_id).status in [DRAFT, OPEN]
  }
  
  postconditions {
    success implies {
      result.status == VOID
      result.voided_at != null
    }
  }
}

// ============================================================================
// Mark Uncollectible Behavior
// ============================================================================

behavior MarkUncollectible {
  description: "Mark an invoice as uncollectible (bad debt)"
  
  actors {
    admin: Admin
    service: Internal
  }
  
  input {
    invoice_id: InvoiceId
    reason: String?
  }
  
  output {
    success: Invoice
    errors {
      INVOICE_NOT_FOUND { }
      CANNOT_MARK_UNCOLLECTIBLE { when: "Invoice is not in valid state" }
    }
  }
  
  preconditions {
    Invoice.exists(input.invoice_id)
    Invoice.lookup(input.invoice_id).status == OPEN
  }
  
  postconditions {
    success implies {
      result.status == UNCOLLECTIBLE
    }
  }
}

// ============================================================================
// Send Invoice Behavior
// ============================================================================

behavior SendInvoice {
  description: "Send invoice to customer via email"
  
  input {
    invoice_id: InvoiceId
    to: List<String { format: email }>?  // Override recipients
    cc: List<String { format: email }>?
    include_pdf: Boolean?
  }
  
  output {
    success: { sent_to: List<String>, invoice: Invoice }
    errors {
      INVOICE_NOT_FOUND { }
      NOT_FINALIZED { when: "Invoice must be finalized before sending" }
      SEND_FAILED { retriable: true }
    }
  }
  
  preconditions {
    Invoice.exists(input.invoice_id)
    Invoice.lookup(input.invoice_id).status != DRAFT
  }
  
  temporal {
    response within 2.seconds (p99)
    eventually within 5.minutes: email_delivered
  }
}

// ============================================================================
// Retry Invoice Payment Behavior
// ============================================================================

behavior RetryInvoicePayment {
  description: "Retry payment for a failed invoice"
  
  input {
    invoice_id: InvoiceId
    payment_method_id: PaymentMethodId?
  }
  
  output {
    success: PayInvoiceResult
    errors {
      INVOICE_NOT_FOUND { }
      CANNOT_RETRY { when: "Invoice is not in retryable state" }
      MAX_RETRIES_EXCEEDED { when: "Maximum retry attempts reached" }
      PAYMENT_FAILED { retriable: true }
    }
  }
  
  preconditions {
    Invoice.exists(input.invoice_id)
    Invoice.lookup(input.invoice_id).status == OPEN
    Invoice.lookup(input.invoice_id).attempt_count < config.max_retry_attempts
  }
  
  postconditions {
    success implies {
      result.invoice.attempt_count == old(Invoice.lookup(input.invoice_id).attempt_count) + 1
    }
  }
}
