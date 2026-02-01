// ============================================================================
// Subscribe Behavior
// ============================================================================
// Create and manage topic subscriptions
// ============================================================================

domain Messaging {
  
  behavior Subscribe {
    description: "Subscribe a queue to a topic"
    
    actors {
      subscriber: {
        with_permission: "messaging:subscribe"
        for: input.topic
      }
    }
    
    // ========================================================================
    // INPUT
    // ========================================================================
    
    input {
      topic: TopicName
      queue: QueueName
      filter: FilterExpression?
      
      // Delivery options
      raw_message_delivery: Boolean { default: false }
      enable_batching: Boolean { default: true }
      batch_size: Int { default: 10, min: 1, max: 100 }
      batch_window: Duration { default: 100.ms, min: 10.ms, max: 30.seconds }
    }
    
    // ========================================================================
    // OUTPUT
    // ========================================================================
    
    output {
      success: Subscription
      errors {
        TOPIC_NOT_FOUND {
          when: "Topic does not exist"
        }
        QUEUE_NOT_FOUND {
          when: "Queue does not exist"
        }
        DUPLICATE_SUBSCRIPTION {
          when: "Queue is already subscribed to this topic"
        }
        INVALID_FILTER {
          when: "Filter expression is invalid"
        }
        SUBSCRIPTION_LIMIT_EXCEEDED {
          when: "Maximum subscriptions per topic exceeded"
        }
      }
    }
    
    // ========================================================================
    // PRECONDITIONS
    // ========================================================================
    
    preconditions {
      Topic.exists(input.topic)
      Queue.exists(input.queue)
      not Subscription.exists_where(topic == input.topic and queue == input.queue)
    }
    
    // ========================================================================
    // POSTCONDITIONS
    // ========================================================================
    
    postconditions {
      success implies {
        Subscription.exists(result.id)
        result.topic == input.topic
        result.queue == input.queue
        result.filter == input.filter
        result.enabled == true
        result.messages_received == 0
        result.messages_delivered == 0
        
        // Topic subscription count incremented
        Topic.lookup(input.topic).subscription_count == 
          old(Topic.lookup(input.topic).subscription_count) + 1
      }
    }
    
    // ========================================================================
    // TEMPORAL
    // ========================================================================
    
    temporal {
      response within 100.ms (p99)
    }
    
    // ========================================================================
    // SECURITY
    // ========================================================================
    
    security {
      requires: permission("messaging:subscribe", input.topic)
      requires: permission("messaging:receive", input.queue)
    }
  }
  
  // ==========================================================================
  // UNSUBSCRIBE
  // ==========================================================================
  
  behavior Unsubscribe {
    description: "Remove a subscription from a topic"
    
    input {
      subscription_id: SubscriptionId
    }
    
    output {
      success: Boolean
      errors {
        SUBSCRIPTION_NOT_FOUND {
          when: "Subscription does not exist"
        }
      }
    }
    
    preconditions {
      Subscription.exists(input.subscription_id)
    }
    
    postconditions {
      success implies {
        not Subscription.exists(input.subscription_id)
        
        // Topic subscription count decremented
        let sub = old(Subscription.lookup(input.subscription_id))
        Topic.lookup(sub.topic).subscription_count ==
          old(Topic.lookup(sub.topic).subscription_count) - 1
      }
    }
    
    temporal {
      response within 100.ms (p99)
    }
  }
  
  // ==========================================================================
  // UPDATE SUBSCRIPTION
  // ==========================================================================
  
  behavior UpdateSubscription {
    description: "Update subscription configuration"
    
    input {
      subscription_id: SubscriptionId
      filter: FilterExpression?
      raw_message_delivery: Boolean?
      enable_batching: Boolean?
      batch_size: Int?
      batch_window: Duration?
      enabled: Boolean?
    }
    
    output {
      success: Subscription
      errors {
        SUBSCRIPTION_NOT_FOUND {
          when: "Subscription does not exist"
        }
        INVALID_FILTER {
          when: "Filter expression is invalid"
        }
        INVALID_CONFIGURATION {
          when: "Configuration values are invalid"
        }
      }
    }
    
    preconditions {
      Subscription.exists(input.subscription_id)
      input.batch_size == null or (input.batch_size >= 1 and input.batch_size <= 100)
    }
    
    postconditions {
      success implies {
        result.id == input.subscription_id
        input.filter != null implies result.filter == input.filter
        input.enabled != null implies result.enabled == input.enabled
        result.updated_at >= old(Subscription.lookup(input.subscription_id).updated_at)
      }
    }
  }
  
  // ==========================================================================
  // GET SUBSCRIPTION
  // ==========================================================================
  
  behavior GetSubscription {
    description: "Get subscription details"
    
    input {
      subscription_id: SubscriptionId
    }
    
    output {
      success: Subscription
      errors {
        SUBSCRIPTION_NOT_FOUND {
          when: "Subscription does not exist"
        }
      }
    }
    
    temporal {
      response within 20.ms (p99)
    }
  }
}
