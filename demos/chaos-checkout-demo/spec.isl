// Chaos Checkout Demo
// Demonstrates chaos engineering scenarios with idempotency
domain ChaosCheckout {
  version: "1.0.0"

  type Money = Decimal { min: 0, precision: 2 }

  enum CheckoutStatus {
    OPEN
    PROCESSING
    COMPLETE
    EXPIRED
    FAILED
  }

  type LineItem = {
    name: String
    quantity: Int
    unit_price: Money
    amount: Money
  }

  entity CheckoutSession {
    id: UUID [immutable, unique]
    idempotency_key: String? [unique, indexed]
    status: CheckoutStatus
    line_items: List<LineItem>
    currency: String
    amount_total: Money
    success_url: String
    cancel_url: String
    request_hash: String?
    created_at: Timestamp [immutable]
    completed_at: Timestamp?
    retry_count: Int

    invariants {
      line_items.length > 0
      amount_total >= 0
      status == COMPLETE implies completed_at != null
    }

    lifecycle {
      OPEN -> PROCESSING
      PROCESSING -> COMPLETE
      PROCESSING -> FAILED
      OPEN -> EXPIRED
    }
  }

  behavior CreateCheckoutSession {
    description: "Create a checkout session with idempotency support"

    actors {
      Merchant { must: authenticated }
    }

    input {
      idempotency_key: String?
      line_items: List<LineItem>
      currency: String?
      success_url: String
      cancel_url: String
    }

    output {
      success: {
        session: CheckoutSession
        url: String
        is_cached: Boolean
      }

      errors {
        EMPTY_LINE_ITEMS {
          when: "No line items provided"
          retriable: true
        }
        INVALID_LINE_ITEM {
          when: "Line item has invalid quantity or price"
          retriable: true
        }
        IDEMPOTENCY_CONFLICT {
          when: "Idempotency key already used with different parameters"
          retriable: false
        }
        RATE_LIMITED {
          when: "Too many requests"
          retriable: true
        }
        SERVICE_UNAVAILABLE {
          when: "Database or service temporarily unavailable"
          retriable: true
        }
      }
    }

    pre {
      input.line_items.length > 0
      all(item in input.line_items: item.quantity > 0)
      all(item in input.line_items: item.unit_price >= 0)
    }

    post success {
      - CheckoutSession.exists(result.session.id)
      - result.session.status == OPEN
      - result.url contains result.session.id
    }

    temporal {
      - within 1s (p99): response returned
    }

    chaos {
      scenario "concurrent duplicate requests" {
        inject: concurrent_requests(count: 10)
        with: idempotency_key("chaos-concurrent-test")
        expect: exactly_one_created
        expect: all_return_same_session
        retries: 0
      }

      scenario "retry after network failure" {
        inject: network_failure(probability: 0.8, recovers_after: 2s)
        with: idempotency_key("chaos-retry-test")
        retries: 3
        expect: eventually_succeeds
        expect: no_duplicate_sessions
      }

      scenario "rate limit storm" {
        inject: rate_limit_storm(requests: 100, window: 1s, limit: 10)
        expect: graceful_degradation
        expect: no_data_corruption
      }

      scenario "database failure with recovery" {
        inject: database_failure(target: "CheckoutRepository", mode: UNAVAILABLE)
        expect: error_returned(SERVICE_UNAVAILABLE)
        retries: 3
        expect: successful_retry_after_recovery
      }

      scenario "latency spike" {
        inject: latency(p99: 500ms, distribution: "normal")
        expect: response_within(timeout: 5s)
        expect: no_timeout_errors
      }

      scenario "partial failure" {
        inject: database_failure(probability: 0.3, mode: TIMEOUT)
        with: idempotency_key("chaos-partial-test")
        retries: 5
        expect: eventual_consistency
        expect: no_duplicate_charges
      }
    }
  }

  behavior CompleteCheckout {
    description: "Complete a checkout session"

    actors {
      System { }
    }

    input {
      session_id: UUID
      payment_intent_id: String
    }

    output {
      success: CheckoutSession

      errors {
        NOT_FOUND {
          when: "Session not found"
          retriable: false
        }
        INVALID_STATE {
          when: "Session is not in PROCESSING state"
          retriable: false
        }
      }
    }

    pre {
      CheckoutSession.exists(input.session_id)
      CheckoutSession.lookup(input.session_id).status == PROCESSING
    }

    post success {
      - result.status == COMPLETE
      - result.completed_at != null
    }
  }
}
