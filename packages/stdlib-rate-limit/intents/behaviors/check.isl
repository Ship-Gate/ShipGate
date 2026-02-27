// ============================================================================
// ISL Standard Library - Rate Limit Check Behavior
// @stdlib/rate-limit/behaviors/check
// Version: 1.0.0
// ============================================================================

import { RateLimitKey, IdentifierType, RateLimitConfig, CheckResult, RateLimitAction } from "../domain"

// ============================================================================
// CHECK RATE LIMIT
// ============================================================================

/**
 * Check if a request is allowed under rate limiting rules
 * 
 * This is the primary entry point for rate limit checks. It:
 * 1. Identifies the appropriate rate limit bucket
 * 2. Checks current usage against configured limits
 * 3. Returns an action (allow/deny/throttle) with metadata
 */
behavior CheckRateLimit {
  description: "Check if a request should be allowed or rate limited"
  
  input {
    key: RateLimitKey
    identifier_type: IdentifierType
    config_name: String { max_length: 100 }
    weight: Int { min: 1 } [default: 1]  // Cost of this request
    metadata: Map<String, String>?
  }
  
  output {
    success: CheckResult
    
    errors {
      CONFIG_NOT_FOUND {
        when: "Rate limit configuration does not exist"
        retriable: false
      }
      STORAGE_ERROR {
        when: "Failed to access rate limit storage"
        retriable: true
        retry_after: 100ms
      }
    }
  }
  
  pre {
    key.length > 0
    config_name.length > 0
    weight >= 1
  }
  
  post success {
    result.limit > 0
    result.remaining >= 0
    result.remaining <= result.limit
    result.reset_at > now()
    result.allowed == (result.action == ALLOW or result.action == WARN)
    
    // Headers should be populated for client info
    result.headers != null implies {
      "X-RateLimit-Limit" in result.headers
      "X-RateLimit-Remaining" in result.headers
      "X-RateLimit-Reset" in result.headers
    }
  }
  
  temporal {
    within 10ms (p50): response returned
    within 50ms (p99): response returned
  }
  
  security {
    // No authentication required - checked inline
  }
}

// ============================================================================
// INCREMENT COUNTER
// ============================================================================

/**
 * Increment the rate limit counter after a request
 * 
 * Called after a request completes to record its cost.
 * Typically called asynchronously after CheckRateLimit.
 */
behavior IncrementCounter {
  description: "Increment rate limit counter for a completed request"
  
  input {
    key: RateLimitKey
    identifier_type: IdentifierType
    config_name: String
    amount: Int { min: 1 } [default: 1]
    success: Boolean [default: true]  // Whether the request succeeded
  }
  
  output {
    success: {
      new_count: Int
      remaining: Int
      action: RateLimitAction
    }
    
    errors {
      STORAGE_ERROR {
        when: "Failed to update rate limit counter"
        retriable: true
      }
    }
  }
  
  pre {
    key.length > 0
    amount >= 1
  }
  
  post success {
    result.new_count >= input.amount
    result.remaining >= 0
    
    // If success was false, optionally don't count against limit
  }
  
  temporal {
    within 20ms (p99): response returned
  }
}

// ============================================================================
// CHECK AND INCREMENT (ATOMIC)
// ============================================================================

/**
 * Atomically check and increment rate limit
 * 
 * Combines check and increment into a single atomic operation.
 * Use this when you need guaranteed accuracy without race conditions.
 */
behavior CheckAndIncrement {
  description: "Atomically check rate limit and increment counter"
  
  input {
    key: RateLimitKey
    identifier_type: IdentifierType
    config_name: String
    weight: Int { min: 1 } [default: 1]
    metadata: Map<String, String>?
  }
  
  output {
    success: CheckResult
    
    errors {
      CONFIG_NOT_FOUND {
        when: "Rate limit configuration does not exist"
        retriable: false
      }
      RATE_LIMITED {
        when: "Request denied due to rate limit"
        retriable: true
        retry_after: varies
      }
      STORAGE_ERROR {
        when: "Failed to access rate limit storage"
        retriable: true
      }
    }
  }
  
  pre {
    key.length > 0
    config_name.length > 0
  }
  
  post success {
    result.allowed == true
    result.remaining == old(remaining) - input.weight
  }
  
  post RATE_LIMITED {
    result.retry_after != null
    result.allowed == false
  }
  
  invariants {
    operation is atomic
    no double-counting on retry
  }
  
  temporal {
    within 15ms (p50): response returned
    within 75ms (p99): response returned
  }
}

// ============================================================================
// GET BUCKET STATUS
// ============================================================================

/**
 * Get current status of a rate limit bucket without incrementing
 * 
 * Useful for dashboard displays or debugging.
 */
behavior GetBucketStatus {
  description: "Get current rate limit bucket status"
  
  input {
    key: RateLimitKey
    identifier_type: IdentifierType
    config_name: String
  }
  
  output {
    success: {
      bucket: RateLimitBucket?
      state: BucketState
      is_blocked: Boolean
      block_expires_at: Timestamp?
    }
    
    errors {
      CONFIG_NOT_FOUND {
        when: "Rate limit configuration does not exist"
        retriable: false
      }
    }
  }
  
  post success {
    result.is_blocked implies result.block_expires_at != null
    not result.is_blocked implies result.block_expires_at == null
  }
  
  temporal {
    within 10ms (p99): response returned
  }
}
