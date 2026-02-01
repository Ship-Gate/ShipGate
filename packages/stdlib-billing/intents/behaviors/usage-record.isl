// ============================================================================
// Usage Recording Behaviors (for Metered Billing)
// ============================================================================

behavior RecordUsage {
  description: "Record usage for metered billing subscriptions"
  
  actors {
    service: Internal
    admin: Admin
  }
  
  input {
    subscription_id: SubscriptionId
    subscription_item_id: String?  // Specific item if multiple
    
    // Usage
    quantity: Int { min: 1 }
    
    // Timing
    timestamp: Timestamp?  // Default: now
    
    // Action
    action: UsageAction?  // Default: INCREMENT
    
    // Idempotency
    idempotency_key: String { max_length: 255 }?
  }
  
  output {
    success: UsageRecord
    errors {
      SUBSCRIPTION_NOT_FOUND {
        retriable: false
      }
      SUBSCRIPTION_ITEM_NOT_FOUND {
        retriable: false
      }
      NOT_METERED_SUBSCRIPTION {
        when: "Subscription is not on a metered plan"
        retriable: false
      }
      INVALID_TIMESTAMP {
        when: "Timestamp is outside current billing period"
        retriable: false
      }
      DUPLICATE_USAGE {
        when: "Usage with this idempotency key already recorded"
        retriable: false
      }
      SUBSCRIPTION_CANCELED {
        when: "Cannot record usage for canceled subscription"
        retriable: false
      }
    }
  }
  
  preconditions {
    // Subscription must exist
    Subscription.exists(input.subscription_id)
    
    // Subscription must be active
    Subscription.lookup(input.subscription_id).status in [ACTIVE, TRIALING, PAST_DUE]
    
    // Must be metered plan
    Plan.lookup(Subscription.lookup(input.subscription_id).plan_id).usage_type == METERED
    
    // Timestamp must be in current or past billing period
    input.timestamp == null or input.timestamp <= now()
    input.timestamp == null or input.timestamp >= Subscription.lookup(input.subscription_id).current_period_start
  }
  
  postconditions {
    success implies {
      result.subscription_id == input.subscription_id
      result.quantity == input.quantity
      result.action == (input.action ?? INCREMENT)
      
      // Timestamp is set
      input.timestamp != null implies result.timestamp == input.timestamp
      input.timestamp == null implies result.timestamp <= now()
    }
  }
  
  // Idempotency invariant
  invariants {
    input.idempotency_key != null implies {
      same(input.idempotency_key) implies same(result)
    }
  }
  
  temporal {
    response within 200.ms (p99)
  }
  
  observability {
    metrics {
      usage_recorded: counter { labels: [subscription_id, action] }
      usage_quantity: histogram { labels: [plan_id] }
    }
    
    logs {
      success: debug { include: [subscription_id, quantity, action] }
      error: warn { include: [subscription_id, error_code] }
    }
  }
}

// ============================================================================
// Get Usage Summary Behavior
// ============================================================================

behavior GetUsageSummary {
  description: "Get usage summary for a subscription's billing period"
  
  actors {
    customer: Customer
    admin: Admin
    service: Internal
  }
  
  input {
    subscription_id: SubscriptionId
    subscription_item_id: String?
    
    // Period (optional - defaults to current period)
    period_start: Timestamp?
    period_end: Timestamp?
  }
  
  output {
    success: UsageSummary
    errors {
      SUBSCRIPTION_NOT_FOUND { }
      NOT_METERED_SUBSCRIPTION { }
      INVALID_PERIOD { when: "Period is invalid" }
    }
  }
  
  preconditions {
    Subscription.exists(input.subscription_id)
    input.period_start != null and input.period_end != null implies {
      input.period_start < input.period_end
    }
  }
  
  postconditions {
    success implies {
      result.subscription_id == input.subscription_id
      result.total_usage >= 0
    }
  }
  
  temporal {
    response within 500.ms (p99)
  }
  
  security {
    requires authentication
    
    actor is Customer implies {
      Subscription.lookup(input.subscription_id).customer_id == actor.id
    }
  }
}

// ============================================================================
// List Usage Records Behavior
// ============================================================================

behavior ListUsageRecords {
  description: "List usage records for a subscription"
  
  input {
    subscription_id: SubscriptionId
    subscription_item_id: String?
    
    // Pagination
    limit: Int { min: 1, max: 100 }?
    starting_after: String?  // Cursor
    ending_before: String?
    
    // Filters
    period_start: Timestamp?
    period_end: Timestamp?
  }
  
  output {
    success: ListUsageRecordsResult
    errors {
      SUBSCRIPTION_NOT_FOUND { }
    }
  }
  
  preconditions {
    Subscription.exists(input.subscription_id)
  }
  
  postconditions {
    success implies {
      result.records.length <= (input.limit ?? 10)
    }
  }
}

type ListUsageRecordsResult = {
  records: List<UsageRecord>
  has_more: Boolean
  total_count: Int?
}

// ============================================================================
// Create Usage Report Behavior
// ============================================================================

behavior CreateUsageReport {
  description: "Generate a detailed usage report"
  
  input {
    subscription_id: SubscriptionId
    
    // Period
    period_start: Timestamp
    period_end: Timestamp
    
    // Options
    group_by: UsageGroupBy?
    include_records: Boolean?
    format: ReportFormat?
  }
  
  output {
    success: UsageReport
    errors {
      SUBSCRIPTION_NOT_FOUND { }
      INVALID_PERIOD { }
    }
  }
  
  preconditions {
    Subscription.exists(input.subscription_id)
    input.period_start < input.period_end
    input.period_end <= now()
  }
}

type UsageReport = {
  subscription_id: SubscriptionId
  period_start: Timestamp
  period_end: Timestamp
  
  // Summary
  total_usage: Int
  total_amount: Money
  
  // Breakdown
  daily_breakdown: List<DailyUsage>?
  
  // Details
  records: List<UsageRecord>?
  
  // Generated
  generated_at: Timestamp
  report_url: String?
}

type DailyUsage = {
  date: Timestamp
  quantity: Int
  amount: Money
}

enum UsageGroupBy {
  DAY
  WEEK
  MONTH
}

enum ReportFormat {
  JSON
  CSV
  PDF
}

// ============================================================================
// Set Usage Threshold Alert
// ============================================================================

behavior SetUsageThresholdAlert {
  description: "Set an alert when usage reaches a threshold"
  
  input {
    subscription_id: SubscriptionId
    threshold_quantity: Int { min: 1 }
    notify_email: String { format: email }?
    webhook_url: String { format: url }?
  }
  
  output {
    success: UsageThresholdAlert
    errors {
      SUBSCRIPTION_NOT_FOUND { }
      NOT_METERED_SUBSCRIPTION { }
    }
  }
  
  preconditions {
    Subscription.exists(input.subscription_id)
    Plan.lookup(Subscription.lookup(input.subscription_id).plan_id).usage_type == METERED
  }
  
  postconditions {
    success implies {
      result.subscription_id == input.subscription_id
      result.threshold_quantity == input.threshold_quantity
      result.active == true
    }
  }
  
  temporal {
    // Alert should fire when threshold is reached
    eventually within 5.minutes of threshold_reached: alert_sent
  }
}

type UsageThresholdAlert = {
  id: String
  subscription_id: SubscriptionId
  threshold_quantity: Int
  notify_email: String?
  webhook_url: String?
  active: Boolean
  triggered: Boolean
  triggered_at: Timestamp?
}

// ============================================================================
// Reset Usage (for testing/admin)
// ============================================================================

behavior ResetUsage {
  description: "Reset usage for a subscription (admin only)"
  
  actors {
    admin: Admin
  }
  
  input {
    subscription_id: SubscriptionId
    subscription_item_id: String?
    reason: String
  }
  
  output {
    success: { reset_count: Int, previous_total: Int }
    errors {
      SUBSCRIPTION_NOT_FOUND { }
      NOT_METERED_SUBSCRIPTION { }
    }
  }
  
  preconditions {
    Subscription.exists(input.subscription_id)
  }
  
  postconditions {
    success implies {
      GetUsageSummary(input.subscription_id).total_usage == 0
    }
  }
  
  compliance {
    audit {
      log_reason: required
      log_actor: required
      log_previous_value: required
    }
  }
}
