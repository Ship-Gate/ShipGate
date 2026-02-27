// ============================================================================
// CapturePayment Behavior - Complete Authorized Payment
// ============================================================================

domain Payments {
  version: "1.0.0"
  
  behavior CapturePayment {
    description: "Capture an authorized payment to complete the transaction"
    
    // =======================================================================
    // ACTORS
    // =======================================================================
    
    actors {
      System { must: authenticated, api_key_valid }
      User { must: authenticated, permission: capture_payments }
    }
    
    // =======================================================================
    // INPUT
    // =======================================================================
    
    input {
      payment_id: PaymentId
      idempotency_key: IdempotencyKey
      
      amount: Amount?  // Optional: partial capture
      final_capture: Boolean = true  // If false, allows multiple partial captures
      
      metadata: Map<String, String>?
    }
    
    // =======================================================================
    // OUTPUT
    // =======================================================================
    
    output {
      success: Payment
      
      errors {
        PAYMENT_NOT_FOUND {
          when: "Payment ID does not exist"
          retriable: false
        }
        PAYMENT_NOT_AUTHORIZED {
          when: "Payment is not in AUTHORIZED status"
          retriable: false
          returns: { current_status: PaymentStatus }
        }
        CAPTURE_AMOUNT_EXCEEDS_AUTH {
          when: "Capture amount exceeds authorized amount"
          retriable: false
          returns: { authorized_amount: Amount, requested_amount: Amount }
        }
        AUTHORIZATION_EXPIRED {
          when: "Authorization has expired (typically 7 days)"
          retriable: false
          returns: { authorized_at: Timestamp, expired_at: Timestamp }
        }
        DUPLICATE_CAPTURE {
          when: "Payment already fully captured"
          retriable: false
          returns: { captured_at: Timestamp }
        }
        PROVIDER_ERROR {
          when: "Payment provider returned an error"
          retriable: true
          retry_after: 30.seconds
          returns: { provider_error_code: String }
        }
        IDEMPOTENCY_CONFLICT {
          when: "Concurrent capture request"
          retriable: true
          retry_after: 1.seconds
        }
      }
    }
    
    // =======================================================================
    // PRECONDITIONS
    // =======================================================================
    
    preconditions {
      Payment.exists(input.payment_id)
      Payment.lookup(input.payment_id).status == AUTHORIZED
      
      // Amount validation
      input.amount == null or input.amount > 0
      input.amount == null or input.amount <= Payment.lookup(input.payment_id).amount
      
      // Authorization not expired (7-day window typical)
      Payment.lookup(input.payment_id).authorized_at != null
      now() - Payment.lookup(input.payment_id).authorized_at <= 7.days
    }
    
    // =======================================================================
    // POSTCONDITIONS
    // =======================================================================
    
    postconditions {
      success implies {
        Payment.lookup(input.payment_id).status == CAPTURED
        Payment.lookup(input.payment_id).captured_at == now()
        Payment.lookup(input.payment_id).captured_amount == 
          if input.amount != null then input.amount 
          else Payment.lookup(input.payment_id).amount
        
        // Audit trail
        Payment.lookup(input.payment_id).updated_at == now()
      }
      
      CAPTURE_AMOUNT_EXCEEDS_AUTH implies {
        Payment.lookup(input.payment_id).status == old(Payment.lookup(input.payment_id).status)
        Payment.lookup(input.payment_id).captured_amount == old(Payment.lookup(input.payment_id).captured_amount)
      }
      
      any_error implies {
        Payment.lookup(input.payment_id).captured_amount == old(Payment.lookup(input.payment_id).captured_amount)
      }
    }
    
    // =======================================================================
    // INVARIANTS
    // =======================================================================
    
    invariants {
      // Can never capture more than authorized
      Payment.lookup(input.payment_id).captured_amount <= Payment.lookup(input.payment_id).amount
    }
    
    // =======================================================================
    // TEMPORAL REQUIREMENTS
    // =======================================================================
    
    temporal {
      response within 300.ms (p50)
      response within 1.seconds (p95)
      response within 3.seconds (p99)
      
      eventually within 30.seconds: provider_capture_confirmed
      eventually within 1.minute: webhook_event_sent
    }
    
    // =======================================================================
    // SECURITY
    // =======================================================================
    
    security {
      requires authentication
      requires permission capture_payments
      
      rate_limit 100/minute per api_key
      rate_limit 10/minute per payment_id
    }
    
    // =======================================================================
    // COMPLIANCE
    // =======================================================================
    
    compliance {
      pci_dss {
        audit_logging_required
        no_card_data_in_request
      }
    }
    
    // =======================================================================
    // OBSERVABILITY
    // =======================================================================
    
    observability {
      metrics {
        captures_total (counter) by [status, partial]
        capture_amount (histogram) by [currency]
        capture_latency_ms (histogram) by [provider]
        time_to_capture_hours (histogram)
      }
      
      traces {
        span "validate_payment"
        span "check_authorization_validity"
        span "call_provider_capture"
        span "update_payment_record"
        span "emit_webhook"
      }
      
      logs {
        on success: level INFO, include [payment_id, captured_amount, currency]
        on error: level ERROR, include [payment_id, error_code]
      }
    }
  }
  
  // ==========================================================================
  // SCENARIOS
  // ==========================================================================
  
  scenarios CapturePayment {
    scenario "successful full capture" {
      given {
        payment = CreatePayment(
          idempotency_key: "auth-for-capture",
          amount: 500.00,
          currency: "USD",
          payment_method_token: "pm_test_valid",
          capture: false  // Auth only
        )
        assert payment.status == AUTHORIZED
      }
      
      when {
        result = CapturePayment(
          payment_id: payment.id,
          idempotency_key: "capture-001"
        )
      }
      
      then {
        result is success
        result.payment.status == CAPTURED
        result.payment.captured_amount == 500.00
        result.payment.captured_at != null
      }
    }
    
    scenario "partial capture" {
      given {
        payment = CreatePayment(
          idempotency_key: "auth-partial",
          amount: 1000.00,
          currency: "USD",
          payment_method_token: "pm_test_valid",
          capture: false
        )
      }
      
      when {
        result = CapturePayment(
          payment_id: payment.id,
          idempotency_key: "capture-partial",
          amount: 750.00
        )
      }
      
      then {
        result is success
        result.payment.captured_amount == 750.00
        // Remaining 250 released back to cardholder
      }
    }
    
    scenario "capture already captured payment" {
      given {
        payment = CreatePayment(
          idempotency_key: "already-captured",
          amount: 100.00,
          currency: "USD",
          payment_method_token: "pm_test_valid",
          capture: true  // Auto-capture
        )
        assert payment.status == CAPTURED
      }
      
      when {
        result = CapturePayment(
          payment_id: payment.id,
          idempotency_key: "capture-again"
        )
      }
      
      then {
        result is PAYMENT_NOT_AUTHORIZED
        result.error.current_status == CAPTURED
      }
    }
    
    scenario "capture exceeds authorization" {
      given {
        payment = CreatePayment(
          idempotency_key: "auth-exceed",
          amount: 100.00,
          currency: "USD",
          payment_method_token: "pm_test_valid",
          capture: false
        )
      }
      
      when {
        result = CapturePayment(
          payment_id: payment.id,
          idempotency_key: "capture-exceed",
          amount: 150.00  // More than authorized
        )
      }
      
      then {
        result is CAPTURE_AMOUNT_EXCEEDS_AUTH
        result.error.authorized_amount == 100.00
        result.error.requested_amount == 150.00
      }
    }
    
    scenario "capture expired authorization" {
      given {
        payment = CreatePayment(
          idempotency_key: "auth-expired",
          amount: 100.00,
          currency: "USD",
          payment_method_token: "pm_test_valid",
          capture: false
        )
        // Simulate 8 days passing
        advance_time(8.days)
      }
      
      when {
        result = CapturePayment(
          payment_id: payment.id,
          idempotency_key: "capture-expired"
        )
      }
      
      then {
        result is AUTHORIZATION_EXPIRED
      }
    }
  }
  
  // ==========================================================================
  // CHAOS SCENARIOS
  // ==========================================================================
  
  chaos CapturePayment {
    chaos "provider timeout during capture" {
      inject {
        network_latency(
          target: StripeAPI,
          latency: 30.seconds,
          mode: TIMEOUT
        )
      }
      
      given {
        payment = CreatePayment(
          idempotency_key: "chaos-capture-timeout",
          amount: 100.00,
          currency: "USD",
          payment_method_token: "pm_test_valid",
          capture: false
        )
      }
      
      when {
        result = CapturePayment(
          payment_id: payment.id,
          idempotency_key: "capture-timeout"
        )
      }
      
      then {
        result is PROVIDER_ERROR
        // Payment remains in safe state
        Payment.lookup(payment.id).status in [AUTHORIZED, CAPTURED]
        // Reconciliation will resolve
        eventually within 5.minutes: status_reconciled
      }
    }
    
    chaos "concurrent capture requests" {
      given {
        payment = CreatePayment(
          idempotency_key: "chaos-concurrent-capture",
          amount: 100.00,
          currency: "USD",
          payment_method_token: "pm_test_valid",
          capture: false
        )
      }
      
      inject {
        concurrent_requests(
          count: 5,
          request: CapturePayment(
            payment_id: payment.id,
            idempotency_key: "capture-concurrent"
          )
        )
      }
      
      then {
        // Exactly one capture succeeds
        Payment.lookup(payment.id).captured_amount == 100.00
        count(responses where r is success) == 1
        count(responses where r is IDEMPOTENCY_CONFLICT or r is DUPLICATE_CAPTURE) == 4
      }
    }
  }
}
