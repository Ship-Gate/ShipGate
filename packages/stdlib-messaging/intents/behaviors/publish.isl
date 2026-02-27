// ============================================================================
// Publish Behavior
// ============================================================================
// Publish messages to topics for fan-out distribution
// ============================================================================

domain Messaging {
  
  behavior Publish {
    description: "Publish a message to a topic"
    
    actors {
      publisher: {
        with_permission: "messaging:publish"
        for: input.topic
      }
    }
    
    // ========================================================================
    // INPUT
    // ========================================================================
    
    input {
      topic: TopicName
      payload: MessagePayload
      content_type: String { default: "application/json" }
      headers: Map<String, String>?
      
      // Routing
      partition_key: String?
      
      // Correlation
      correlation_id: UUID?
      causation_id: UUID?
      idempotency_key: String?
      
      // Scheduling
      delay: Duration?
      scheduled_at: Timestamp?
      expires_at: Timestamp?
    }
    
    // ========================================================================
    // OUTPUT
    // ========================================================================
    
    output {
      success: Message
      errors {
        TOPIC_NOT_FOUND {
          when: "Topic does not exist"
        }
        PAYLOAD_TOO_LARGE {
          when: "Payload exceeds maximum size (256KB)"
        }
        RATE_LIMITED {
          when: "Publisher rate limit exceeded"
          retriable: true
          retry_after: 1.second
        }
        DUPLICATE_MESSAGE {
          when: "Idempotency key already used within deduplication window"
        }
        INVALID_PAYLOAD {
          when: "Payload is not valid for content type"
        }
        TOPIC_DISABLED {
          when: "Topic is temporarily disabled"
          retriable: true
          retry_after: 5.seconds
        }
      }
    }
    
    // ========================================================================
    // PRECONDITIONS
    // ========================================================================
    
    preconditions {
      Topic.exists(input.topic)
      input.payload.length <= 262144  // 256KB
      input.delay == null or input.scheduled_at == null  // Can't have both
      input.expires_at == null or input.expires_at > now()
    }
    
    // ========================================================================
    // POSTCONDITIONS
    // ========================================================================
    
    postconditions {
      success implies {
        Message.exists(result.id)
        result.topic == input.topic
        result.payload == input.payload
        result.status == PENDING
        result.retry_count == 0
        result.created_at <= now()
        
        // Scheduling honored
        input.delay != null implies result.scheduled_at == result.created_at + input.delay
        input.scheduled_at != null implies result.scheduled_at == input.scheduled_at
        
        // Headers preserved
        input.headers != null implies 
          all(input.headers, (k, v) => result.headers[k] == v)
        
        // Correlation preserved
        input.correlation_id != null implies result.correlation_id == input.correlation_id
        input.causation_id != null implies result.causation_id == input.causation_id
      }
    }
    
    // ========================================================================
    // INVARIANTS
    // ========================================================================
    
    invariants {
      // Idempotency: same key always produces same result
      same(input.topic, input.idempotency_key) implies same(result)
    }
    
    // ========================================================================
    // TEMPORAL
    // ========================================================================
    
    temporal {
      response within 50.ms (p99)
      response within 10.ms (p50)
      eventually within 100.ms: message_persisted
    }
    
    // ========================================================================
    // SECURITY
    // ========================================================================
    
    security {
      requires: permission("messaging:publish", input.topic)
      rate_limit: 10000.per_second per input.topic
    }
    
    // ========================================================================
    // OBSERVABILITY
    // ========================================================================
    
    observability {
      metrics {
        counter messages_published { labels: [topic, status] }
        histogram message_size { labels: [topic] }
        histogram publish_latency { labels: [topic] }
      }
      
      traces {
        span: "publish_message"
      }
      
      logs {
        on_success: info { include: [topic, message_id] }
        on_error: warn { include: [topic, error_code] }
      }
    }
  }
  
  // ==========================================================================
  // BATCH PUBLISH
  // ==========================================================================
  
  behavior PublishBatch {
    description: "Publish multiple messages to a topic in a single request"
    
    input {
      topic: TopicName
      messages: List<{
        payload: MessagePayload
        headers: Map<String, String>?
        partition_key: String?
        idempotency_key: String?
      }>
    }
    
    output {
      success: {
        successful: List<Message>
        failed: List<{
          index: Int
          error: String
        }>
      }
      errors {
        TOPIC_NOT_FOUND {
          when: "Topic does not exist"
        }
        BATCH_TOO_LARGE {
          when: "Batch contains more than 100 messages"
        }
        RATE_LIMITED {
          when: "Publisher rate limit exceeded"
          retriable: true
          retry_after: 1.second
        }
      }
    }
    
    preconditions {
      Topic.exists(input.topic)
      input.messages.length > 0
      input.messages.length <= 100
      all(input.messages, m => m.payload.length <= 262144)
    }
    
    postconditions {
      success implies {
        result.successful.length + result.failed.length == input.messages.length
        all(result.successful, m => Message.exists(m.id))
        all(result.successful, m => m.topic == input.topic)
      }
    }
    
    temporal {
      response within 200.ms (p99)
    }
  }
}
