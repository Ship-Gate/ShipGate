// Webhooks: Event dispatch
domain WebhooksDispatch {
  version: "1.0.0"

  enum DeliveryStatus {
    PENDING
    SUCCEEDED
    FAILED
    RETRYING
  }

  entity WebhookEvent {
    id: UUID [immutable, unique]
    type: String [indexed]
    data: Map<String, String>
    api_version: String
    created_at: Timestamp [immutable]
  }

  entity WebhookDelivery {
    id: UUID [immutable, unique]
    event_id: UUID [indexed]
    endpoint_id: UUID [indexed]
    status: DeliveryStatus
    request_headers: Map<String, String>
    request_body: String
    response_status: Int?
    response_headers: Map<String, String>?
    response_body: String?
    duration_ms: Int?
    attempts: Int [default: 0]
    next_retry_at: Timestamp?
    delivered_at: Timestamp?
    created_at: Timestamp [immutable]

    invariants {
      attempts >= 0
      duration_ms == null or duration_ms >= 0
    }

    lifecycle {
      PENDING -> SUCCEEDED
      PENDING -> FAILED
      PENDING -> RETRYING
      RETRYING -> SUCCEEDED
      RETRYING -> FAILED
    }
  }

  behavior DispatchEvent {
    description: "Dispatch event to webhook endpoints"

    actors {
      System { }
    }

    input {
      event_type: String
      data: Map<String, String>
      api_version: String?
    }

    output {
      success: {
        event: WebhookEvent
        deliveries: List<WebhookDelivery>
      }
    }

    pre {
      input.event_type.length > 0
    }

    post success {
      - WebhookEvent.exists(result.event.id)
      - result.event.type == input.event_type
    }

    temporal {
      - within 100ms (p99): event queued
      - eventually within 30s: first delivery attempt
    }
  }

  behavior GetDelivery {
    description: "Get delivery details"

    actors {
      User { must: authenticated }
    }

    input {
      delivery_id: UUID
    }

    output {
      success: WebhookDelivery

      errors {
        NOT_FOUND {
          when: "Delivery not found"
          retriable: false
        }
      }
    }

    pre {
      WebhookDelivery.exists(input.delivery_id)
    }
  }

  behavior ListDeliveries {
    description: "List webhook deliveries"

    actors {
      User { must: authenticated }
    }

    input {
      endpoint_id: UUID?
      event_id: UUID?
      status: DeliveryStatus?
      from: Timestamp?
      to: Timestamp?
      page: Int?
      page_size: Int?
    }

    output {
      success: {
        deliveries: List<WebhookDelivery>
        total_count: Int
        has_more: Boolean
      }
    }
  }

  behavior RetryDelivery {
    description: "Retry a failed delivery"

    actors {
      User { must: authenticated }
    }

    input {
      delivery_id: UUID
    }

    output {
      success: WebhookDelivery

      errors {
        NOT_FOUND {
          when: "Delivery not found"
          retriable: false
        }
        NOT_RETRYABLE {
          when: "Delivery cannot be retried"
          retriable: false
        }
        MAX_RETRIES_EXCEEDED {
          when: "Maximum retries exceeded"
          retriable: false
        }
      }
    }

    pre {
      WebhookDelivery.exists(input.delivery_id)
      WebhookDelivery.lookup(input.delivery_id).status == FAILED
    }

    post success {
      - result.status == PENDING or result.status == RETRYING
      - result.attempts == old(WebhookDelivery.lookup(input.delivery_id).attempts) + 1
    }
  }

  behavior ResendEvent {
    description: "Resend event to all endpoints"

    actors {
      User { must: authenticated }
    }

    input {
      event_id: UUID
    }

    output {
      success: {
        deliveries: List<WebhookDelivery>
      }

      errors {
        EVENT_NOT_FOUND {
          when: "Event not found"
          retriable: false
        }
      }
    }

    pre {
      WebhookEvent.exists(input.event_id)
    }
  }

  scenarios DispatchEvent {
    scenario "dispatch payment completed" {
      when {
        result = DispatchEvent(
          event_type: "payment.completed",
          data: {
            "payment_id": "pay_123",
            "amount": "99.99",
            "currency": "USD"
          }
        )
      }

      then {
        result is success
        result.event.type == "payment.completed"
      }
    }
  }
}
