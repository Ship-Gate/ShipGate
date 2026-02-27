domain Payments

behavior ProcessPayment
  precondition: user.authenticated
  precondition: amount > 0
  
  intent: rate-limit-required
    description: "Protect against abuse with rate limiting"
  
  intent: audit-required
    description: "Log all payment attempts"
  
  intent: no-pii-logging
    description: "Never log card numbers or sensitive data"
  
  intent: input-validation
    description: "Validate all inputs with schema"
  
  postcondition: transaction.recorded
  postcondition: audit.logged
