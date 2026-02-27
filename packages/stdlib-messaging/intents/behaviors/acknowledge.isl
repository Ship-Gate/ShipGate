// ============================================================================
// Acknowledge Behavior
// ============================================================================
// Acknowledge, reject, and dead-letter messages
// ============================================================================

domain Messaging {
  
  behavior Acknowledge {
    description: "Acknowledge successful processing of a message"
    
    actors {
      consumer: {
        with_permission: "messaging:acknowledge"
      }
    }
    
    // ========================================================================
    // INPUT
    // ========================================================================
    
    input {
      message_id: MessageId
    }
    
    // ========================================================================
    // OUTPUT
    // ========================================================================
    
    output {
      success: Boolean
      errors {
        MESSAGE_NOT_FOUND {
          when: "Message does not exist"
        }
        MESSAGE_NOT_DELIVERED {
          when: "Message has not been delivered"
        }
        ALREADY_ACKNOWLEDGED {
          when: "Message has already been acknowledged"
        }
        VISIBILITY_EXPIRED {
          when: "Message visibility timeout has expired"
          retriable: false
        }
      }
    }
    
    // ========================================================================
    // PRECONDITIONS
    // ========================================================================
    
    preconditions {
      Message.exists(input.message_id)
      Message.lookup(input.message_id).delivered_at != null
      Message.lookup(input.message_id).acknowledged_at == null
      Message.lookup(input.message_id).status == DELIVERED
    }
    
    // ========================================================================
    // POSTCONDITIONS
    // ========================================================================
    
    postconditions {
      success implies {
        let msg = Message.lookup(input.message_id)
        msg.acknowledged_at != null
        msg.acknowledged_at >= msg.delivered_at
        msg.status == ACKNOWLEDGED
        
        // Queue in-flight count decremented
        Queue.lookup(msg.queue).in_flight_count ==
          old(Queue.lookup(msg.queue).in_flight_count) - 1
      }
    }
    
    // ========================================================================
    // TEMPORAL
    // ========================================================================
    
    temporal {
      response within 20.ms (p99)
    }
    
    // ========================================================================
    // OBSERVABILITY
    // ========================================================================
    
    observability {
      metrics {
        counter messages_acknowledged { labels: [queue, topic] }
        histogram processing_time { 
          labels: [queue, topic]
          value: now() - Message.lookup(input.message_id).delivered_at
        }
      }
    }
  }
  
  // ==========================================================================
  // ACKNOWLEDGE BATCH
  // ==========================================================================
  
  behavior AcknowledgeBatch {
    description: "Acknowledge multiple messages at once"
    
    input {
      message_ids: List<MessageId> { min_length: 1, max_length: 100 }
    }
    
    output {
      success: {
        successful: List<MessageId>
        failed: List<{
          message_id: MessageId
          error: String
        }>
      }
      errors {
        BATCH_EMPTY {
          when: "No message IDs provided"
        }
        BATCH_TOO_LARGE {
          when: "More than 100 messages in batch"
        }
      }
    }
    
    preconditions {
      input.message_ids.length > 0
      input.message_ids.length <= 100
    }
    
    postconditions {
      success implies {
        result.successful.length + result.failed.length == input.message_ids.length
        all(result.successful, id => Message.lookup(id).status == ACKNOWLEDGED)
      }
    }
    
    temporal {
      response within 100.ms (p99)
    }
  }
  
  // ==========================================================================
  // REJECT
  // ==========================================================================
  
  behavior Reject {
    description: "Reject a message, returning it to the queue for retry"
    
    input {
      message_id: MessageId
      delay: Duration { default: 0.seconds, max: 15.minutes }
      reason: String?
    }
    
    output {
      success: Message
      errors {
        MESSAGE_NOT_FOUND {
          when: "Message does not exist"
        }
        MESSAGE_NOT_DELIVERED {
          when: "Message has not been delivered"
        }
        ALREADY_ACKNOWLEDGED {
          when: "Message has already been acknowledged"
        }
        MAX_RETRIES_EXCEEDED {
          when: "Message has exceeded maximum retry count"
        }
      }
    }
    
    preconditions {
      Message.exists(input.message_id)
      Message.lookup(input.message_id).status == DELIVERED
    }
    
    postconditions {
      success implies {
        let msg = result
        
        // Status changed
        msg.status == PENDING or msg.status == DEAD_LETTERED
        
        // Visibility reset with optional delay
        msg.visible_at == now() + input.delay
        
        // In-flight count decremented
        Queue.lookup(msg.queue).in_flight_count ==
          old(Queue.lookup(msg.queue).in_flight_count) - 1
      }
      
      // Dead-lettered if max retries exceeded
      failure(MAX_RETRIES_EXCEEDED) implies {
        Message.lookup(input.message_id).status == DEAD_LETTERED
      }
    }
    
    temporal {
      response within 20.ms (p99)
    }
    
    observability {
      metrics {
        counter messages_rejected { labels: [queue, topic, reason] }
      }
    }
  }
  
  // ==========================================================================
  // DEAD LETTER
  // ==========================================================================
  
  behavior DeadLetter {
    description: "Move a message to the dead letter queue"
    
    input {
      message_id: MessageId
      reason: String
    }
    
    output {
      success: Message
      errors {
        MESSAGE_NOT_FOUND {
          when: "Message does not exist"
        }
        ALREADY_DEAD_LETTERED {
          when: "Message is already in dead letter queue"
        }
        NO_DEAD_LETTER_QUEUE {
          when: "Queue has no dead letter queue configured"
        }
      }
    }
    
    preconditions {
      Message.exists(input.message_id)
      Message.lookup(input.message_id).status != DEAD_LETTERED
    }
    
    postconditions {
      success implies {
        let msg = result
        msg.status == DEAD_LETTERED
        msg.dead_letter_at != null
        msg.dead_letter_reason == input.reason
        msg.original_queue == old(Message.lookup(input.message_id).queue)
        
        // Moved to DLQ
        let queue = Queue.lookup(old(Message.lookup(input.message_id).queue))
        queue.dead_letter_queue != null implies 
          msg.queue == queue.dead_letter_queue
      }
    }
    
    temporal {
      response within 50.ms (p99)
    }
    
    observability {
      metrics {
        counter messages_dead_lettered { labels: [queue, topic, reason] }
      }
      
      logs {
        always: warn { 
          include: [message_id, queue, reason, retry_count] 
        }
      }
    }
  }
  
  // ==========================================================================
  // REDRIVE
  // ==========================================================================
  
  behavior Redrive {
    description: "Move messages from dead letter queue back to source queue"
    
    input {
      dead_letter_queue: QueueName
      max_messages: Int { default: 100, max: 1000 }
      destination_queue: QueueName?  // Optional override
    }
    
    output {
      success: {
        moved_count: Int
        failed_count: Int
      }
      errors {
        QUEUE_NOT_FOUND {
          when: "Dead letter queue does not exist"
        }
        DESTINATION_NOT_FOUND {
          when: "Destination queue does not exist"
        }
        NOT_A_DEAD_LETTER_QUEUE {
          when: "Queue is not configured as a dead letter queue"
        }
      }
    }
    
    postconditions {
      success implies {
        result.moved_count >= 0
        result.moved_count <= input.max_messages
        
        // Moved messages reset
        // (actual implementation would update message states)
      }
    }
    
    temporal {
      response within 5.seconds (p99)
    }
  }
}
