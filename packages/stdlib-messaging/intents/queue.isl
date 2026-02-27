// ============================================================================
// Queue Entity
// ============================================================================
// Message queue for ordered, reliable message consumption
// ============================================================================

domain Messaging {
  
  entity Queue {
    // ========================================================================
    // IDENTITY
    // ========================================================================
    
    name: QueueName [immutable, unique, indexed]
    
    // ========================================================================
    // CONFIGURATION
    // ========================================================================
    
    type: QueueType { default: STANDARD }
    acknowledge_mode: AcknowledgeMode { default: MANUAL }
    
    // ========================================================================
    // CAPACITY
    // ========================================================================
    
    max_size: Int?                    // Max messages in queue
    max_message_size: Int { default: 262144 }  // 256KB
    
    // ========================================================================
    // TIMING
    // ========================================================================
    
    default_visibility_timeout: Duration { default: 30.seconds }
    message_retention: Duration { default: 14.days }
    delay_seconds: Duration { default: 0.seconds }
    
    // ========================================================================
    // DEAD LETTER
    // ========================================================================
    
    dead_letter_queue: QueueName?
    max_receive_count: Int { default: 10 }
    
    // ========================================================================
    // STATISTICS
    // ========================================================================
    
    message_count: Int [computed]
    in_flight_count: Int [computed]
    oldest_message_age: Duration? [computed]
    
    // ========================================================================
    // METADATA
    // ========================================================================
    
    created_at: Timestamp [immutable]
    updated_at: Timestamp
    tags: Map<String, String>
    
    // ========================================================================
    // INVARIANTS
    // ========================================================================
    
    invariants {
      // FIFO queues require content-based deduplication or idempotency
      type == FIFO implies acknowledge_mode != AUTO
      
      // Dead letter queue cannot be self-referential
      dead_letter_queue != name
      
      // Valid capacity settings
      max_size == null or max_size > 0
      max_message_size > 0
      max_message_size <= 262144
      
      // Valid timing settings
      default_visibility_timeout >= 1.second
      default_visibility_timeout <= 12.hours
      message_retention >= 1.minute
      message_retention <= 14.days
      delay_seconds >= 0.seconds
      delay_seconds <= 15.minutes
      
      // Dead letter consistency
      dead_letter_queue != null implies max_receive_count > 0
      
      // Computed field consistency
      message_count >= 0
      in_flight_count >= 0
      in_flight_count <= message_count
    }
  }
  
  // ==========================================================================
  // QUEUE OPERATIONS
  // ==========================================================================
  
  behavior CreateQueue {
    description: "Create a new message queue"
    
    input {
      name: QueueName
      type: QueueType?
      acknowledge_mode: AcknowledgeMode?
      dead_letter_queue: QueueName?
      max_receive_count: Int?
      default_visibility_timeout: Duration?
      message_retention: Duration?
      tags: Map<String, String>?
    }
    
    output {
      success: Queue
      errors {
        QUEUE_ALREADY_EXISTS { when: "Queue with name already exists" }
        INVALID_DEAD_LETTER_QUEUE { when: "Dead letter queue does not exist" }
        INVALID_CONFIGURATION { when: "Invalid queue configuration" }
      }
    }
    
    preconditions {
      not Queue.exists(input.name)
      input.dead_letter_queue == null or Queue.exists(input.dead_letter_queue)
    }
    
    postconditions {
      success implies {
        Queue.exists(result.name)
        result.name == input.name
        result.message_count == 0
      }
    }
  }
  
  behavior DeleteQueue {
    description: "Delete a message queue"
    
    input {
      name: QueueName
      force: Boolean { default: false }
    }
    
    output {
      success: Boolean
      errors {
        QUEUE_NOT_FOUND { when: "Queue does not exist" }
        QUEUE_NOT_EMPTY { when: "Queue contains messages and force=false" }
        QUEUE_HAS_SUBSCRIPTIONS { when: "Queue has active subscriptions" }
      }
    }
    
    preconditions {
      Queue.exists(input.name)
      input.force or Queue.lookup(input.name).message_count == 0
    }
    
    postconditions {
      success implies not Queue.exists(input.name)
    }
  }
  
  behavior PurgeQueue {
    description: "Remove all messages from queue"
    
    input {
      name: QueueName
    }
    
    output {
      success: { deleted_count: Int }
      errors {
        QUEUE_NOT_FOUND { when: "Queue does not exist" }
      }
    }
    
    postconditions {
      success implies Queue.lookup(input.name).message_count == 0
    }
  }
  
  behavior GetQueueStats {
    description: "Get queue statistics"
    
    input {
      name: QueueName
    }
    
    output {
      success: {
        message_count: Int
        in_flight_count: Int
        oldest_message_age: Duration?
        approximate_delay: Duration?
      }
      errors {
        QUEUE_NOT_FOUND { when: "Queue does not exist" }
      }
    }
  }
}
