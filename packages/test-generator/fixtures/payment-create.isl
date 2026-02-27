// Payment domain fixture: Create payment behavior
domain Payment {
  version: "1.0.0"
  
  entity Payment {
    id: UUID [immutable]
    amount: Decimal
    currency: String
    status: String
    idempotency_key: String [unique]
    card_last_four: String?
    created_at: Timestamp [immutable]
  }
  
  behavior CreatePayment {
    description: "Create and process a payment"
    
    input {
      amount: Decimal
      currency: String
      idempotency_key: String
      card: {
        number: String
        expiry_month: Int
        expiry_year: Int
        cvv: String
      }
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
        INVALID_CARD {
          when: "Card number is invalid"
          retriable: false
        }
        EXPIRED_CARD {
          when: "Card has expired"
          retriable: false
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
        Payment.lookup(result.id).status == "COMPLETED" or Payment.lookup(result.id).status == "PROCESSING"
      }
      
      DUPLICATE_IDEMPOTENCY_KEY implies {
        Payment.count == old(Payment.count)
      }
    }
    
    invariants {
      input.card.number never_appears_in logs
      input.card.cvv never_appears_in logs
    }
  }
}
