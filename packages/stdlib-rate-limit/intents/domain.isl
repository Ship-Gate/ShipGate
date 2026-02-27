// ============================================================================
// ISL Standard Library - Rate Limit Domain
// @stdlib/rate-limit
// Version: 1.0.0
// ============================================================================

domain RateLimit {
  version: "1.0.0"
  owner: "security-team@company.com"
  
  // ============================================================================
  // CORE TYPES
  // ============================================================================
  
  /**
   * Unique identifier for a rate limit bucket
   */
  type BucketId = String {
    max_length: 512
    pattern: "^[a-zA-Z0-9:_-]+$"
  }
  
  /**
   * Identifier for the rate-limited entity (IP, user, API key, etc.)
   */
  type RateLimitKey = String {
    max_length: 255
  }
  
  /**
   * Time window for rate limiting
   */
  type Window = Duration {
    min: 1s
    max: 24h
  }
  
  /**
   * Maximum number of requests allowed in a window
   */
  type Limit = Int {
    min: 1
    max: 1000000
  }
  
  // ============================================================================
  // ENUMS
  // ============================================================================
  
  /**
   * Result action from rate limit check
   */
  enum RateLimitAction {
    ALLOW           // Request allowed
    WARN            // Request allowed but approaching limit
    THROTTLE        // Request should be delayed
    DENY            // Request should be rejected
    CAPTCHA         // Require captcha verification
  }
  
  /**
   * Algorithm used for rate limiting
   */
  enum RateLimitAlgorithm {
    TOKEN_BUCKET    // Token bucket algorithm
    SLIDING_WINDOW  // Sliding window log
    FIXED_WINDOW    // Fixed window counter
    LEAKY_BUCKET    // Leaky bucket algorithm
  }
  
  /**
   * Type of identifier being rate limited
   */
  enum IdentifierType {
    IP              // IP address
    USER_ID         // User identifier
    API_KEY         // API key
    SESSION         // Session identifier
    CUSTOM          // Custom identifier
  }
  
  /**
   * Scope of the rate limit
   */
  enum RateLimitScope {
    GLOBAL          // Applies globally
    PER_ENDPOINT    // Per API endpoint
    PER_USER        // Per authenticated user
    PER_IP          // Per IP address
    COMPOSITE       // Combination of scopes
  }
  
  // ============================================================================
  // COMPLEX TYPES
  // ============================================================================
  
  /**
   * Configuration for a rate limit rule
   */
  type RateLimitConfig = {
    name: String { max_length: 100 }
    limit: Limit
    window: Window
    algorithm: RateLimitAlgorithm [default: SLIDING_WINDOW]
    scope: RateLimitScope
    
    // Thresholds for actions
    warn_threshold: Decimal? { min: 0.5, max: 0.99 }  // Percentage of limit
    throttle_threshold: Decimal? { min: 0.8, max: 1.0 }
    
    // Burst handling
    burst_limit: Int?
    burst_window: Duration?
    
    // Penalty configuration
    block_duration: Duration?
    escalation_multiplier: Decimal? { min: 1.0, max: 10.0 }
    
    // Bypass rules
    bypass_roles: List<String>?
    bypass_ips: List<String>?
    
    // Metadata
    description: String?
    tags: List<String>?
  }
  
  /**
   * Current state of a rate limit bucket
   */
  type BucketState = {
    key: RateLimitKey
    config_name: String
    current_count: Int
    remaining: Int
    limit: Limit
    window_start: Timestamp
    window_end: Timestamp
    last_request: Timestamp
    blocked_until: Timestamp?
    violation_count: Int [default: 0]
  }
  
  /**
   * Result of a rate limit check
   */
  type CheckResult = {
    action: RateLimitAction
    allowed: Boolean
    remaining: Int
    limit: Limit
    reset_at: Timestamp
    retry_after: Duration?
    
    // Headers to send
    headers: Map<String, String>?
    
    // Additional context
    bucket_key: BucketId
    config_name: String
    violation_count: Int?
  }
  
  /**
   * Record of a rate limit violation
   */
  type Violation = {
    id: UUID [immutable]
    key: RateLimitKey
    identifier_type: IdentifierType
    config_name: String
    timestamp: Timestamp [immutable]
    request_count: Int
    limit: Limit
    action_taken: RateLimitAction
    metadata: Map<String, String>?
  }
  
  // ============================================================================
  // ENTITIES
  // ============================================================================
  
  /**
   * Persistent rate limit bucket for tracking request counts
   */
  entity RateLimitBucket {
    id: BucketId [unique]
    key: RateLimitKey [indexed]
    identifier_type: IdentifierType
    config_name: String [indexed]
    
    // Counters
    current_count: Int [default: 0]
    total_requests: Int [default: 0]
    
    // Window tracking
    window_start: Timestamp
    window_size: Window
    
    // State
    limit: Limit
    blocked_until: Timestamp?
    violation_count: Int [default: 0]
    last_violation: Timestamp?
    
    // Timestamps
    created_at: Timestamp [immutable]
    updated_at: Timestamp
    
    invariants {
      current_count >= 0
      total_requests >= current_count
      violation_count >= 0
      blocked_until == null or blocked_until > now()
      limit > 0
    }
  }
  
  /**
   * Block record for persistent blocks
   */
  entity RateLimitBlock {
    id: UUID [immutable, unique]
    key: RateLimitKey [indexed]
    identifier_type: IdentifierType
    reason: String
    blocked_at: Timestamp [immutable]
    blocked_until: Timestamp [indexed]
    auto_unblock: Boolean [default: true]
    created_by: String?
    metadata: Map<String, String>?
    
    invariants {
      blocked_until > blocked_at
    }
  }
}
