// ============================================================================
// Messaging Domain - Standard Library
// ============================================================================
// Provides messaging primitives: queues, topics, pub/sub patterns
// ============================================================================

domain Messaging {
  version: "1.0.0"
  owner: "intentos/stdlib"
  
  // ============================================================================
  // IMPORTS
  // ============================================================================
  
  import { Message } from "./message.isl"
  import { Queue } from "./queue.isl"
  import { Topic, Subscription } from "./topic.isl"
  import { Publish } from "./behaviors/publish.isl"
  import { Subscribe, Unsubscribe } from "./behaviors/subscribe.isl"
  import { Consume, Peek } from "./behaviors/consume.isl"
  import { Acknowledge, Reject, DeadLetter } from "./behaviors/acknowledge.isl"
  
  // ============================================================================
  // TYPES
  // ============================================================================
  
  type MessageId = UUID
  
  type TopicName = String {
    pattern: /^[a-z][a-z0-9-]*$/
    max_length: 64
  }
  
  type QueueName = String {
    pattern: /^[a-z][a-z0-9-]*$/
    max_length: 64
  }
  
  type SubscriptionId = UUID
  
  type MessagePayload = String {
    max_length: 262144  // 256KB
  }
  
  type FilterExpression = String {
    max_length: 1024
  }
  
  // ============================================================================
  // ENUMS
  // ============================================================================
  
  enum DeliveryStatus {
    PENDING
    DELIVERED
    ACKNOWLEDGED
    REJECTED
    DEAD_LETTERED
  }
  
  enum QueueType {
    STANDARD        // At-least-once delivery
    FIFO            // Exactly-once, ordered
    PRIORITY        // Priority-based ordering
    DELAY           // Delayed delivery
  }
  
  enum AcknowledgeMode {
    AUTO            // Automatic ack on receive
    MANUAL          // Explicit ack required
    TRANSACTIONAL   // Ack within transaction
  }
  
  // ============================================================================
  // GLOBAL INVARIANTS
  // ============================================================================
  
  invariants MessageDelivery {
    description: "Messages are delivered at least once within retry limit"
    scope: global
    
    eventually {
      all(Message where status == PENDING, m =>
        m.retry_count < m.max_retries implies 
          eventually(m.status in [DELIVERED, ACKNOWLEDGED, DEAD_LETTERED])
      )
    }
  }
  
  invariants MessageOrdering {
    description: "FIFO queues maintain message ordering"
    scope: global
    
    all(Queue where type == FIFO, q =>
      all(Message where queue == q.name, m1 =>
        all(Message where queue == q.name and created_at > m1.created_at, m2 =>
          m1.delivered_at != null implies 
            (m2.delivered_at == null or m2.delivered_at > m1.delivered_at)
        )
      )
    )
  }
  
  invariants DeadLetterConsistency {
    description: "Dead-lettered messages are not redelivered"
    scope: global
    
    all(Message where status == DEAD_LETTERED, m =>
      always(m.status == DEAD_LETTERED)
    )
  }
  
  // ============================================================================
  // POLICIES
  // ============================================================================
  
  policy RetryPolicy {
    applies_to: [Consume]
    
    rules {
      when(Message.retry_count >= Message.max_retries) {
        DeadLetter(message_id: Message.id)
      }
      
      when(Message.retry_count < Message.max_retries) {
        delay: exponential_backoff(
          base: 1.second,
          max: 5.minutes,
          attempt: Message.retry_count
        )
      }
    }
  }
  
  policy RateLimitPolicy {
    applies_to: [Publish]
    
    rules {
      rate_limit: 10000.per_second per topic
      burst: 1000
      
      when(exceeded) {
        return RATE_LIMITED with retry_after: 1.second
      }
    }
  }
}
