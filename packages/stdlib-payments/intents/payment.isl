// ============================================================================
// Payment Entity - Core Payment Record
// ============================================================================

domain Payments {
  version: "1.0.0"
  
  // ==========================================================================
  // PAYMENT ENTITY
  // ==========================================================================
  
  entity Payment {
    // Core identifiers
    id: PaymentId [immutable, unique, indexed]
    idempotency_key: IdempotencyKey [unique, indexed, immutable]
    
    // Financial data
    amount: Amount
    currency: Currency
    captured_amount: Amount
    refunded_amount: Amount
    
    // Payment method (tokenized, PCI compliant)
    payment_method: PaymentMethodInfo
    
    // Status tracking
    status: PaymentStatus
    failure_code: PaymentErrorCode?
    failure_message: String?
    
    // Provider information
    provider: WebhookProvider
    provider_payment_id: String [indexed]
    provider_response: String? [internal]
    
    // Customer reference
    customer_id: UUID? [indexed]
    customer_email: Email?
    
    // Metadata
    description: String? { max_length: 500 }
    metadata: Map<String, String>?
    
    // Compliance
    pci_metadata: PCIMetadata
    fraud_signals: FraudSignals?
    
    // Audit timestamps
    created_at: Timestamp [immutable, indexed]
    updated_at: Timestamp
    authorized_at: Timestamp?
    captured_at: Timestamp?
    
    // =======================================================================
    // INVARIANTS
    // =======================================================================
    
    invariants {
      // Financial integrity
      captured_amount >= 0
      captured_amount <= amount
      refunded_amount >= 0
      refunded_amount <= captured_amount
      
      // Status consistency
      status == CAPTURED implies captured_amount > 0
      status == REFUNDED implies refunded_amount == captured_amount
      status == PARTIALLY_REFUNDED implies refunded_amount > 0 and refunded_amount < captured_amount
      status == AUTHORIZED implies captured_amount == 0
      
      // Timestamp ordering
      authorized_at != null implies authorized_at >= created_at
      captured_at != null implies captured_at >= authorized_at
      
      // PCI compliance - never store raw card data
      payment_method.Card implies payment_method.Card.token != null
    }
    
    // =======================================================================
    // LIFECYCLE STATE MACHINE
    // =======================================================================
    
    lifecycle {
      PENDING -> REQUIRES_ACTION
      PENDING -> PROCESSING
      PENDING -> FAILED
      PENDING -> CANCELED
      
      REQUIRES_ACTION -> PROCESSING
      REQUIRES_ACTION -> FAILED
      REQUIRES_ACTION -> CANCELED
      
      PROCESSING -> AUTHORIZED
      PROCESSING -> CAPTURED
      PROCESSING -> FAILED
      
      AUTHORIZED -> CAPTURED
      AUTHORIZED -> CANCELED
      AUTHORIZED -> FAILED
      
      CAPTURED -> PARTIALLY_REFUNDED
      CAPTURED -> REFUNDED
      CAPTURED -> DISPUTED
      
      PARTIALLY_REFUNDED -> REFUNDED
      PARTIALLY_REFUNDED -> DISPUTED
    }
  }
  
  // ==========================================================================
  // REFUND ENTITY
  // ==========================================================================
  
  entity Refund {
    id: UUID [immutable, unique, indexed]
    payment_id: PaymentId [references: Payment.id, indexed, immutable]
    idempotency_key: IdempotencyKey [unique, indexed, immutable]
    
    amount: Amount
    currency: Currency
    reason: String? { max_length: 500 }
    
    status: RefundStatus
    failure_code: RefundErrorCode?
    failure_message: String?
    
    provider_refund_id: String?
    
    created_at: Timestamp [immutable]
    updated_at: Timestamp
    completed_at: Timestamp?
    
    invariants {
      amount > 0
      completed_at != null implies status in [SUCCEEDED, FAILED]
    }
    
    lifecycle {
      PENDING -> PROCESSING
      PROCESSING -> SUCCEEDED
      PROCESSING -> FAILED
    }
  }
  
  // ==========================================================================
  // WEBHOOK EVENT ENTITY
  // ==========================================================================
  
  entity WebhookEvent {
    id: UUID [immutable, unique]
    provider: WebhookProvider
    event_type: WebhookEventType
    event_id: String [unique, indexed]
    
    payload: String [internal]
    signature: String [internal]
    signature_verified: Boolean
    
    payment_id: PaymentId? [references: Payment.id]
    refund_id: UUID? [references: Refund.id]
    
    processed: Boolean
    processing_error: String?
    retry_count: Int
    
    received_at: Timestamp [immutable]
    processed_at: Timestamp?
    
    invariants {
      retry_count >= 0
      retry_count <= 10
      processed implies processed_at != null
      signature_verified implies processed
    }
  }
  
  // ==========================================================================
  // IDEMPOTENCY RECORD
  // ==========================================================================
  
  entity IdempotencyRecord {
    key: IdempotencyKey [immutable, unique, indexed]
    request_hash: String [immutable]
    response: String
    payment_id: PaymentId? [references: Payment.id]
    
    created_at: Timestamp [immutable]
    expires_at: Timestamp [indexed]
    
    invariants {
      expires_at > created_at
    }
  }
}
