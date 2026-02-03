// ============================================================================
// ISL Standard Library - Rate Limit Block Behaviors
// @stdlib/rate-limit/behaviors/block
// Version: 1.0.0
// ============================================================================

import { RateLimitKey, IdentifierType, RateLimitBlock, Violation } from "../domain"

// ============================================================================
// BLOCK IDENTIFIER
// ============================================================================

/**
 * Block an identifier from making requests
 * 
 * Used for manual blocks or automated escalation.
 */
behavior BlockIdentifier {
  description: "Block an identifier from making requests"
  
  input {
    key: RateLimitKey
    identifier_type: IdentifierType
    duration: Duration { min: 1s, max: 30d }
    reason: String { max_length: 500 }
    auto_unblock: Boolean [default: true]
    created_by: String?
    metadata: Map<String, String>?
  }
  
  output {
    success: RateLimitBlock
    
    errors {
      ALREADY_BLOCKED {
        when: "Identifier is already blocked"
        retriable: false
      }
      INVALID_DURATION {
        when: "Block duration is invalid"
        retriable: false
      }
    }
  }
  
  pre {
    key.length > 0
    duration >= 1s
    duration <= 30d
    reason.length > 0
  }
  
  post success {
    RateLimitBlock.exists(result.id)
    result.key == input.key
    result.blocked_until == now() + input.duration
    result.reason == input.reason
  }
  
  temporal {
    within 100ms (p99): response returned
    immediately: identifier blocked for new requests
    eventually within 5s: block_created event emitted
  }
  
  security {
    requires authentication
    requires permission: "rate_limit:block"
    audit_log required
  }
}

// ============================================================================
// UNBLOCK IDENTIFIER
// ============================================================================

/**
 * Remove a block from an identifier
 */
behavior UnblockIdentifier {
  description: "Remove a rate limit block"
  
  input {
    key: RateLimitKey
    identifier_type: IdentifierType
    reason: String?
  }
  
  output {
    success: {
      unblocked: Boolean
      was_blocked_until: Timestamp?
    }
    
    errors {
      NOT_BLOCKED {
        when: "Identifier is not currently blocked"
        retriable: false
      }
    }
  }
  
  pre {
    RateLimitBlock.exists_for(key, identifier_type)
  }
  
  post success {
    result.unblocked == true
    not RateLimitBlock.exists_for(input.key, input.identifier_type)
  }
  
  temporal {
    within 100ms (p99): response returned
    immediately: identifier unblocked for new requests
    eventually within 5s: block_removed event emitted
  }
  
  security {
    requires authentication
    requires permission: "rate_limit:unblock"
    audit_log required
  }
}

// ============================================================================
// CHECK IF BLOCKED
// ============================================================================

/**
 * Check if an identifier is currently blocked
 */
behavior IsBlocked {
  description: "Check if an identifier is blocked"
  
  input {
    key: RateLimitKey
    identifier_type: IdentifierType
  }
  
  output {
    success: {
      blocked: Boolean
      block: RateLimitBlock?
      expires_at: Timestamp?
      reason: String?
    }
  }
  
  post success {
    result.blocked implies result.block != null
    result.blocked implies result.expires_at != null
    not result.blocked implies result.block == null
  }
  
  temporal {
    within 5ms (p99): response returned
  }
}

// ============================================================================
// LIST BLOCKS
// ============================================================================

/**
 * List all active blocks
 */
behavior ListBlocks {
  description: "List active rate limit blocks"
  
  input {
    identifier_type: IdentifierType?
    limit: Int { min: 1, max: 1000 } [default: 100]
    offset: Int { min: 0 } [default: 0]
    include_expired: Boolean [default: false]
  }
  
  output {
    success: {
      blocks: List<RateLimitBlock>
      total_count: Int
      has_more: Boolean
    }
  }
  
  post success {
    result.blocks.length <= input.limit
    not input.include_expired implies {
      forall b in result.blocks: b.blocked_until > now()
    }
  }
  
  temporal {
    within 200ms (p99): response returned
  }
  
  security {
    requires authentication
    requires permission: "rate_limit:read"
  }
}

// ============================================================================
// RECORD VIOLATION
// ============================================================================

/**
 * Record a rate limit violation for analytics
 */
behavior RecordViolation {
  description: "Record a rate limit violation event"
  
  input {
    key: RateLimitKey
    identifier_type: IdentifierType
    config_name: String
    request_count: Int
    limit: Int
    action_taken: RateLimitAction
    metadata: Map<String, String>?
  }
  
  output {
    success: Violation
    
    errors {
      STORAGE_ERROR {
        when: "Failed to record violation"
        retriable: true
      }
    }
  }
  
  post success {
    Violation.exists(result.id)
    result.key == input.key
    result.action_taken == input.action_taken
  }
  
  temporal {
    within 50ms (p99): response returned
  }
}

// ============================================================================
// GET VIOLATION HISTORY
// ============================================================================

/**
 * Get violation history for an identifier
 */
behavior GetViolationHistory {
  description: "Get rate limit violation history"
  
  input {
    key: RateLimitKey?
    identifier_type: IdentifierType?
    config_name: String?
    since: Timestamp?
    limit: Int { min: 1, max: 1000 } [default: 100]
  }
  
  output {
    success: {
      violations: List<Violation>
      total_count: Int
      unique_keys: Int
    }
  }
  
  post success {
    result.violations.length <= input.limit
    input.key != null implies {
      forall v in result.violations: v.key == input.key
    }
    input.since != null implies {
      forall v in result.violations: v.timestamp >= input.since
    }
  }
  
  temporal {
    within 200ms (p99): response returned
  }
  
  security {
    requires authentication
    requires permission: "rate_limit:read"
  }
}
