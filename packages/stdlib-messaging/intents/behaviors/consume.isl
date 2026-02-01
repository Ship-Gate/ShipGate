// ============================================================================
// Consume Behavior
// ============================================================================
// Consume messages from queues
// ============================================================================

domain Messaging {
  
  behavior Consume {
    description: "Consume messages from a queue"
    
    actors {
      consumer: {
        with_permission: "messaging:receive"
        for: input.queue
      }
    }
    
    // ========================================================================
    // INPUT
    // ========================================================================
    
    input {
      queue: QueueName
      max_messages: Int { default: 10, min: 1, max: 100 }
      visibility_timeout: Duration { 
        default: 30.seconds, 
        min: 1.second, 
        max: 12.hours 
      }
      wait_time: Duration { default: 0.seconds, max: 20.seconds }
    }
    
    // ========================================================================
    // OUTPUT
    // ========================================================================
    
    output {
      success: List<Message>
      errors {
        QUEUE_NOT_FOUND {
          when: "Queue does not exist"
        }
        QUEUE_DISABLED {
          when: "Queue is temporarily disabled"
          retriable: true
          retry_after: 5.seconds
        }
      }
    }
    
    // ========================================================================
    // PRECONDITIONS
    // ========================================================================
    
    preconditions {
      Queue.exists(input.queue)
    }
    
    // ========================================================================
    // POSTCONDITIONS
    // ========================================================================
    
    postconditions {
      success implies {
        // Result size bounded
        result.length <= input.max_messages
        
        // All messages are marked as delivered
        all(result, m => m.delivered_at != null)
        all(result, m => m.status == DELIVERED)
        
        // All messages belong to this queue
        all(result, m => m.queue == input.queue)
        
        // Visibility timeout is set
        all(result, m => m.visibility_timeout == input.visibility_timeout)
        all(result, m => m.visible_at == m.delivered_at + input.visibility_timeout)
        
        // Retry count incremented
        all(result, m => m.retry_count == old(Message.lookup(m.id).retry_count) + 1)
        
        // In-flight count updated
        Queue.lookup(input.queue).in_flight_count >= result.length
      }
    }
    
    // ========================================================================
    // INVARIANTS
    // ========================================================================
    
    invariants {
      // Messages are not returned if still invisible
      all(result, m => m.visible_at == null or m.visible_at <= now())
      
      // FIFO ordering maintained for FIFO queues
      Queue.lookup(input.queue).type == FIFO implies
        is_ordered_by(result, m => m.created_at)
    }
    
    // ========================================================================
    // TEMPORAL
    // ========================================================================
    
    temporal {
      response within 100.ms (p99)
      response within 20.ms (p50) when input.wait_time == 0.seconds
    }
    
    // ========================================================================
    // SECURITY
    // ========================================================================
    
    security {
      requires: permission("messaging:receive", input.queue)
    }
    
    // ========================================================================
    // OBSERVABILITY
    // ========================================================================
    
    observability {
      metrics {
        counter messages_consumed { labels: [queue] }
        histogram consume_batch_size { labels: [queue] }
        histogram consume_latency { labels: [queue] }
        gauge queue_depth { labels: [queue] }
      }
      
      traces {
        span: "consume_messages"
      }
    }
  }
  
  // ==========================================================================
  // PEEK
  // ==========================================================================
  
  behavior Peek {
    description: "View messages without consuming them"
    
    input {
      queue: QueueName
      max_messages: Int { default: 10, min: 1, max: 100 }
    }
    
    output {
      success: List<Message>
      errors {
        QUEUE_NOT_FOUND {
          when: "Queue does not exist"
        }
      }
    }
    
    preconditions {
      Queue.exists(input.queue)
    }
    
    postconditions {
      success implies {
        result.length <= input.max_messages
        
        // Messages are NOT marked as delivered (peek only)
        all(result, m => m.delivered_at == old(Message.lookup(m.id).delivered_at))
        all(result, m => m.retry_count == old(Message.lookup(m.id).retry_count))
      }
    }
    
    temporal {
      response within 50.ms (p99)
    }
    
    security {
      requires: permission("messaging:peek", input.queue)
    }
  }
  
  // ==========================================================================
  // CHANGE VISIBILITY
  // ==========================================================================
  
  behavior ChangeMessageVisibility {
    description: "Change visibility timeout for an in-flight message"
    
    input {
      message_id: MessageId
      visibility_timeout: Duration { min: 0.seconds, max: 12.hours }
    }
    
    output {
      success: Message
      errors {
        MESSAGE_NOT_FOUND {
          when: "Message does not exist"
        }
        MESSAGE_NOT_IN_FLIGHT {
          when: "Message is not currently in flight"
        }
        INVALID_VISIBILITY_TIMEOUT {
          when: "Visibility timeout is invalid"
        }
      }
    }
    
    preconditions {
      Message.exists(input.message_id)
      Message.lookup(input.message_id).status == DELIVERED
      Message.lookup(input.message_id).visible_at > now()
    }
    
    postconditions {
      success implies {
        result.visibility_timeout == input.visibility_timeout
        input.visibility_timeout == 0.seconds implies result.visible_at == now()
        input.visibility_timeout > 0.seconds implies 
          result.visible_at == now() + input.visibility_timeout
      }
    }
    
    temporal {
      response within 20.ms (p99)
    }
  }
}
