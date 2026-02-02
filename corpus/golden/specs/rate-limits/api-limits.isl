// Rate Limits: API rate limiting
domain RateLimitsAPI {
  version: "1.0.0"

  enum LimitType {
    REQUESTS_PER_SECOND
    REQUESTS_PER_MINUTE
    REQUESTS_PER_HOUR
    REQUESTS_PER_DAY
    CONCURRENT
    BANDWIDTH
  }

  enum LimitScope {
    GLOBAL
    USER
    API_KEY
    IP_ADDRESS
    ENDPOINT
  }

  entity RateLimitRule {
    id: UUID [immutable, unique]
    name: String
    type: LimitType
    scope: LimitScope
    limit: Int
    window_seconds: Int?
    burst_limit: Int?
    enabled: Boolean [default: true]
    endpoints: List<String>?
    created_at: Timestamp [immutable]
    updated_at: Timestamp

    invariants {
      limit > 0
      window_seconds == null or window_seconds > 0
      burst_limit == null or burst_limit >= limit
    }
  }

  entity RateLimitState {
    id: UUID [immutable, unique]
    rule_id: UUID [indexed]
    identifier: String [indexed]
    current_count: Int
    window_start: Timestamp
    last_request: Timestamp
    updated_at: Timestamp

    invariants {
      current_count >= 0
    }
  }

  behavior CheckRateLimit {
    description: "Check if request is allowed"

    actors {
      System { }
    }

    input {
      identifier: String
      endpoint: String?
      scope: LimitScope
    }

    output {
      success: {
        allowed: Boolean
        remaining: Int
        limit: Int
        reset_at: Timestamp
        retry_after: Int?
      }
    }

    pre {
      input.identifier.length > 0
    }

    post success {
      - result.remaining >= 0
      - result.remaining <= result.limit
      - result.allowed == false implies result.retry_after != null
    }

    temporal {
      - within 5ms (p50): response returned
      - within 20ms (p99): response returned
    }
  }

  behavior IncrementCounter {
    description: "Increment rate limit counter"

    actors {
      System { }
    }

    input {
      identifier: String
      rule_id: UUID
      count: Int?
    }

    output {
      success: RateLimitState

      errors {
        RULE_NOT_FOUND {
          when: "Rule not found"
          retriable: false
        }
      }
    }

    post success {
      - result.current_count > old(result.current_count) or result.window_start > old(result.window_start)
    }
  }

  behavior GetRateLimitStatus {
    description: "Get current rate limit status"

    actors {
      User { must: authenticated }
    }

    input {
      scope: LimitScope?
    }

    output {
      success: List<{
        rule_name: String
        limit: Int
        remaining: Int
        reset_at: Timestamp
        usage_percent: Decimal
      }>
    }
  }

  behavior CreateRateLimitRule {
    description: "Create a rate limit rule"

    actors {
      Admin { must: authenticated }
    }

    input {
      name: String
      type: LimitType
      scope: LimitScope
      limit: Int
      window_seconds: Int?
      burst_limit: Int?
      endpoints: List<String>?
    }

    output {
      success: RateLimitRule

      errors {
        NAME_EXISTS {
          when: "Rule name exists"
          retriable: false
        }
        INVALID_CONFIG {
          when: "Invalid configuration"
          retriable: true
        }
      }
    }

    pre {
      input.limit > 0
    }

    post success {
      - RateLimitRule.exists(result.id)
      - result.enabled == true
    }
  }

  behavior ResetRateLimit {
    description: "Reset rate limit for identifier"

    actors {
      Admin { must: authenticated }
    }

    input {
      identifier: String
      rule_id: UUID?
    }

    output {
      success: { reset_count: Int }

      errors {
        NOT_FOUND {
          when: "No limits found"
          retriable: false
        }
      }
    }

    post success {
      - result.reset_count >= 0
    }
  }

  scenarios CheckRateLimit {
    scenario "within limit" {
      given {
        rule = RateLimitRule.create(type: REQUESTS_PER_MINUTE, limit: 100)
        state = RateLimitState.create(rule_id: rule.id, current_count: 50)
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

    scenario "exceeded limit" {
      given {
        rule = RateLimitRule.create(type: REQUESTS_PER_MINUTE, limit: 100)
        state = RateLimitState.create(rule_id: rule.id, current_count: 100)
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
        result.remaining == 0
        result.retry_after != null
      }
    }
  }
}
