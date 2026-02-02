// Payments: Checkout session
domain PaymentsCheckout {
  version: "1.0.0"

  type Money = Decimal { min: 0, precision: 2 }

  enum CheckoutMode {
    PAYMENT
    SUBSCRIPTION
    SETUP
  }

  enum CheckoutStatus {
    OPEN
    COMPLETE
    EXPIRED
  }

  type LineItem = {
    price_id: UUID?
    name: String?
    description: String?
    quantity: Int
    unit_amount: Decimal?
    amount: Decimal
    images: List<String>?
  }

  entity CheckoutSession {
    id: UUID [immutable, unique]
    mode: CheckoutMode
    status: CheckoutStatus
    customer_id: UUID?
    customer_email: String?
    line_items: List<LineItem>
    currency: String
    amount_subtotal: Decimal
    amount_total: Decimal
    success_url: String
    cancel_url: String
    payment_intent_id: UUID?
    subscription_id: UUID?
    expires_at: Timestamp
    completed_at: Timestamp?
    metadata: Map<String, String>
    created_at: Timestamp [immutable]

    invariants {
      line_items.length > 0
      amount_total >= amount_subtotal
      expires_at > created_at
      status == COMPLETE implies completed_at != null
    }

    lifecycle {
      OPEN -> COMPLETE
      OPEN -> EXPIRED
    }
  }

  behavior CreateCheckoutSession {
    description: "Create a checkout session"

    actors {
      Merchant { must: authenticated }
      System { }
    }

    input {
      mode: CheckoutMode
      line_items: List<LineItem>
      currency: String?
      customer_id: UUID?
      customer_email: String?
      success_url: String
      cancel_url: String
      expires_in: Duration?
      metadata: Map<String, String>?
    }

    output {
      success: {
        session: CheckoutSession
        url: String
      }

      errors {
        EMPTY_LINE_ITEMS {
          when: "No line items provided"
          retriable: true
        }
        INVALID_LINE_ITEM {
          when: "Line item is invalid"
          retriable: true
        }
        INVALID_URL {
          when: "Success or cancel URL is invalid"
          retriable: true
        }
        CUSTOMER_NOT_FOUND {
          when: "Customer not found"
          retriable: false
        }
      }
    }

    pre {
      input.line_items.length > 0
      all(item in input.line_items: item.quantity > 0)
    }

    post success {
      - CheckoutSession.exists(result.session.id)
      - result.session.status == OPEN
      - result.url contains result.session.id
    }

    temporal {
      - within 1s (p99): response returned
    }
  }

  behavior GetCheckoutSession {
    description: "Get checkout session details"

    actors {
      Merchant { must: authenticated }
      System { }
    }

    input {
      session_id: UUID
    }

    output {
      success: CheckoutSession

      errors {
        NOT_FOUND {
          when: "Session not found"
          retriable: false
        }
      }
    }

    pre {
      CheckoutSession.exists(input.session_id)
    }
  }

  behavior ExpireCheckoutSession {
    description: "Expire a checkout session"

    actors {
      Merchant { must: authenticated }
    }

    input {
      session_id: UUID
    }

    output {
      success: CheckoutSession

      errors {
        NOT_FOUND {
          when: "Session not found"
          retriable: false
        }
        ALREADY_COMPLETE {
          when: "Session already completed"
          retriable: false
        }
        ALREADY_EXPIRED {
          when: "Session already expired"
          retriable: false
        }
      }
    }

    pre {
      CheckoutSession.exists(input.session_id)
      CheckoutSession.lookup(input.session_id).status == OPEN
    }

    post success {
      - result.status == EXPIRED
    }
  }

  behavior ListCheckoutSessions {
    description: "List checkout sessions"

    actors {
      Merchant { must: authenticated }
    }

    input {
      customer_id: UUID?
      status: CheckoutStatus?
      from: Timestamp?
      to: Timestamp?
      page: Int?
      page_size: Int?
    }

    output {
      success: {
        sessions: List<CheckoutSession>
        total_count: Int
        has_more: Boolean
      }
    }
  }

  scenarios CreateCheckoutSession {
    scenario "simple payment" {
      when {
        result = CreateCheckoutSession(
          mode: PAYMENT,
          line_items: [
            { name: "Product", quantity: 1, amount: 29.99 }
          ],
          success_url: "https://example.com/success",
          cancel_url: "https://example.com/cancel"
        )
      }

      then {
        result is success
        result.session.mode == PAYMENT
        result.session.status == OPEN
      }
    }

    scenario "subscription checkout" {
      when {
        result = CreateCheckoutSession(
          mode: SUBSCRIPTION,
          line_items: [
            { price_id: "price_123", quantity: 1, amount: 9.99 }
          ],
          customer_email: "customer@example.com",
          success_url: "https://example.com/success",
          cancel_url: "https://example.com/cancel"
        )
      }

      then {
        result is success
        result.session.mode == SUBSCRIPTION
      }
    }
  }
}
