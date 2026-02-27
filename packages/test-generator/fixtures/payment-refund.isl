// Payment domain fixture: Refund payment behavior
domain Payment {
  version: "1.0.0"
  
  entity Payment {
    id: UUID [immutable]
    amount: Decimal
    status: String
  }
  
  entity Refund {
    id: UUID [immutable]
    payment_id: UUID
    amount: Decimal
    status: String
    idempotency_key: String [unique]
  }
  
  behavior RefundPayment {
    description: "Refund a completed payment"
    
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
          when: "Payment is not in refundable state"
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
      }
    }
    
    preconditions {
      Payment.exists(input.payment_id)
      Payment.lookup(input.payment_id).status == "COMPLETED"
      input.amount == null or input.amount > 0
      input.amount == null or input.amount <= Payment.lookup(input.payment_id).amount
    }
    
    postconditions {
      success implies {
        Refund.exists(result.id)
        Refund.lookup(result.id).payment_id == input.payment_id
        Refund.lookup(result.id).status == "COMPLETED" or Refund.lookup(result.id).status == "PENDING"
      }
    }
  }
}
