// RISKY: Payment spec with security issues
// Used for testing security policy detection

domain RiskyPayments {
  version: "1.0.0"
  
  entity Transaction {
    id: UUID [immutable]
    user_id: UUID
    amount: Decimal
    card_number: String  // Missing [secret] for card data
    cvv: String  // Missing [secret] for CVV
    status: String
  }
  
  // RISKY: Payment without auth
  behavior ProcessPayment {
    description: "Process a payment"
    
    input {
      amount: Decimal
      currency: String
      card_number: String  // Missing [secret]
      card_expiry: String
      cvv: String  // Missing [secret]
    }
    
    output {
      success: {
        transaction_id: UUID
        status: String
      }
      
      errors {
        PAYMENT_FAILED { when: "Payment declined" retriable: true }
      }
    }
    
    // Missing: requires authenticated
    // Missing: rate_limit
    // Missing: fraud_check
    // Missing: amount validation (> 0)
    // Missing: PCI compliance declaration
  }
  
  // RISKY: Refund without auth
  behavior ProcessRefund {
    description: "Process a refund"
    
    input {
      transaction_id: UUID
      amount: Decimal  // No validation
    }
    
    output {
      success: Boolean
    }
    
    // Missing: requires authenticated
    // Missing: rate_limit
    // Missing: amount validation
  }
  
  // RISKY: Transfer without security
  behavior TransferFunds {
    description: "Transfer money between accounts"
    
    input {
      from_account: String
      to_account: String
      amount: Decimal  // No validation that amount > 0
    }
    
    output {
      success: UUID
    }
    
    // Missing: requires authenticated
    // Missing: rate_limit
    // Missing: fraud_check
    // Missing: amount validation
  }
  
  // RISKY: Subscription with card data
  behavior CreateSubscription {
    description: "Create recurring subscription"
    
    input {
      plan_id: String
      card_number: String  // Missing [secret]
      billing_address: String  // PII without annotation
    }
    
    output {
      success: {
        subscription_id: UUID
      }
    }
    
    // Missing: requires authenticated
    // Missing: rate_limit
    // Missing: PCI compliance
  }
}
