# Process Refund Module
# Provides refund processing behaviors

module ProcessRefund version "1.0.0"

# ============================================
# Types
# ============================================

type RefundId = UUID { immutable: true, unique: true }

type Money = Decimal { min: 0, precision: 2 }

type RefundStatus = enum {
  PENDING
  PROCESSING
  COMPLETED
  FAILED
  CANCELLED
}

type RefundReason = enum {
  CUSTOMER_REQUEST
  DUPLICATE
  FRAUDULENT
  PRODUCT_ISSUE
  SERVICE_ISSUE
  OTHER
}

# ============================================
# Entities
# ============================================

entity Refund {
  id: RefundId [immutable, unique]
  payment_id: UUID [indexed]
  amount: Money
  reason: RefundReason
  reason_details: String?
  status: RefundStatus [indexed]
  processor_id: String?
  created_at: Timestamp [immutable]
  updated_at: Timestamp
  completed_at: Timestamp?
  failed_at: Timestamp?
  failure_reason: String?
  refunded_by: UUID?  # Admin user ID
  idempotency_key: String? [unique]

  invariants {
    amount > 0
    completed_at != null implies status == COMPLETED
    failed_at != null implies status == FAILED
  }

  lifecycle {
    PENDING -> PROCESSING
    PROCESSING -> COMPLETED
    PROCESSING -> FAILED
    PENDING -> CANCELLED
  }
}

# ============================================
# Behaviors
# ============================================

behavior CreateRefund {
  description: "Create a refund for a payment"

  input {
    payment_id: UUID
    amount: Money?  # null = full refund
    reason: RefundReason
    reason_details: String?
    idempotency_key: String?
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
      AMOUNT_EXCEEDS_AVAILABLE {
        when: "Refund amount exceeds available"
        retriable: false
      }
      DUPLICATE_REQUEST {
        when: "Idempotency key already used"
        retriable: false
      }
      REFUND_WINDOW_EXPIRED {
        when: "Refund window has expired"
        retriable: false
      }
    }
  }

  pre {
    Payment.exists(payment_id)
    Payment.lookup(payment_id).status in [COMPLETED, PARTIALLY_REFUNDED]
    input.amount == null or input.amount <= Payment.refundable_amount(payment_id)
  }

  post success {
    Refund.exists(result.id)
    result.payment_id == input.payment_id
    result.status == PENDING
    result.reason == input.reason
    input.amount == null implies result.amount == Payment.refundable_amount(payment_id)
  }

  temporal {
    within 500ms (p99): response returned
  }

  security {
    requires authentication
    audit_log required
  }
}

behavior ProcessRefundIntent {
  description: "Process a pending refund"

  input {
    refund_id: RefundId
  }

  output {
    success: Refund

    errors {
      REFUND_NOT_FOUND {
        when: "Refund does not exist"
        retriable: false
      }
      INVALID_STATE {
        when: "Refund not in processable state"
        retriable: false
      }
      PROCESSOR_ERROR {
        when: "Payment processor error"
        retriable: true
        retry_after: 5s
      }
      REFUND_REJECTED {
        when: "Processor rejected refund"
        retriable: false
      }
    }
  }

  pre {
    Refund.exists(refund_id)
    Refund.lookup(refund_id).status == PENDING
  }

  post success {
    result.status == COMPLETED
    result.completed_at == now()
    result.processor_id != null
    Payment.status updated to REFUNDED or PARTIALLY_REFUNDED
  }

  post PROCESSOR_ERROR {
    Refund.lookup(refund_id).status == PENDING  # Still pending for retry
  }

  invariants {
    idempotent operation
    customer balance updated atomically
  }

  temporal {
    within 10s (p99): response returned
    eventually within 5m: refund_processed event emitted
    eventually within 5m: customer notification sent
  }
}

behavior CancelRefund {
  description: "Cancel a pending refund"

  input {
    refund_id: RefundId
    reason: String?
  }

  output {
    success: Refund

    errors {
      REFUND_NOT_FOUND {
        when: "Refund does not exist"
        retriable: false
      }
      INVALID_STATE {
        when: "Refund cannot be cancelled"
        retriable: false
      }
    }
  }

  pre {
    Refund.exists(refund_id)
    Refund.lookup(refund_id).status == PENDING
  }

  post success {
    result.status == CANCELLED
  }

  temporal {
    within 500ms (p99): response returned
  }

  security {
    requires authentication
    audit_log required
  }
}

behavior GetRefund {
  description: "Retrieve refund details"

  input {
    refund_id: RefundId
  }

  output {
    success: Refund

    errors {
      REFUND_NOT_FOUND {
        when: "Refund does not exist"
        retriable: false
      }
    }
  }

  post success {
    result.id == input.refund_id
  }

  temporal {
    within 100ms (p99): response returned
  }
}

behavior ListPaymentRefunds {
  description: "List all refunds for a payment"

  input {
    payment_id: UUID
  }

  output {
    success: {
      refunds: List<Refund>
      total_refunded: Money
      remaining_refundable: Money
    }
  }

  pre {
    Payment.exists(payment_id)
  }

  post success {
    forall r in result.refunds:
      r.payment_id == input.payment_id
    result.total_refunded + result.remaining_refundable == Payment.lookup(payment_id).amount
  }

  temporal {
    within 200ms (p99): response returned
  }
}

behavior CalculateRefundableAmount {
  description: "Calculate how much can still be refunded"

  input {
    payment_id: UUID
  }

  output {
    success: {
      original_amount: Money
      total_refunded: Money
      refundable_amount: Money
      refund_window_expires_at: Timestamp?
    }

    errors {
      PAYMENT_NOT_FOUND {
        when: "Payment does not exist"
        retriable: false
      }
    }
  }

  pre {
    Payment.exists(payment_id)
  }

  post success {
    result.refundable_amount == result.original_amount - result.total_refunded
    result.refundable_amount >= 0
  }

  temporal {
    within 100ms (p99): response returned
  }
}
