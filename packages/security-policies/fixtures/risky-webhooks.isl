// RISKY: Webhook spec with security issues
// Used for testing security policy detection

domain RiskyWebhooks {
  version: "1.0.0"
  
  // RISKY: Webhook without signature verification
  behavior StripeWebhook {
    description: "Handle Stripe payment webhook"
    
    input {
      event_type: String
      payload: String
      // Missing: signature field
      // Missing: timestamp field
    }
    
    output {
      success: Boolean
      
      // Missing: proper error definitions for webhook failures
    }
    
    // Missing: signature verification
    // Missing: timestamp validation (replay protection)
    // Missing: idempotency handling
  }
  
  // RISKY: GitHub webhook without security
  behavior GithubWebhook {
    description: "Handle GitHub webhook events"
    
    input {
      action: String
      repository: String
      sender: String
      // Missing: signature header
    }
    
    output {
      success: Boolean
    }
    
    // Missing: signature verification
    // Missing: rate_limit
  }
  
  // RISKY: Generic event handler
  behavior HandleEvent {
    description: "Process incoming events"
    
    input {
      event_name: String
      data: String
    }
    
    output {
      success: Boolean
    }
    
    // Missing: signature verification
    // Missing: idempotency
    // Missing: error definitions
  }
  
  // RISKY: Payment callback
  behavior PaymentCallback {
    description: "Handle payment provider callback"
    
    input {
      payment_id: String
      status: String
      amount: Decimal
      // Missing: signature
      // Missing: timestamp
    }
    
    output {
      success: Boolean
    }
    
    // Missing: signature verification
    // Missing: replay protection
    // Missing: idempotency
  }
  
  // RISKY: Notification receiver
  behavior ReceiveNotification {
    description: "Receive webhook notifications"
    
    input {
      type: String
      message: String
    }
    
    output {
      success: Boolean
    }
    
    temporal {
      // Missing response time constraint
    }
    
    // Missing: signature verification
    // Missing: rate_limit
  }
}
