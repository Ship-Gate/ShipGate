// ============================================================================
// Topic Entity
// ============================================================================
// Pub/Sub topic for fan-out message distribution
// ============================================================================

domain Messaging {
  
  entity Topic {
    // ========================================================================
    // IDENTITY
    // ========================================================================
    
    name: TopicName [immutable, unique, indexed]
    
    // ========================================================================
    // CONFIGURATION
    // ========================================================================
    
    content_based_deduplication: Boolean { default: false }
    deduplication_window: Duration { default: 5.minutes }
    
    // ========================================================================
    // DELIVERY
    // ========================================================================
    
    delivery_policy: DeliveryPolicy?
    
    // ========================================================================
    // STATISTICS
    // ========================================================================
    
    subscription_count: Int [computed]
    messages_published: Int [computed]
    messages_delivered: Int [computed]
    
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
      subscription_count >= 0
      messages_published >= 0
      messages_delivered >= 0
      messages_delivered <= messages_published * subscription_count
      deduplication_window >= 1.minute
      deduplication_window <= 24.hours
    }
  }
  
  // ==========================================================================
  // DELIVERY POLICY
  // ==========================================================================
  
  type DeliveryPolicy = {
    max_retries: Int { min: 0, max: 100 }
    retry_backoff: BackoffPolicy
    dead_letter_topic: TopicName?
  }
  
  type BackoffPolicy = {
    type: "linear" | "exponential"
    initial_delay: Duration
    max_delay: Duration
    multiplier: Decimal?
  }
  
  // ==========================================================================
  // SUBSCRIPTION ENTITY
  // ==========================================================================
  
  entity Subscription {
    // ========================================================================
    // IDENTITY
    // ========================================================================
    
    id: SubscriptionId [immutable, unique]
    
    // ========================================================================
    // ROUTING
    // ========================================================================
    
    topic: TopicName [immutable, indexed]
    queue: QueueName [indexed]
    
    // ========================================================================
    // FILTERING
    // ========================================================================
    
    filter: FilterExpression?
    
    // ========================================================================
    // CONFIGURATION
    // ========================================================================
    
    raw_message_delivery: Boolean { default: false }
    enable_batching: Boolean { default: true }
    batch_size: Int { default: 10, min: 1, max: 100 }
    batch_window: Duration { default: 100.ms }
    
    // ========================================================================
    // STATE
    // ========================================================================
    
    enabled: Boolean { default: true }
    
    // ========================================================================
    // STATISTICS
    // ========================================================================
    
    messages_received: Int [computed]
    messages_filtered: Int [computed]
    messages_delivered: Int [computed]
    
    // ========================================================================
    // METADATA
    // ========================================================================
    
    created_at: Timestamp [immutable]
    updated_at: Timestamp
    
    // ========================================================================
    // INVARIANTS
    // ========================================================================
    
    invariants {
      // Topic and queue must exist
      Topic.exists(topic)
      Queue.exists(queue)
      
      // Statistics consistency
      messages_received >= 0
      messages_filtered >= 0
      messages_delivered >= 0
      messages_filtered <= messages_received
      messages_delivered <= messages_received - messages_filtered
      
      // Batching configuration
      batch_size >= 1
      batch_size <= 100
      batch_window >= 10.ms
      batch_window <= 30.seconds
      
      // Unique subscription per topic-queue pair
      unique(topic, queue)
    }
  }
  
  // ==========================================================================
  // TOPIC OPERATIONS
  // ==========================================================================
  
  behavior CreateTopic {
    description: "Create a new pub/sub topic"
    
    input {
      name: TopicName
      content_based_deduplication: Boolean?
      deduplication_window: Duration?
      delivery_policy: DeliveryPolicy?
      tags: Map<String, String>?
    }
    
    output {
      success: Topic
      errors {
        TOPIC_ALREADY_EXISTS { when: "Topic with name already exists" }
        INVALID_CONFIGURATION { when: "Invalid topic configuration" }
      }
    }
    
    preconditions {
      not Topic.exists(input.name)
    }
    
    postconditions {
      success implies {
        Topic.exists(result.name)
        result.name == input.name
        result.subscription_count == 0
      }
    }
  }
  
  behavior DeleteTopic {
    description: "Delete a pub/sub topic"
    
    input {
      name: TopicName
      force: Boolean { default: false }
    }
    
    output {
      success: Boolean
      errors {
        TOPIC_NOT_FOUND { when: "Topic does not exist" }
        TOPIC_HAS_SUBSCRIPTIONS { when: "Topic has subscriptions and force=false" }
      }
    }
    
    preconditions {
      Topic.exists(input.name)
      input.force or Topic.lookup(input.name).subscription_count == 0
    }
    
    postconditions {
      success implies not Topic.exists(input.name)
    }
  }
  
  behavior ListSubscriptions {
    description: "List subscriptions for a topic"
    
    input {
      topic: TopicName
      limit: Int { default: 100, max: 1000 }
      cursor: String?
    }
    
    output {
      success: {
        subscriptions: List<Subscription>
        next_cursor: String?
      }
      errors {
        TOPIC_NOT_FOUND { when: "Topic does not exist" }
      }
    }
    
    postconditions {
      success implies result.subscriptions.length <= input.limit
    }
  }
}
