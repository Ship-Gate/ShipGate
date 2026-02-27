// Webhook domain fixture: Receive webhook behavior
domain Webhooks {
  version: "1.0.0"
  
  entity WebhookLog {
    id: UUID [immutable]
    webhook_id: String [unique]
    event_type: String
    processed: Boolean
    processed_at: Timestamp?
    created_at: Timestamp [immutable]
  }
  
  behavior ReceiveWebhook {
    description: "Receive and process a webhook"
    
    input {
      webhook_id: String
      event_type: String
      timestamp: Timestamp
      signature: String
      payload: {
        data: String
      }
    }
    
    output {
      success: {
        processed: Boolean
        event_id: String
      }
      
      errors {
        INVALID_SIGNATURE {
          when: "Webhook signature is invalid"
          retriable: false
        }
        REPLAY_ATTACK {
          when: "Webhook has already been processed"
          retriable: false
        }
        UNSUPPORTED_EVENT_TYPE {
          when: "Event type is not supported"
          retriable: false
        }
        PROCESSING_FAILED {
          when: "Failed to process webhook"
          retriable: true
        }
      }
    }
    
    preconditions {
      signature.is_valid(input.payload, webhook_secret)
      input.timestamp > now() - 5.minutes
      not WebhookLog.exists(webhook_id: input.webhook_id)
      input.event_type in ["payment.completed", "payment.failed", "subscription.created"]
    }
    
    postconditions {
      success implies {
        WebhookLog.exists(webhook_id: input.webhook_id)
        WebhookLog.lookup(input.webhook_id).processed == true
        result.processed == true
      }
    }
  }
}
