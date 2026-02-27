# Rate Limiting Module
# Provides rate limiting and throttling patterns

module SecurityRateLimit version "1.0.0"

# ============================================
# Types
# ============================================

type RateLimitAlgorithm = enum {
  FIXED_WINDOW
  SLIDING_WINDOW
  TOKEN_BUCKET
  LEAKY_BUCKET
}

type RateLimitScope = enum {
  GLOBAL
  PER_IP
  PER_USER
  PER_API_KEY
  PER_ENDPOINT
  CUSTOM
}

type RateLimitAction = enum {
  REJECT
  THROTTLE
  QUEUE
  DEGRADE
}

type ThrottleMode = enum {
  DELAY
  SKIP
  DEGRADE_RESPONSE
}

# ============================================
# Entities
# ============================================

entity RateLimitConfig {
  name: String { max_length: 128 }
  algorithm: RateLimitAlgorithm [default: SLIDING_WINDOW]
  max_requests: Int { min: 1 }
  window_ms: Int { min: 1000 }
  scope: RateLimitScope [default: PER_IP]
  action: RateLimitAction [default: REJECT]
  burst_allowance: Int { min: 0, default: 0 }
  retry_after_header: Boolean [default: true]

  invariants {
    max_requests >= 1
    window_ms >= 1000
    burst_allowance <= max_requests
  }
}

entity RateLimitState {
  key: String
  request_count: Int { min: 0 }
  window_start: Timestamp
  window_end: Timestamp
  remaining: Int { min: 0 }
  reset_at: Timestamp

  invariants {
    window_end > window_start
    remaining >= 0
    request_count >= 0
    reset_at >= window_start
  }
}

entity RateLimitResult {
  allowed: Boolean
  remaining: Int { min: 0 }
  limit: Int { min: 1 }
  reset_at: Timestamp
  retry_after_ms: Int? { min: 0 }

  invariants {
    not allowed implies retry_after_ms != null
    remaining <= limit
    remaining >= 0
  }
}

entity TokenBucketState {
  key: String
  tokens: Decimal { min: 0 }
  max_tokens: Decimal { min: 1 }
  refill_rate: Decimal { min: 0 }
  last_refill: Timestamp

  invariants {
    tokens <= max_tokens
    tokens >= 0
    refill_rate > 0
  }
}

# ============================================
# Behaviors
# ============================================

behavior CheckRateLimit {
  description: "Check if a request is within rate limits"

  input {
    config: RateLimitConfig
    key: String
    cost: Int { min: 1, default: 1 }
  }

  output {
    success: RateLimitResult

    errors {
      INVALID_KEY {
        when: "Rate limit key is empty or invalid"
        retriable: false
      }
    }
  }

  pre {
    key.length > 0
    cost >= 1
  }

  post success {
    result.limit == input.config.max_requests
    result.remaining >= 0
    result.remaining <= result.limit
    not result.allowed implies result.retry_after_ms > 0
  }

  temporal {
    within 5ms (p99): response returned
  }
}

behavior ConsumeToken {
  description: "Consume tokens from a token bucket"

  input {
    key: String
    tokens_requested: Decimal { min: 0.1, default: 1.0 }
    max_tokens: Decimal { min: 1 }
    refill_rate: Decimal { min: 0.1 }
  }

  output {
    success: {
      allowed: Boolean
      tokens_remaining: Decimal
      wait_time_ms: Int?
    }
  }

  pre {
    key.length > 0
    tokens_requested > 0
    max_tokens >= tokens_requested
  }

  post success {
    result.tokens_remaining >= 0
    result.allowed implies result.tokens_remaining >= 0
    not result.allowed implies result.wait_time_ms > 0
  }

  temporal {
    within 5ms (p99): response returned
  }
}

behavior ResetRateLimit {
  description: "Reset rate limit counter for a key"

  input {
    key: String
    scope: RateLimitScope?
  }

  output {
    success: Boolean

    errors {
      KEY_NOT_FOUND {
        when: "No rate limit state exists for key"
        retriable: false
      }
    }
  }

  pre {
    key.length > 0
  }

  post success {
    result == true
  }
}

behavior GetRateLimitStatus {
  description: "Get current rate limit status without consuming"

  input {
    key: String
    config: RateLimitConfig
  }

  output {
    success: RateLimitState
  }

  pre {
    key.length > 0
  }

  post success {
    result.remaining >= 0
    result.request_count >= 0
  }

  temporal {
    within 5ms (p99): response returned
  }
}
