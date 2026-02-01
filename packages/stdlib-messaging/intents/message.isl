// ============================================================================
// Message Entity
// ============================================================================
// Core message structure for all messaging operations
// ============================================================================

domain Messaging {
  
  entity Message {
    // ========================================================================
    // IDENTITY
    // ========================================================================
    
    id: MessageId [immutable, unique, indexed]
    
    // ========================================================================
    // ROUTING
    // ========================================================================
    
    topic: TopicName [immutable, indexed]
    queue: QueueName? [indexed]
    partition_key: String? [immutable]
    
    // ========================================================================
    // CONTENT
    // ========================================================================
    
    payload: MessagePayload [immutable]
    content_type: String { default: "application/json" }
    headers: Map<String, String>
    
    // ========================================================================
    // METADATA
    // ========================================================================
    
    correlation_id: UUID?
    causation_id: UUID?
    idempotency_key: String? [immutable, indexed]
    
    // ========================================================================
    // TIMESTAMPS
    // ========================================================================
    
    created_at: Timestamp [immutable]
    scheduled_at: Timestamp?
    delivered_at: Timestamp?
    acknowledged_at: Timestamp?
    expires_at: Timestamp?
    
    // ========================================================================
    // DELIVERY STATE
    // ========================================================================
    
    status: DeliveryStatus { default: PENDING }
    retry_count: Int { default: 0 }
    max_retries: Int { default: 10 }
    visibility_timeout: Duration?
    visible_at: Timestamp?
    
    // ========================================================================
    // DEAD LETTER
    // ========================================================================
    
    dead_letter_reason: String?
    dead_letter_at: Timestamp?
    original_queue: QueueName?
    
    // ========================================================================
    // INVARIANTS
    // ========================================================================
    
    invariants {
      // Retry count is non-negative
      retry_count >= 0
      retry_count <= max_retries + 1
      
      // Acknowledgment requires delivery
      acknowledged_at != null implies delivered_at != null
      
      // Dead letter state consistency
      status == DEAD_LETTERED implies dead_letter_at != null
      dead_letter_at != null implies status == DEAD_LETTERED
      
      // Visibility timeout logic
      visible_at != null implies visibility_timeout != null
      
      // Scheduled delivery
      scheduled_at != null implies scheduled_at >= created_at
      
      // Expiration logic
      expires_at != null implies expires_at > created_at
      
      // Idempotency key uniqueness per topic
      idempotency_key != null implies 
        unique(topic, idempotency_key)
    }
    
    // ========================================================================
    // LIFECYCLE
    // ========================================================================
    
    lifecycle {
      PENDING -> DELIVERED
      DELIVERED -> ACKNOWLEDGED
      DELIVERED -> REJECTED
      DELIVERED -> PENDING    // Retry
      REJECTED -> PENDING     // Retry
      REJECTED -> DEAD_LETTERED
      PENDING -> DEAD_LETTERED  // Max retries exceeded
    }
  }
  
  // ==========================================================================
  // MESSAGE BATCH
  // ==========================================================================
  
  entity MessageBatch {
    id: UUID [immutable, unique]
    messages: List<MessageId>
    topic: TopicName
    created_at: Timestamp [immutable]
    
    invariants {
      messages.length > 0
      messages.length <= 100
      all(messages, m => Message.lookup(m).topic == topic)
    }
  }
}
