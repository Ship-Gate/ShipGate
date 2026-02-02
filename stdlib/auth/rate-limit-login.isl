# Rate Limit Login Module
# Provides brute-force protection and login rate limiting

module RateLimitLogin version "1.0.0"

# ============================================
# Types
# ============================================

type RateLimitKey = String { max_length: 255 }

type RateLimitWindow = Duration { min: 1s, max: 24h }

type RateLimitAction = enum { 
  ALLOW
  WARN
  THROTTLE
  BLOCK
  CAPTCHA_REQUIRED
}

# ============================================
# Entities
# ============================================

entity LoginAttempt {
  id: UUID [immutable, unique]
  identifier: String [indexed]  # email, username, or ip
  identifier_type: enum { EMAIL, USERNAME, IP }
  ip_address: String [indexed]
  timestamp: Timestamp [immutable, indexed]
  success: Boolean
  user_agent: String?
  country_code: String?
  failure_reason: String?
}

entity RateLimitBucket {
  key: RateLimitKey [unique]
  window_start: Timestamp
  window_size: RateLimitWindow
  count: Int [default: 0]
  limit: Int
  blocked_until: Timestamp?

  invariants {
    count >= 0
    limit > 0
    blocked_until == null or blocked_until > window_start
  }
}

entity LoginBlock {
  id: UUID [immutable, unique]
  identifier: String [indexed]
  identifier_type: enum { EMAIL, USERNAME, IP }
  blocked_at: Timestamp [immutable]
  blocked_until: Timestamp
  reason: String
  auto_unblock: Boolean [default: true]

  invariants {
    blocked_until > blocked_at
  }
}

# ============================================
# Behaviors
# ============================================

behavior CheckLoginRateLimit {
  description: "Check if login attempt is allowed"

  input {
    email: String { format: "email" }
    ip_address: String
  }

  output {
    success: {
      action: RateLimitAction
      remaining_attempts: Int?
      retry_after: Duration?
      captcha_required: Boolean
    }

    errors {
      BLOCKED {
        when: "Identifier is blocked"
        retriable: true
        retry_after: varies
      }
    }
  }

  pre {
    email.is_valid_format
  }

  post success {
    result.action == ALLOW implies result.remaining_attempts > 0
    result.action == BLOCK implies result.retry_after != null
    result.action == THROTTLE implies result.retry_after != null
    result.action == CAPTCHA_REQUIRED implies result.captcha_required == true
  }

  temporal {
    within 20ms (p99): response returned
  }
}

behavior RecordLoginAttempt {
  description: "Record a login attempt for rate limiting"

  input {
    email: String { format: "email" }
    ip_address: String
    success: Boolean
    user_agent: String?
    failure_reason: String?
  }

  output {
    success: {
      attempt_id: UUID
      current_count: Int
      action: RateLimitAction
    }
  }

  post success {
    LoginAttempt.exists(result.attempt_id)
    LoginAttempt.lookup(result.attempt_id).identifier == input.email
    LoginAttempt.lookup(result.attempt_id).success == input.success
  }

  post failure_recorded when not input.success {
    result.current_count > 0
    result.current_count > old(bucket.count)
  }

  temporal {
    within 50ms (p99): response returned
  }
}

behavior BlockIdentifier {
  description: "Block an identifier from logging in"

  input {
    identifier: String
    identifier_type: enum { EMAIL, USERNAME, IP }
    duration: Duration
    reason: String
    auto_unblock: Boolean [default: true]
  }

  output {
    success: LoginBlock

    errors {
      ALREADY_BLOCKED {
        when: "Identifier is already blocked"
        retriable: false
      }
      INVALID_DURATION {
        when: "Block duration out of allowed range"
        retriable: false
      }
    }
  }

  pre {
    duration >= 1m
    duration <= 30d
  }

  post success {
    LoginBlock.exists(result.id)
    result.blocked_until == now() + input.duration
    result.reason == input.reason
  }

  temporal {
    within 100ms (p99): response returned
    eventually within 5s: block_created event emitted
  }
}

behavior UnblockIdentifier {
  description: "Remove a login block"

  input {
    identifier: String
    identifier_type: enum { EMAIL, USERNAME, IP }
    reason: String?
  }

  output {
    success: Boolean

    errors {
      NOT_BLOCKED {
        when: "Identifier is not blocked"
        retriable: false
      }
    }
  }

  pre {
    LoginBlock.exists_for(identifier, identifier_type)
  }

  post success {
    not LoginBlock.exists_for(input.identifier, input.identifier_type)
  }

  temporal {
    within 100ms (p99): response returned
    eventually within 5s: block_removed event emitted
  }
}

behavior GetLoginAttemptHistory {
  description: "Get recent login attempts for an identifier"

  input {
    identifier: String
    identifier_type: enum { EMAIL, USERNAME, IP }
    limit: Int { min: 1, max: 100 } [default: 20]
    since: Timestamp?
  }

  output {
    success: {
      attempts: List<LoginAttempt>
      total_count: Int
      failed_count: Int
      success_count: Int
    }
  }

  post success {
    result.attempts.length <= input.limit
    result.total_count == result.failed_count + result.success_count
    forall a in result.attempts:
      a.identifier == input.identifier
      input.since == null or a.timestamp >= input.since
  }

  temporal {
    within 200ms (p99): response returned
  }
}

behavior ResetRateLimit {
  description: "Reset rate limit counters for an identifier"

  input {
    identifier: String
    identifier_type: enum { EMAIL, USERNAME, IP }
    reason: String
  }

  output {
    success: Boolean

    errors {
      NOT_FOUND {
        when: "No rate limit data found"
        retriable: false
      }
    }
  }

  post success {
    RateLimitBucket.lookup(input.identifier).count == 0
  }

  temporal {
    within 50ms (p99): response returned
    eventually within 5s: rate_limit_reset event emitted
  }

  security {
    requires admin authentication
    audit_log required
  }
}
