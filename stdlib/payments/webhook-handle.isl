# Webhook Handle Module
# Provides payment webhook processing behaviors

module WebhookHandle version "1.0.0"

# ============================================
# Types
# ============================================

type WebhookId = UUID { immutable: true, unique: true }

type WebhookProvider = enum { STRIPE, PAYPAL, SQUARE, ADYEN, BRAINTREE }

type WebhookEventType = enum {
  # Payment events
  PAYMENT_SUCCEEDED
  PAYMENT_FAILED
  PAYMENT_PENDING
  PAYMENT_REFUNDED
  
  # Subscription events
  SUBSCRIPTION_CREATED
  SUBSCRIPTION_UPDATED
  SUBSCRIPTION_CANCELLED
  SUBSCRIPTION_RENEWED
  SUBSCRIPTION_PAST_DUE
  
  # Customer events
  CUSTOMER_CREATED
  CUSTOMER_UPDATED
  CUSTOMER_DELETED
  
  # Dispute events
  DISPUTE_CREATED
  DISPUTE_WON
  DISPUTE_LOST
  
  # Other
  INVOICE_PAID
  INVOICE_FAILED
  PAYOUT_PAID
  PAYOUT_FAILED
}

type WebhookStatus = enum {
  RECEIVED
  VALIDATING
  PROCESSING
  PROCESSED
  FAILED
  IGNORED
}

# ============================================
# Entities
# ============================================

entity WebhookEvent {
  id: WebhookId [immutable, unique]
  provider: WebhookProvider
  event_type: WebhookEventType
  event_id: String [indexed]  # Provider's event ID
  payload: String [secret]  # Raw webhook payload
  signature: String [secret]
  status: WebhookStatus [indexed]
  processed_at: Timestamp?
  failed_at: Timestamp?
  failure_reason: String?
  retry_count: Int [default: 0]
  created_at: Timestamp [immutable]

  invariants {
    retry_count >= 0
    retry_count <= 5
    processed_at != null implies status == PROCESSED
    failed_at != null implies status == FAILED
  }
}

entity WebhookEndpoint {
  id: UUID [immutable, unique]
  provider: WebhookProvider
  url: String
  secret: String [secret]
  events: List<WebhookEventType>
  is_active: Boolean [default: true]
  created_at: Timestamp [immutable]
}

# ============================================
# Behaviors
# ============================================

behavior ReceiveWebhook {
  description: "Receive and validate incoming webhook"

  input {
    provider: WebhookProvider
    payload: String
    signature: String
    headers: Map<String, String>
  }

  output {
    success: WebhookEvent

    errors {
      INVALID_SIGNATURE {
        when: "Webhook signature is invalid"
        retriable: false
      }
      INVALID_PAYLOAD {
        when: "Webhook payload is malformed"
        retriable: false
      }
      UNKNOWN_EVENT_TYPE {
        when: "Event type not recognized"
        retriable: false
      }
      DUPLICATE_EVENT {
        when: "Event already processed"
        retriable: false
      }
      ENDPOINT_NOT_FOUND {
        when: "No webhook endpoint configured"
        retriable: false
      }
    }
  }

  pre {
    payload.length > 0
    signature.length > 0
    WebhookEndpoint.exists_for(provider)
  }

  post success {
    WebhookEvent.exists(result.id)
    result.status == RECEIVED
    result.signature verified against endpoint secret
  }

  invariants {
    signature validation timing-attack resistant
    payload stored for audit
  }

  temporal {
    within 200ms (p99): response returned
  }
}

behavior ProcessWebhook {
  description: "Process a received webhook event"

  input {
    webhook_id: WebhookId
  }

  output {
    success: WebhookEvent

    errors {
      WEBHOOK_NOT_FOUND {
        when: "Webhook event does not exist"
        retriable: false
      }
      ALREADY_PROCESSED {
        when: "Webhook already processed"
        retriable: false
      }
      PROCESSING_FAILED {
        when: "Failed to process webhook"
        retriable: true
        retry_after: 5s
      }
      MAX_RETRIES_EXCEEDED {
        when: "Maximum retry attempts reached"
        retriable: false
      }
    }
  }

  pre {
    WebhookEvent.exists(webhook_id)
    WebhookEvent.lookup(webhook_id).status in [RECEIVED, FAILED]
    WebhookEvent.lookup(webhook_id).retry_count < 5
  }

  post success {
    result.status == PROCESSED
    result.processed_at == now()
  }

  post PROCESSING_FAILED {
    WebhookEvent.lookup(webhook_id).retry_count == old(retry_count) + 1
    WebhookEvent.lookup(webhook_id).status == FAILED
  }

  temporal {
    within 30s (p99): response returned
    eventually within 5m: related entities updated
  }
}

behavior HandlePaymentSucceeded {
  description: "Handle payment succeeded webhook"

  input {
    webhook_id: WebhookId
    payment_processor_id: String
    amount: Decimal
    currency: String
    metadata: Map<String, String>?
  }

  output {
    success: {
      payment_id: UUID
      updated: Boolean
    }

    errors {
      PAYMENT_NOT_FOUND {
        when: "Payment not found in our system"
        retriable: true
        retry_after: 5s
      }
    }
  }

  pre {
    WebhookEvent.exists(webhook_id)
    WebhookEvent.lookup(webhook_id).event_type == PAYMENT_SUCCEEDED
  }

  post success {
    Payment.lookup(result.payment_id).status == COMPLETED
    Payment.lookup(result.payment_id).processor_id == input.payment_processor_id
  }

  temporal {
    within 5s (p99): response returned
    eventually within 1m: customer notified
  }
}

behavior HandlePaymentFailed {
  description: "Handle payment failed webhook"

  input {
    webhook_id: WebhookId
    payment_processor_id: String
    failure_code: String
    failure_message: String
  }

  output {
    success: {
      payment_id: UUID
      updated: Boolean
    }

    errors {
      PAYMENT_NOT_FOUND {
        when: "Payment not found in our system"
        retriable: true
        retry_after: 5s
      }
    }
  }

  pre {
    WebhookEvent.exists(webhook_id)
    WebhookEvent.lookup(webhook_id).event_type == PAYMENT_FAILED
  }

  post success {
    Payment.lookup(result.payment_id).status == FAILED
    Payment.lookup(result.payment_id).failure_reason == input.failure_message
  }

  temporal {
    within 5s (p99): response returned
    eventually within 1m: customer notified of failure
  }
}

behavior HandleSubscriptionEvent {
  description: "Handle subscription-related webhooks"

  input {
    webhook_id: WebhookId
    subscription_processor_id: String
    event_type: WebhookEventType
    event_data: Map<String, String>
  }

  output {
    success: {
      subscription_id: UUID
      action_taken: String
    }

    errors {
      SUBSCRIPTION_NOT_FOUND {
        when: "Subscription not found in our system"
        retriable: true
        retry_after: 5s
      }
      UNHANDLED_EVENT {
        when: "Event type not handled"
        retriable: false
      }
    }
  }

  pre {
    WebhookEvent.exists(webhook_id)
    WebhookEvent.lookup(webhook_id).event_type in [
      SUBSCRIPTION_CREATED,
      SUBSCRIPTION_UPDATED,
      SUBSCRIPTION_CANCELLED,
      SUBSCRIPTION_RENEWED,
      SUBSCRIPTION_PAST_DUE
    ]
  }

  post success {
    Subscription.exists(result.subscription_id)
  }

  temporal {
    within 5s (p99): response returned
  }
}

behavior HandleDisputeCreated {
  description: "Handle chargeback/dispute webhook"

  input {
    webhook_id: WebhookId
    payment_processor_id: String
    dispute_id: String
    amount: Decimal
    reason: String
    evidence_due_by: Timestamp
  }

  output {
    success: {
      payment_id: UUID
      alert_sent: Boolean
    }

    errors {
      PAYMENT_NOT_FOUND {
        when: "Payment not found in our system"
        retriable: true
        retry_after: 5s
      }
    }
  }

  post success {
    result.alert_sent == true
  }

  temporal {
    within 5s (p99): response returned
    immediately: fraud team alerted
    eventually within 5m: evidence collection started
  }

  security {
    high_priority alert
  }
}

behavior RetryFailedWebhook {
  description: "Retry a failed webhook"

  input {
    webhook_id: WebhookId
  }

  output {
    success: WebhookEvent

    errors {
      WEBHOOK_NOT_FOUND {
        when: "Webhook event does not exist"
        retriable: false
      }
      NOT_FAILED {
        when: "Webhook not in failed state"
        retriable: false
      }
      MAX_RETRIES_EXCEEDED {
        when: "Maximum retry attempts reached"
        retriable: false
      }
    }
  }

  pre {
    WebhookEvent.exists(webhook_id)
    WebhookEvent.lookup(webhook_id).status == FAILED
    WebhookEvent.lookup(webhook_id).retry_count < 5
  }

  post success {
    result.retry_count == old(retry_count) + 1
  }

  temporal {
    within 30s (p99): response returned
  }
}
