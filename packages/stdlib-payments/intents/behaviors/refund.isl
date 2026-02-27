// ============================================================================
// RefundPayment Behavior - Reverse Completed Payment
// ============================================================================

domain Payments {
  version: "1.0.0"
  
  behavior RefundPayment {
    description: "Issue a full or partial refund for a captured payment"
    
    // =======================================================================
    // ACTORS
    // =======================================================================
    
    actors {
      System { must: authenticated, api_key_valid }
      User { must: authenticated, permission: issue_refunds }
      Support { must: authenticated, permission: issue_refunds, role: support }
    }
    
    // =======================================================================
    // INPUT
    // =======================================================================
    
    input {
      payment_id: PaymentId
      idempotency_key: IdempotencyKey
      
      amount: Amount?  // Optional: partial refund (null = full refund)
      reason: String? { max_length: 500 }
      
      metadata: Map<String, String>?
      
      // For support-initiated refunds
      support_ticket_id: String?
    }
    
    // =======================================================================
    // OUTPUT
    // =======================================================================
    
    output {
      success: Refund
      
      errors {
        PAYMENT_NOT_FOUND {
          when: "Payment ID does not exist"
          retriable: false
        }
        PAYMENT_NOT_REFUNDABLE {
          when: "Payment is not in a refundable status"
          retriable: false
          returns: { current_status: PaymentStatus, refundable_statuses: List<PaymentStatus> }
        }
        AMOUNT_EXCEEDS_AVAILABLE {
          when: "Refund amount exceeds available refundable amount"
          retriable: false
          returns: { 
            available_for_refund: Amount, 
            already_refunded: Amount, 
            requested: Amount 
          }
        }
        REFUND_WINDOW_EXPIRED {
          when: "Refund window has expired (typically 180 days)"
          retriable: false
          returns: { captured_at: Timestamp, refund_deadline: Timestamp }
        }
        REFUND_IN_PROGRESS {
          when: "Another refund is currently being processed"
          retriable: true
          retry_after: 5.seconds
        }
        PROVIDER_ERROR {
          when: "Payment provider returned an error"
          retriable: true
          retry_after: 30.seconds
          returns: { provider_error_code: String }
        }
        DUPLICATE_REFUND {
          when: "Idempotency key already used"
          retriable: false
          returns: { existing_refund: Refund }
        }
      }
    }
    
    // =======================================================================
    // PRECONDITIONS
    // =======================================================================
    
    preconditions {
      Payment.exists(input.payment_id)
      Payment.lookup(input.payment_id).status in [CAPTURED, PARTIALLY_REFUNDED]
      
      // Amount validation
      input.amount == null or input.amount > 0
      
      // Available amount check
      available = Payment.lookup(input.payment_id).captured_amount - 
                  Payment.lookup(input.payment_id).refunded_amount
      input.amount == null or input.amount <= available
      
      // Refund window (180 days typical)
      Payment.lookup(input.payment_id).captured_at != null
      now() - Payment.lookup(input.payment_id).captured_at <= 180.days
      
      // No pending refunds
      not Refund.exists(payment_id: input.payment_id, status: PENDING)
      not Refund.exists(payment_id: input.payment_id, status: PROCESSING)
    }
    
    // =======================================================================
    // POSTCONDITIONS
    // =======================================================================
    
    postconditions {
      success implies {
        // Refund created
        Refund.exists(result.id)
        Refund.lookup(result.id).payment_id == input.payment_id
        Refund.lookup(result.id).amount == 
          if input.amount != null then input.amount 
          else Payment.lookup(input.payment_id).captured_amount - old(Payment.lookup(input.payment_id).refunded_amount)
        
        // Payment updated
        Payment.lookup(input.payment_id).refunded_amount == 
          old(Payment.lookup(input.payment_id).refunded_amount) + result.amount
        
        // Status updated based on refund type
        full_refund implies Payment.lookup(input.payment_id).status == REFUNDED
        partial_refund implies Payment.lookup(input.payment_id).status == PARTIALLY_REFUNDED
        
        // Idempotency record
        IdempotencyRecord.exists(key: input.idempotency_key)
      }
      
      AMOUNT_EXCEEDS_AVAILABLE implies {
        Payment.lookup(input.payment_id).refunded_amount == old(Payment.lookup(input.payment_id).refunded_amount)
        Refund.count(payment_id: input.payment_id) == old(Refund.count(payment_id: input.payment_id))
      }
      
      any_error implies {
        Payment.lookup(input.payment_id).refunded_amount == old(Payment.lookup(input.payment_id).refunded_amount)
      }
    }
    
    // =======================================================================
    // INVARIANTS
    // =======================================================================
    
    invariants {
      // Total refunds can never exceed captured amount
      Payment.lookup(input.payment_id).refunded_amount <= Payment.lookup(input.payment_id).captured_amount
      
      // Sum of all refunds equals refunded_amount
      sum(Refund.amount where payment_id == input.payment_id and status == SUCCEEDED) == 
        Payment.lookup(input.payment_id).refunded_amount
    }
    
    // =======================================================================
    // TEMPORAL REQUIREMENTS
    // =======================================================================
    
    temporal {
      response within 500.ms (p50)
      response within 2.seconds (p95)
      response within 5.seconds (p99)
      
      eventually within 30.seconds: provider_refund_initiated
      eventually within 5.days: funds_returned_to_customer
      eventually within 1.minute: webhook_event_sent
      eventually within 10.seconds: customer_notification_sent
    }
    
    // =======================================================================
    // SECURITY
    // =======================================================================
    
    security {
      requires authentication
      requires permission issue_refunds
      
      // Stricter limits for refunds
      rate_limit 50/minute per api_key
      rate_limit 5/minute per payment_id
      rate_limit 100/hour per customer_id
      
      // Large refunds require additional auth
      requires two_factor_auth when input.amount > 1000
    }
    
    // =======================================================================
    // COMPLIANCE
    // =======================================================================
    
    compliance {
      pci_dss {
        audit_logging_required
        no_card_data_in_request
      }
      
      financial {
        refund_reason_required_over: 500
        support_ticket_required_over: 5000
      }
    }
    
    // =======================================================================
    // OBSERVABILITY
    // =======================================================================
    
    observability {
      metrics {
        refunds_total (counter) by [status, reason_category]
        refund_amount (histogram) by [currency]
        refund_latency_ms (histogram) by [provider]
        time_to_refund_days (histogram)
        refund_rate (gauge) by [merchant_id]
      }
      
      traces {
        span "validate_payment"
        span "check_refund_eligibility"
        span "calculate_refund_amount"
        span "call_provider_refund"
        span "update_payment_record"
        span "create_refund_record"
        span "emit_webhook"
        span "notify_customer"
      }
      
      logs {
        on success: level INFO, include [payment_id, refund_id, amount, reason]
        on error: level ERROR, include [payment_id, error_code]
      }
    }
  }
  
  // ==========================================================================
  // SCENARIOS
  // ==========================================================================
  
  scenarios RefundPayment {
    scenario "successful full refund" {
      given {
        payment = CreatePayment(
          idempotency_key: "refund-full-payment",
          amount: 100.00,
          currency: "USD",
          payment_method_token: "pm_test_valid",
          capture: true
        )
        assert payment.status == CAPTURED
      }
      
      when {
        result = RefundPayment(
          payment_id: payment.id,
          idempotency_key: "refund-full-001",
          reason: "Customer request"
        )
      }
      
      then {
        result is success
        result.refund.amount == 100.00
        result.refund.status == SUCCEEDED
        Payment.lookup(payment.id).status == REFUNDED
        Payment.lookup(payment.id).refunded_amount == 100.00
      }
    }
    
    scenario "successful partial refund" {
      given {
        payment = CreatePayment(
          idempotency_key: "refund-partial-payment",
          amount: 500.00,
          currency: "USD",
          payment_method_token: "pm_test_valid",
          capture: true
        )
      }
      
      when {
        result = RefundPayment(
          payment_id: payment.id,
          idempotency_key: "refund-partial-001",
          amount: 150.00,
          reason: "Partial order cancellation"
        )
      }
      
      then {
        result is success
        result.refund.amount == 150.00
        Payment.lookup(payment.id).status == PARTIALLY_REFUNDED
        Payment.lookup(payment.id).refunded_amount == 150.00
        // 350 still available for refund
      }
    }
    
    scenario "multiple partial refunds" {
      given {
        payment = CreatePayment(
          idempotency_key: "multi-refund-payment",
          amount: 300.00,
          currency: "USD",
          payment_method_token: "pm_test_valid",
          capture: true
        )
        
        refund1 = RefundPayment(
          payment_id: payment.id,
          idempotency_key: "refund-part-1",
          amount: 100.00
        )
      }
      
      when {
        result = RefundPayment(
          payment_id: payment.id,
          idempotency_key: "refund-part-2",
          amount: 100.00
        )
      }
      
      then {
        result is success
        Payment.lookup(payment.id).refunded_amount == 200.00
        Payment.lookup(payment.id).status == PARTIALLY_REFUNDED
        Refund.count(payment_id: payment.id, status: SUCCEEDED) == 2
      }
    }
    
    scenario "refund exceeds available" {
      given {
        payment = CreatePayment(
          idempotency_key: "refund-exceed-payment",
          amount: 100.00,
          currency: "USD",
          payment_method_token: "pm_test_valid",
          capture: true
        )
        
        partial = RefundPayment(
          payment_id: payment.id,
          idempotency_key: "refund-first",
          amount: 75.00
        )
      }
      
      when {
        result = RefundPayment(
          payment_id: payment.id,
          idempotency_key: "refund-exceed",
          amount: 50.00  // Only 25 available
        )
      }
      
      then {
        result is AMOUNT_EXCEEDS_AVAILABLE
        result.error.available_for_refund == 25.00
        result.error.already_refunded == 75.00
        result.error.requested == 50.00
      }
    }
    
    scenario "refund unauthorized payment" {
      given {
        payment = CreatePayment(
          idempotency_key: "refund-auth-payment",
          amount: 100.00,
          currency: "USD",
          payment_method_token: "pm_test_valid",
          capture: false  // Auth only, not captured
        )
        assert payment.status == AUTHORIZED
      }
      
      when {
        result = RefundPayment(
          payment_id: payment.id,
          idempotency_key: "refund-auth"
        )
      }
      
      then {
        result is PAYMENT_NOT_REFUNDABLE
        result.error.current_status == AUTHORIZED
        result.error.refundable_statuses contains CAPTURED
      }
    }
    
    scenario "refund window expired" {
      given {
        payment = CreatePayment(
          idempotency_key: "refund-expired-payment",
          amount: 100.00,
          currency: "USD",
          payment_method_token: "pm_test_valid",
          capture: true
        )
        // Simulate 200 days passing
        advance_time(200.days)
      }
      
      when {
        result = RefundPayment(
          payment_id: payment.id,
          idempotency_key: "refund-expired"
        )
      }
      
      then {
        result is REFUND_WINDOW_EXPIRED
      }
    }
  }
  
  // ==========================================================================
  // CHAOS SCENARIOS
  // ==========================================================================
  
  chaos RefundPayment {
    chaos "provider fails during refund" {
      inject {
        service_unavailable(
          target: StripeAPI,
          duration: 10.seconds
        )
      }
      
      given {
        payment = CreatePayment(
          idempotency_key: "chaos-refund-payment",
          amount: 100.00,
          currency: "USD",
          payment_method_token: "pm_test_valid",
          capture: true
        )
      }
      
      when {
        result = RefundPayment(
          payment_id: payment.id,
          idempotency_key: "chaos-refund"
        )
      }
      
      then {
        result is PROVIDER_ERROR
        // Payment state unchanged
        Payment.lookup(payment.id).refunded_amount == 0
        // Refund created but in failed state
        Refund.exists(idempotency_key: "chaos-refund")
        Refund.lookup(idempotency_key: "chaos-refund").status == FAILED
      }
    }
    
    chaos "concurrent refund requests" {
      given {
        payment = CreatePayment(
          idempotency_key: "chaos-concurrent-refund-payment",
          amount: 100.00,
          currency: "USD",
          payment_method_token: "pm_test_valid",
          capture: true
        )
      }
      
      inject {
        concurrent_requests(
          count: 5,
          request: RefundPayment(
            payment_id: payment.id,
            idempotency_key: "concurrent-refund",
            amount: 100.00
          )
        )
      }
      
      then {
        // Exactly one refund succeeds
        Payment.lookup(payment.id).refunded_amount == 100.00
        Refund.count(payment_id: payment.id, status: SUCCEEDED) == 1
      }
    }
    
    chaos "partial failure leaves consistent state" {
      inject {
        database_failure(
          target: RefundRepository,
          mode: TIMEOUT,
          after_operations: 1
        )
      }
      
      given {
        payment = CreatePayment(
          idempotency_key: "chaos-partial-refund-payment",
          amount: 100.00,
          currency: "USD",
          payment_method_token: "pm_test_valid",
          capture: true
        )
      }
      
      when {
        result = RefundPayment(
          payment_id: payment.id,
          idempotency_key: "chaos-partial-refund"
        )
      }
      
      then {
        // Either fully succeeded or fully failed
        Payment.lookup(payment.id).refunded_amount == 100.00 or
        Payment.lookup(payment.id).refunded_amount == 0
        
        // No orphan states
        Payment.lookup(payment.id).refunded_amount == 
          sum(Refund.amount where payment_id == payment.id and status == SUCCEEDED)
      }
    }
  }
}
