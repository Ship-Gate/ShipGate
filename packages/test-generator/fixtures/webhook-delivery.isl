// Webhook domain fixture: Webhook delivery behavior
domain Webhooks {
  version: "1.0.0"
  
  entity WebhookEndpoint {
    id: UUID [immutable]
    url: String
    secret: String [secret]
    active: Boolean
  }
  
  entity DeliveryAttempt {
    id: UUID [immutable]
    webhook_id: String
    endpoint_id: UUID
    status: String
    response_code: Int?
    attempt_number: Int
    next_retry_at: Timestamp?
    created_at: Timestamp [immutable]
  }
  
  behavior DeliverWebhook {
    description: "Deliver a webhook to an endpoint"
    
    input {
      webhook_id: String
      endpoint_id: UUID
      event_type: String
      payload: {
        data: String
      }
    }
    
    output {
      success: {
        delivered: Boolean
        response_code: Int
        attempt_number: Int
      }
      
      errors {
        ENDPOINT_NOT_FOUND {
          when: "Endpoint does not exist"
          retriable: false
        }
        ENDPOINT_DISABLED {
          when: "Endpoint is not active"
          retriable: false
        }
        DELIVERY_FAILED {
          when: "Failed to deliver webhook"
          retriable: true
        }
        MAX_RETRIES_EXCEEDED {
          when: "Maximum retry attempts reached"
          retriable: false
        }
      }
    }
    
    preconditions {
      WebhookEndpoint.exists(input.endpoint_id)
      WebhookEndpoint.lookup(input.endpoint_id).active == true
    }
    
    postconditions {
      success implies {
        DeliveryAttempt.exists(webhook_id: input.webhook_id)
        result.delivered == true
        result.response_code >= 200
        result.response_code < 300
      }
      
      DELIVERY_FAILED implies {
        DeliveryAttempt.exists(webhook_id: input.webhook_id)
        DeliveryAttempt.lookup(input.webhook_id).next_retry_at != null
      }
    }
  }
}
