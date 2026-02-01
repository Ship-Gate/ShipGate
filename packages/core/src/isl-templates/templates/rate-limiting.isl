# Rate Limiting Domain
# Complete rate limiting with multiple strategies and quota management

domain RateLimiting {
  version: "1.0.0"
  
  # ============================================
  # Types
  # ============================================
  
  type RateLimit = Int { min: 0 }
  type WindowSize = Int { min: 1 }  # seconds
  type Identifier = String { max_length: 255 }
  
  enum LimitStrategy {
    FIXED_WINDOW
    SLIDING_WINDOW
    TOKEN_BUCKET
    LEAKY_BUCKET
  }
  
  enum LimitScope {
    GLOBAL
    USER
    IP
    API_KEY
    ENDPOINT
    CUSTOM
  }
  
  # ============================================
  # Entities
  # ============================================
  
  entity RateLimitRule {
    id: UUID [immutable, unique]
    name: String { max_length: 255 } [unique]
    description: String?
    strategy: LimitStrategy
    scope: LimitScope
    limit: RateLimit
    window_seconds: WindowSize
    burst_limit: RateLimit?
    endpoint_pattern: String?
    priority: Int [default: 0]
    is_active: Boolean [default: true]
    metadata: Map<String, String>
    created_at: Timestamp [immutable]
    updated_at: Timestamp
    
    invariants {
      limit > 0
      window_seconds > 0
      burst_limit == null or burst_limit >= limit
    }
  }
  
  entity RateLimitCounter {
    id: UUID [immutable, unique]
    rule_id: UUID [indexed]
    identifier: Identifier [indexed]
    count: Int [default: 0]
    window_start: Timestamp
    window_end: Timestamp
    tokens: Decimal?  # For token bucket
    last_refill: Timestamp?
    created_at: Timestamp [immutable]
    updated_at: Timestamp
    
    invariants {
      count >= 0
      window_end > window_start
      tokens == null or tokens >= 0
    }
  }
  
  entity RateLimitOverride {
    id: UUID [immutable, unique]
    rule_id: UUID [indexed]
    identifier: Identifier [indexed]
    override_limit: RateLimit?
    override_window: WindowSize?
    is_exempt: Boolean [default: false]
    reason: String?
    expires_at: Timestamp?
    created_by: UUID
    created_at: Timestamp [immutable]
    
    invariants {
      is_exempt or override_limit != null or override_window != null
    }
  }
  
  entity QuotaAllocation {
    id: UUID [immutable, unique]
    owner_id: UUID [indexed]
    resource_type: String [indexed]
    allocated: Int
    used: Int [default: 0]
    period_start: Timestamp
    period_end: Timestamp
    rollover_enabled: Boolean [default: false]
    created_at: Timestamp [immutable]
    updated_at: Timestamp
    
    invariants {
      allocated > 0
      used >= 0
      used <= allocated or rollover_enabled
      period_end > period_start
    }
  }
  
  # ============================================
  # Behaviors
  # ============================================
  
  behavior CheckRateLimit {
    description: "Check if a request is within rate limits"
    
    actors {
      System { }
    }
    
    input {
      identifier: Identifier
      endpoint: String?
      scope: LimitScope
      cost: Int [default: 1]
    }
    
    output {
      success: {
        allowed: Boolean
        remaining: Int
        reset_at: Timestamp
        retry_after: Int?
        limit: RateLimit
        headers: Map<String, String>
      }
      
      errors {
        RULE_NOT_FOUND {
          when: "No rate limit rule found for this scope"
          retriable: false
        }
      }
    }
    
    postconditions {
      success implies {
        result.allowed implies result.remaining >= 0
        not result.allowed implies result.retry_after != null
      }
    }
    
    temporal {
      response within 5ms (p50)
      response within 20ms (p99)
    }
  }
  
  behavior ConsumeRateLimit {
    description: "Consume rate limit tokens/count"
    
    actors {
      System { }
    }
    
    input {
      identifier: Identifier
      scope: LimitScope
      cost: Int [default: 1]
      endpoint: String?
    }
    
    output {
      success: {
        consumed: Boolean
        remaining: Int
        reset_at: Timestamp
      }
      
      errors {
        RATE_LIMITED {
          when: "Rate limit exceeded"
          retriable: true
        }
      }
    }
    
    postconditions {
      success implies {
        RateLimitCounter.lookup(identifier).count == 
          old(RateLimitCounter.lookup(identifier).count) + input.cost
      }
    }
  }
  
  behavior CreateRule {
    description: "Create a new rate limit rule"
    
    actors {
      Admin { must: authenticated }
    }
    
    input {
      name: String
      description: String?
      strategy: LimitStrategy
      scope: LimitScope
      limit: RateLimit
      window_seconds: WindowSize
      burst_limit: RateLimit?
      endpoint_pattern: String?
      priority: Int?
    }
    
    output {
      success: RateLimitRule
      
      errors {
        RULE_ALREADY_EXISTS {
          when: "A rule with this name already exists"
          retriable: false
        }
        INVALID_PATTERN {
          when: "Endpoint pattern is invalid"
          retriable: false
        }
      }
    }
    
    postconditions {
      success implies {
        RateLimitRule.exists(result.id)
      }
    }
  }
  
  behavior UpdateRule {
    description: "Update an existing rate limit rule"
    
    actors {
      Admin { must: authenticated }
    }
    
    input {
      rule_id: UUID
      limit: RateLimit?
      window_seconds: WindowSize?
      burst_limit: RateLimit?
      is_active: Boolean?
    }
    
    output {
      success: RateLimitRule
      
      errors {
        RULE_NOT_FOUND {
          when: "Rule does not exist"
          retriable: false
        }
      }
    }
    
    temporal {
      eventually within 10s: all nodes updated
    }
  }
  
  behavior CreateOverride {
    description: "Create a rate limit override for a specific identifier"
    
    actors {
      Admin { must: authenticated }
    }
    
    input {
      rule_id: UUID
      identifier: Identifier
      override_limit: RateLimit?
      override_window: WindowSize?
      is_exempt: Boolean?
      reason: String?
      expires_at: Timestamp?
    }
    
    output {
      success: RateLimitOverride
      
      errors {
        RULE_NOT_FOUND {
          when: "Rule does not exist"
          retriable: false
        }
        OVERRIDE_EXISTS {
          when: "Override already exists for this identifier"
          retriable: false
        }
      }
    }
    
    security {
      audit_log enabled
    }
  }
  
  behavior AllocateQuota {
    description: "Allocate quota for a resource type"
    
    actors {
      Admin { must: authenticated }
      System { }
    }
    
    input {
      owner_id: UUID
      resource_type: String
      allocated: Int
      period_days: Int [default: 30]
      rollover_enabled: Boolean?
    }
    
    output {
      success: QuotaAllocation
      
      errors {
        ALLOCATION_EXISTS {
          when: "Active allocation already exists"
          retriable: false
        }
        INVALID_AMOUNT {
          when: "Allocation amount is invalid"
          retriable: false
        }
      }
    }
  }
  
  behavior ConsumeQuota {
    description: "Consume from allocated quota"
    
    actors {
      System { }
    }
    
    input {
      owner_id: UUID
      resource_type: String
      amount: Int [default: 1]
    }
    
    output {
      success: {
        consumed: Boolean
        remaining: Int
        total: Int
      }
      
      errors {
        NO_ALLOCATION {
          when: "No active quota allocation"
          retriable: false
        }
        QUOTA_EXCEEDED {
          when: "Quota exceeded"
          retriable: false
        }
      }
    }
    
    postconditions {
      success implies {
        QuotaAllocation.lookup(owner_id, resource_type).used == 
          old(QuotaAllocation.lookup(owner_id, resource_type).used) + input.amount
      }
    }
  }
  
  behavior GetUsageStats {
    description: "Get rate limit usage statistics"
    
    actors {
      User { must: authenticated }
      Admin { must: authenticated }
    }
    
    input {
      identifier: Identifier?
      scope: LimitScope?
      from_date: Timestamp?
      to_date: Timestamp?
    }
    
    output {
      success: {
        total_requests: Int
        allowed_requests: Int
        blocked_requests: Int
        peak_rate: Int
        average_rate: Decimal
        by_endpoint: Map<String, Int>?
      }
    }
  }
  
  # ============================================
  # Scenarios
  # ============================================
  
  scenarios CheckRateLimit {
    scenario "within limit" {
      given {
        rule = RateLimitRule.create(
          name: "api-default",
          strategy: SLIDING_WINDOW,
          scope: USER,
          limit: 100,
          window_seconds: 60
        )
        counter = RateLimitCounter.create(
          rule_id: rule.id,
          identifier: "user-123",
          count: 50
        )
      }
      
      when {
        result = CheckRateLimit(
          identifier: "user-123",
          scope: USER
        )
      }
      
      then {
        result is success
        result.allowed == true
        result.remaining == 49
      }
    }
    
    scenario "rate limited" {
      given {
        rule = RateLimitRule.create(
          name: "api-default",
          strategy: FIXED_WINDOW,
          scope: USER,
          limit: 100,
          window_seconds: 60
        )
        counter = RateLimitCounter.create(
          rule_id: rule.id,
          identifier: "user-123",
          count: 100
        )
      }
      
      when {
        result = CheckRateLimit(
          identifier: "user-123",
          scope: USER
        )
      }
      
      then {
        result is success
        result.allowed == false
        result.retry_after > 0
      }
    }
    
    scenario "with override exemption" {
      given {
        rule = RateLimitRule.create(
          name: "api-default",
          limit: 100,
          window_seconds: 60
        )
        override = RateLimitOverride.create(
          rule_id: rule.id,
          identifier: "premium-user",
          is_exempt: true
        )
      }
      
      when {
        result = CheckRateLimit(
          identifier: "premium-user",
          scope: USER
        )
      }
      
      then {
        result is success
        result.allowed == true
        result.limit == Int.MAX
      }
    }
  }
}
