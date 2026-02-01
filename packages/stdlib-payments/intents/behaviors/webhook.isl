// ============================================================================
// ProcessWebhook Behavior - Handle Payment Provider Webhooks
// ============================================================================

domain Payments {
  version: "1.0.0"
  
  behavior ProcessWebhook {
    description: "Process and validate incoming webhooks from payment providers"
    
    // =======================================================================
    // ACTORS
    // =======================================================================
    
    actors {
      PaymentProvider { must: valid_signature }
    }
    
    // =======================================================================
    // INPUT
    // =======================================================================
    
    input {
      provider: WebhookProvider
      event_id: String
      event_type: String
      signature: String [sensitive]
      timestamp: Timestamp
      payload: String [internal]
      
      // Request metadata for verification
      headers: Map<String, String>
    }
    
    // =======================================================================
    // OUTPUT
    // =======================================================================
    
    output {
      success: WebhookEvent
      
      errors {
        INVALID_SIGNATURE {
          when: "Webhook signature verification failed"
          retriable: false
        }
        UNKNOWN_PROVIDER {
          when: "Webhook provider not recognized"
          retriable: false
        }
        DUPLICATE_EVENT {
          when: "Event has already been processed"
          retriable: false
          returns: { processed_at: Timestamp }
        }
        MALFORMED_PAYLOAD {
          when: "Payload cannot be parsed"
          retriable: false
          returns: { parse_error: String }
        }
        PAYMENT_NOT_FOUND {
          when: "Referenced payment does not exist"
          retriable: true
          retry_after: 5.seconds
        }
        STALE_EVENT {
          when: "Event is older than tolerance window"
          retriable: false
          returns: { event_timestamp: Timestamp, tolerance: Duration }
        }
        PROCESSING_ERROR {
          when: "Error while processing event"
          retriable: true
          retry_after: 30.seconds
        }
      }
    }
    
    // =======================================================================
    // PRECONDITIONS
    // =======================================================================
    
    preconditions {
      input.provider in [STRIPE, BRAINTREE, ADYEN, SQUARE]
      input.event_id.length > 0
      input.signature.length > 0
      input.payload.length > 0
      
      // Timestamp tolerance (5 minute window for replay protection)
      abs(now() - input.timestamp) <= 5.minutes
      
      // Not already processed (idempotency)
      not WebhookEvent.exists(event_id: input.event_id, provider: input.provider)
    }
    
    // =======================================================================
    // POSTCONDITIONS
    // =======================================================================
    
    postconditions {
      success implies {
        // Event recorded
        WebhookEvent.exists(result.id)
        WebhookEvent.lookup(result.id).event_id == input.event_id
        WebhookEvent.lookup(result.id).provider == input.provider
        WebhookEvent.lookup(result.id).signature_verified == true
        WebhookEvent.lookup(result.id).processed == true
        
        // Payment state updated based on event type
        input.event_type == "payment_intent.succeeded" implies {
          WebhookEvent.lookup(result.id).payment_id != null
          Payment.lookup(result.payment_id).status == CAPTURED
        }
        
        input.event_type == "payment_intent.payment_failed" implies {
          WebhookEvent.lookup(result.id).payment_id != null
          Payment.lookup(result.payment_id).status == FAILED
        }
        
        input.event_type == "charge.refunded" implies {
          WebhookEvent.lookup(result.id).payment_id != null
          Payment.lookup(result.payment_id).status in [PARTIALLY_REFUNDED, REFUNDED]
        }
        
        input.event_type == "charge.dispute.created" implies {
          WebhookEvent.lookup(result.id).payment_id != null
          Payment.lookup(result.payment_id).status == DISPUTED
        }
      }
      
      DUPLICATE_EVENT implies {
        // Idempotent - no state change
        WebhookEvent.lookup(event_id: input.event_id).processed == true
      }
      
      INVALID_SIGNATURE implies {
        // Never process unverified events
        not WebhookEvent.exists(event_id: input.event_id, signature_verified: true)
      }
      
      any_error implies {
        // Failed event recorded for debugging
        WebhookEvent.exists(event_id: input.event_id) implies
          WebhookEvent.lookup(event_id: input.event_id).processing_error != null
      }
    }
    
    // =======================================================================
    // INVARIANTS
    // =======================================================================
    
    invariants {
      // Never process events with invalid signatures
      WebhookEvent.lookup(result.id).processed implies WebhookEvent.lookup(result.id).signature_verified
      
      // Event ordering - don't process older events for same payment after newer ones
      no_out_of_order_events
    }
    
    // =======================================================================
    // TEMPORAL REQUIREMENTS
    // =======================================================================
    
    temporal {
      // Webhooks must respond quickly
      response within 100.ms (p50)
      response within 500.ms (p95)
      response within 2.seconds (p99)
      
      // Background processing
      eventually within 10.seconds: payment_status_updated
      eventually within 1.minute: internal_notifications_sent
    }
    
    // =======================================================================
    // SECURITY
    // =======================================================================
    
    security {
      // Signature verification per provider
      verify_signature {
        STRIPE: verify_stripe_signature(input.payload, input.signature, stripe_webhook_secret)
        BRAINTREE: verify_braintree_signature(input.payload, input.signature, braintree_webhook_secret)
        ADYEN: verify_adyen_signature(input.payload, input.signature, adyen_webhook_secret)
        SQUARE: verify_square_signature(input.payload, input.signature, square_webhook_secret)
      }
      
      // Rate limiting per provider
      rate_limit 1000/minute per provider
      rate_limit 100/second per ip_address
      
      // IP allowlisting
      require_ip_allowlist per provider
    }
    
    // =======================================================================
    // COMPLIANCE
    // =======================================================================
    
    compliance {
      pci_dss {
        // Log webhook receipt but not raw payload
        audit_logging_required
        mask_sensitive_payload_fields
      }
    }
    
    // =======================================================================
    // OBSERVABILITY
    // =======================================================================
    
    observability {
      metrics {
        webhooks_received_total (counter) by [provider, event_type]
        webhooks_processed_total (counter) by [provider, event_type, status]
        webhook_processing_latency_ms (histogram) by [provider, event_type]
        webhook_signature_failures_total (counter) by [provider]
        webhook_duplicate_rate (gauge) by [provider]
      }
      
      traces {
        span "verify_signature"
        span "parse_payload"
        span "check_duplicate"
        span "lookup_payment"
        span "update_payment_status"
        span "record_event"
        span "send_internal_notifications"
      }
      
      logs {
        on success: level INFO, include [event_id, provider, event_type, payment_id]
        on error: level ERROR, include [event_id, provider, error_code]
        exclude [payload, signature]
      }
    }
  }
  
  // ==========================================================================
  // WEBHOOK EVENT TYPE MAPPINGS
  // ==========================================================================
  
  mapping StripeEventTypes {
    "payment_intent.created" -> PAYMENT_CREATED
    "payment_intent.succeeded" -> PAYMENT_CAPTURED
    "payment_intent.payment_failed" -> PAYMENT_FAILED
    "payment_intent.requires_action" -> PAYMENT_REQUIRES_ACTION
    "charge.refunded" -> PAYMENT_REFUNDED
    "charge.dispute.created" -> PAYMENT_DISPUTED
    "charge.dispute.closed" -> PAYMENT_DISPUTE_CLOSED
  }
  
  mapping BraintreeEventTypes {
    "transaction.settled" -> PAYMENT_CAPTURED
    "transaction.settlement_declined" -> PAYMENT_FAILED
    "transaction.voided" -> PAYMENT_CANCELED
    "refund.succeeded" -> REFUND_SUCCEEDED
    "refund.failed" -> REFUND_FAILED
    "dispute.opened" -> PAYMENT_DISPUTED
  }
  
  // ==========================================================================
  // SCENARIOS
  // ==========================================================================
  
  scenarios ProcessWebhook {
    scenario "successful Stripe payment webhook" {
      given {
        payment = CreatePayment(
          idempotency_key: "webhook-test-payment",
          amount: 100.00,
          currency: "USD",
          payment_method_token: "pm_test_valid",
          capture: true
        )
        
        valid_signature = generate_stripe_signature(
          payload: stripe_success_payload(payment.provider_payment_id),
          secret: test_stripe_webhook_secret
        )
      }
      
      when {
        result = ProcessWebhook(
          provider: STRIPE,
          event_id: "evt_test_123",
          event_type: "payment_intent.succeeded",
          signature: valid_signature,
          timestamp: now(),
          payload: stripe_success_payload(payment.provider_payment_id),
          headers: {}
        )
      }
      
      then {
        result is success
        result.event.signature_verified == true
        result.event.processed == true
        Payment.lookup(payment.id).status == CAPTURED
      }
    }
    
    scenario "invalid signature rejected" {
      when {
        result = ProcessWebhook(
          provider: STRIPE,
          event_id: "evt_invalid_sig",
          event_type: "payment_intent.succeeded",
          signature: "invalid_signature_abc123",
          timestamp: now(),
          payload: "{}",
          headers: {}
        )
      }
      
      then {
        result is INVALID_SIGNATURE
        not WebhookEvent.exists(event_id: "evt_invalid_sig", signature_verified: true)
      }
    }
    
    scenario "duplicate event handled idempotently" {
      given {
        first_result = ProcessWebhook(
          provider: STRIPE,
          event_id: "evt_duplicate",
          event_type: "payment_intent.succeeded",
          signature: valid_signature,
          timestamp: now(),
          payload: valid_payload,
          headers: {}
        )
        assert first_result is success
      }
      
      when {
        result = ProcessWebhook(
          provider: STRIPE,
          event_id: "evt_duplicate",  // Same event ID
          event_type: "payment_intent.succeeded",
          signature: valid_signature,
          timestamp: now(),
          payload: valid_payload,
          headers: {}
        )
      }
      
      then {
        result is DUPLICATE_EVENT
        result.error.processed_at != null
        // Only one event recorded
        WebhookEvent.count(event_id: "evt_duplicate") == 1
      }
    }
    
    scenario "stale event rejected" {
      when {
        result = ProcessWebhook(
          provider: STRIPE,
          event_id: "evt_stale",
          event_type: "payment_intent.succeeded",
          signature: valid_signature,
          timestamp: now() - 10.minutes,  // Too old
          payload: valid_payload,
          headers: {}
        )
      }
      
      then {
        result is STALE_EVENT
        result.error.tolerance == 5.minutes
      }
    }
    
    scenario "refund webhook updates payment" {
      given {
        payment = CreatePayment(
          idempotency_key: "webhook-refund-payment",
          amount: 100.00,
          currency: "USD",
          payment_method_token: "pm_test_valid",
          capture: true
        )
        assert payment.status == CAPTURED
      }
      
      when {
        result = ProcessWebhook(
          provider: STRIPE,
          event_id: "evt_refund",
          event_type: "charge.refunded",
          signature: valid_signature,
          timestamp: now(),
          payload: stripe_refund_payload(payment.provider_payment_id, 100.00),
          headers: {}
        )
      }
      
      then {
        result is success
        Payment.lookup(payment.id).status == REFUNDED
        Payment.lookup(payment.id).refunded_amount == 100.00
      }
    }
    
    scenario "dispute webhook updates payment" {
      given {
        payment = CreatePayment(
          idempotency_key: "webhook-dispute-payment",
          amount: 500.00,
          currency: "USD",
          payment_method_token: "pm_test_valid",
          capture: true
        )
      }
      
      when {
        result = ProcessWebhook(
          provider: STRIPE,
          event_id: "evt_dispute",
          event_type: "charge.dispute.created",
          signature: valid_signature,
          timestamp: now(),
          payload: stripe_dispute_payload(payment.provider_payment_id),
          headers: {}
        )
      }
      
      then {
        result is success
        Payment.lookup(payment.id).status == DISPUTED
        // Alert triggered for disputed payments
        eventually within 1.minute: dispute_alert_sent
      }
    }
  }
  
  // ==========================================================================
  // CHAOS SCENARIOS
  // ==========================================================================
  
  chaos ProcessWebhook {
    chaos "webhook flood" {
      inject {
        concurrent_requests(
          count: 1000,
          request: ProcessWebhook(
            provider: STRIPE,
            event_id: unique_id(),
            event_type: "payment_intent.succeeded",
            signature: valid_signature,
            timestamp: now(),
            payload: valid_payload,
            headers: {}
          )
        )
      }
      
      then {
        // All events processed or queued
        all(responses, r => r is success or r is PROCESSING_ERROR)
        // No events lost
        eventually within 5.minutes: all_events_processed
      }
    }
    
    chaos "database failure during webhook" {
      inject {
        database_failure(
          target: WebhookEventRepository,
          mode: UNAVAILABLE,
          duration: 30.seconds
        )
      }
      
      when {
        result = ProcessWebhook(
          provider: STRIPE,
          event_id: "evt_db_failure",
          event_type: "payment_intent.succeeded",
          signature: valid_signature,
          timestamp: now(),
          payload: valid_payload,
          headers: {}
        )
      }
      
      then {
        result is PROCESSING_ERROR
        // Provider will retry
        result.retry_after == 30.seconds
      }
    }
    
    chaos "out of order events" {
      inject {
        // Simulate events arriving out of order
        sequence {
          ProcessWebhook(event_type: "charge.refunded", timestamp: T+2)
          ProcessWebhook(event_type: "payment_intent.succeeded", timestamp: T+1)
          ProcessWebhook(event_type: "payment_intent.created", timestamp: T)
        }
      }
      
      then {
        // Final state is consistent
        Payment.lookup(payment_id).status == REFUNDED
        // Events processed in logical order
        eventually within 1.minute: state_consistent
      }
    }
    
    chaos "signature verification under load" {
      inject {
        cpu_pressure(
          level: 0.9,
          duration: 30.seconds
        )
        concurrent_requests(
          count: 100,
          request: ProcessWebhook(
            provider: STRIPE,
            event_id: unique_id(),
            event_type: "payment_intent.succeeded",
            signature: valid_signature,
            timestamp: now(),
            payload: valid_payload,
            headers: {}
          )
        )
      }
      
      then {
        // Signature verification never bypassed
        all(WebhookEvent, e => e.processed implies e.signature_verified)
        // Response time degrades gracefully
        p99_latency <= 5.seconds
      }
    }
  }
}
