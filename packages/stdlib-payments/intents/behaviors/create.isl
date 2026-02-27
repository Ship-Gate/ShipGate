// ============================================================================
// CreatePayment Behavior - Initiate Payment with Idempotency
// ============================================================================

domain Payments {
  version: "1.0.0"
  
  behavior CreatePayment {
    description: "Initiate a new payment with idempotency guarantees"
    
    // =======================================================================
    // ACTORS
    // =======================================================================
    
    actors {
      System { must: authenticated, api_key_valid }
      User { must: authenticated }
    }
    
    // =======================================================================
    // INPUT
    // =======================================================================
    
    input {
      idempotency_key: IdempotencyKey
      amount: Amount { min: 0.01, max: 999999.99 }
      currency: Currency
      payment_method_token: PaymentMethodToken [sensitive]
      
      customer_id: UUID?
      customer_email: Email?
      description: String? { max_length: 500 }
      metadata: Map<String, String>?
      
      capture: Boolean = true  // Auto-capture or auth-only
      
      // Fraud prevention
      client_ip: String? [pii]
      device_fingerprint: String?
    }
    
    // =======================================================================
    // OUTPUT
    // =======================================================================
    
    output {
      success: Payment
      
      errors {
        DUPLICATE_REQUEST {
          when: "Idempotency key already used with different parameters"
          retriable: false
          returns: { existing_payment: Payment }
        }
        IDEMPOTENCY_CONFLICT {
          when: "Concurrent request with same idempotency key"
          retriable: true
          retry_after: 1.seconds
        }
        INVALID_PAYMENT_METHOD {
          when: "Payment method token invalid or expired"
          retriable: false
        }
        CARD_DECLINED {
          when: "Card was declined by issuer"
          retriable: false
          returns: { decline_code: String, decline_message: String }
        }
        INSUFFICIENT_FUNDS {
          when: "Card has insufficient funds"
          retriable: true
          retry_after: 1.hours
        }
        FRAUD_DETECTED {
          when: "Transaction flagged as potentially fraudulent"
          retriable: false
          returns: { risk_score: Decimal, risk_factors: List<String> }
        }
        AUTHENTICATION_REQUIRED {
          when: "3D Secure or SCA required"
          retriable: true
          returns: { action_url: String, action_type: String }
        }
        CURRENCY_NOT_SUPPORTED {
          when: "Currency not supported for this payment method"
          retriable: false
        }
        AMOUNT_LIMIT_EXCEEDED {
          when: "Amount exceeds per-transaction limit"
          retriable: false
          returns: { max_amount: Amount }
        }
        PROVIDER_UNAVAILABLE {
          when: "Payment provider temporarily unavailable"
          retriable: true
          retry_after: 30.seconds
        }
        RATE_LIMITED {
          when: "Too many requests"
          retriable: true
          retry_after: 60.seconds
        }
      }
    }
    
    // =======================================================================
    // PRECONDITIONS
    // =======================================================================
    
    preconditions {
      input.amount > 0
      input.currency.length == 3
      input.payment_method_token.is_valid
      input.idempotency_key.length >= 1
      
      // If customer_id provided, must exist
      input.customer_id == null or Customer.exists(input.customer_id)
    }
    
    // =======================================================================
    // POSTCONDITIONS
    // =======================================================================
    
    postconditions {
      success implies {
        // Payment created
        Payment.exists(result.id)
        Payment.lookup(result.id).amount == input.amount
        Payment.lookup(result.id).currency == input.currency
        Payment.lookup(result.id).idempotency_key == input.idempotency_key
        
        // Status based on capture mode
        input.capture implies Payment.lookup(result.id).status in [CAPTURED, PROCESSING]
        not input.capture implies Payment.lookup(result.id).status in [AUTHORIZED, PROCESSING]
        
        // Idempotency record created
        IdempotencyRecord.exists(key: input.idempotency_key)
        IdempotencyRecord.lookup(key: input.idempotency_key).payment_id == result.id
        
        // PCI compliance - no raw card data stored
        Payment.lookup(result.id).payment_method.token != null
      }
      
      DUPLICATE_REQUEST implies {
        // Returns existing payment, no new payment created
        Payment.count == old(Payment.count)
        IdempotencyRecord.lookup(key: input.idempotency_key).payment_id == error.existing_payment.id
      }
      
      any_error implies {
        // Atomicity - no partial state
        not Payment.exists(idempotency_key: input.idempotency_key) or
        Payment.lookup(idempotency_key: input.idempotency_key).status == FAILED
      }
    }
    
    // =======================================================================
    // INVARIANTS
    // =======================================================================
    
    invariants {
      // PCI DSS: Never log or store raw card numbers
      input.payment_method_token never_appears_in logs
      
      // Idempotency guarantee
      concurrent_requests_same_key implies exactly_one_payment_created
    }
    
    // =======================================================================
    // TEMPORAL REQUIREMENTS
    // =======================================================================
    
    temporal {
      response within 500.ms (p50)
      response within 2.seconds (p95)
      response within 5.seconds (p99)
      
      eventually within 10.seconds: payment_provider_notified
      eventually within 1.minute: webhook_event_recorded
      eventually within 5.minutes: fraud_check_completed
    }
    
    // =======================================================================
    // SECURITY
    // =======================================================================
    
    security {
      requires authentication
      requires api_key or user_session
      
      rate_limit 100/minute per api_key
      rate_limit 10/minute per customer_id
      rate_limit 1000/minute per ip_address
      
      fraud_check {
        velocity_check: 5 transactions per card per hour
        amount_threshold: 10000
        geo_check: enabled
      }
    }
    
    // =======================================================================
    // COMPLIANCE
    // =======================================================================
    
    compliance {
      pci_dss {
        // Requirement 3: Protect stored cardholder data
        no_pan_storage
        no_cvv_storage
        tokenization_required
        
        // Requirement 4: Encrypt transmission
        tls_1_2_minimum
        
        // Requirement 10: Track and monitor access
        audit_logging_required
      }
      
      soc2 {
        audit_trail_required
        encryption_at_rest
      }
    }
    
    // =======================================================================
    // OBSERVABILITY
    // =======================================================================
    
    observability {
      metrics {
        payments_created_total (counter) by [status, currency, payment_method_type]
        payment_amount (histogram) by [currency]
        payment_latency_ms (histogram) by [provider, status]
        fraud_score (histogram)
      }
      
      traces {
        span "validate_input"
        span "check_idempotency"
        span "tokenize_payment_method"
        span "fraud_check"
        span "call_provider"
        span "persist_payment"
        span "emit_webhook"
      }
      
      logs {
        on success: level INFO, include [payment_id, amount, currency, status]
        on error: level ERROR, include [error_code, idempotency_key]
        exclude [payment_method_token, card_number, cvv]
      }
    }
  }
  
  // ==========================================================================
  // SCENARIOS
  // ==========================================================================
  
  scenarios CreatePayment {
    scenario "successful payment with auto-capture" {
      given {
        valid_token = PaymentMethodToken("pm_test_valid_card")
        initial_count = Payment.count
      }
      
      when {
        result = CreatePayment(
          idempotency_key: "idem-001",
          amount: 100.00,
          currency: "USD",
          payment_method_token: valid_token,
          capture: true
        )
      }
      
      then {
        result is success
        result.payment.amount == 100.00
        result.payment.status == CAPTURED
        Payment.count == initial_count + 1
      }
    }
    
    scenario "auth-only payment" {
      given {
        valid_token = PaymentMethodToken("pm_test_valid_card")
      }
      
      when {
        result = CreatePayment(
          idempotency_key: "idem-auth-001",
          amount: 500.00,
          currency: "USD",
          payment_method_token: valid_token,
          capture: false
        )
      }
      
      then {
        result is success
        result.payment.status == AUTHORIZED
        result.payment.captured_amount == 0
      }
    }
    
    scenario "idempotent duplicate request" {
      given {
        existing = CreatePayment(
          idempotency_key: "idem-dupe",
          amount: 100.00,
          currency: "USD",
          payment_method_token: "pm_test_valid",
          capture: true
        )
      }
      
      when {
        result = CreatePayment(
          idempotency_key: "idem-dupe",
          amount: 100.00,
          currency: "USD",
          payment_method_token: "pm_test_valid",
          capture: true
        )
      }
      
      then {
        // Same idempotency key + same params = return existing
        result is success
        result.payment.id == existing.payment.id
        Payment.count == old(Payment.count)
      }
    }
    
    scenario "idempotency conflict with different params" {
      given {
        existing = CreatePayment(
          idempotency_key: "idem-conflict",
          amount: 100.00,
          currency: "USD",
          payment_method_token: "pm_test_valid",
          capture: true
        )
      }
      
      when {
        result = CreatePayment(
          idempotency_key: "idem-conflict",
          amount: 200.00,  // Different amount!
          currency: "USD",
          payment_method_token: "pm_test_valid",
          capture: true
        )
      }
      
      then {
        result is DUPLICATE_REQUEST
        result.error.existing_payment.id == existing.payment.id
      }
    }
    
    scenario "card declined" {
      given {
        declined_token = PaymentMethodToken("pm_test_declined")
      }
      
      when {
        result = CreatePayment(
          idempotency_key: "idem-decline",
          amount: 100.00,
          currency: "USD",
          payment_method_token: declined_token,
          capture: true
        )
      }
      
      then {
        result is CARD_DECLINED
        result.error.decline_code != null
      }
    }
    
    scenario "3D Secure required" {
      given {
        threeds_token = PaymentMethodToken("pm_test_3ds_required")
      }
      
      when {
        result = CreatePayment(
          idempotency_key: "idem-3ds",
          amount: 1000.00,
          currency: "EUR",
          payment_method_token: threeds_token,
          capture: true
        )
      }
      
      then {
        result is AUTHENTICATION_REQUIRED
        result.error.action_url != null
        result.error.action_type == "3ds"
      }
    }
  }
  
  // ==========================================================================
  // CHAOS SCENARIOS
  // ==========================================================================
  
  chaos CreatePayment {
    chaos "payment provider timeout" {
      inject {
        network_latency(
          target: StripeAPI,
          latency: 30.seconds,
          mode: TIMEOUT
        )
      }
      
      when {
        result = CreatePayment(
          idempotency_key: "chaos-timeout",
          amount: 100.00,
          currency: "USD",
          payment_method_token: "pm_test_valid",
          capture: true
        )
      }
      
      then {
        result is PROVIDER_UNAVAILABLE
        Payment.count == old(Payment.count) or
        Payment.lookup(idempotency_key: "chaos-timeout").status == PENDING
      }
    }
    
    chaos "database failure during persist" {
      inject {
        database_failure(
          target: PaymentRepository,
          mode: UNAVAILABLE,
          duration: 5.seconds
        )
      }
      
      when {
        result = CreatePayment(
          idempotency_key: "chaos-db",
          amount: 100.00,
          currency: "USD",
          payment_method_token: "pm_test_valid",
          capture: true
        )
      }
      
      then {
        result is error
        // No orphan payments at provider without local record
        eventually within 1.minute: reconciliation_check_triggered
      }
    }
    
    chaos "concurrent duplicate requests" {
      inject {
        concurrent_requests(
          count: 10,
          request: CreatePayment(
            idempotency_key: "chaos-concurrent",
            amount: 100.00,
            currency: "USD",
            payment_method_token: "pm_test_valid",
            capture: true
          )
        )
      }
      
      then {
        // Exactly one payment created
        Payment.count(idempotency_key: "chaos-concurrent") == 1
        
        // All requests either succeed with same payment or get IDEMPOTENCY_CONFLICT
        all(responses, r => r is success or r is IDEMPOTENCY_CONFLICT)
      }
    }
    
    chaos "provider returns inconsistent state" {
      inject {
        service_unavailable(
          target: StripeAPI,
          mode: PARTIAL_FAILURE,
          failure_rate: 0.5
        )
      }
      
      when {
        result = CreatePayment(
          idempotency_key: "chaos-inconsistent",
          amount: 100.00,
          currency: "USD",
          payment_method_token: "pm_test_valid",
          capture: true
        )
      }
      
      then {
        // System eventually reaches consistent state
        eventually within 5.minutes: Payment.lookup(idempotency_key: "chaos-inconsistent").status in [CAPTURED, FAILED]
      }
    }
    
    chaos "high fraud score during payment" {
      inject {
        fraud_signal(
          risk_score: 95,
          risk_level: CRITICAL
        )
      }
      
      when {
        result = CreatePayment(
          idempotency_key: "chaos-fraud",
          amount: 5000.00,
          currency: "USD",
          payment_method_token: "pm_test_valid",
          capture: true
        )
      }
      
      then {
        result is FRAUD_DETECTED
        result.error.risk_score >= 90
        Payment.count == old(Payment.count)
      }
    }
  }
}
