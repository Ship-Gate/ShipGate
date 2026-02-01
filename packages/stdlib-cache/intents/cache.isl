/**
 * Cache Domain
 * 
 * Standard library for caching operations.
 */
domain Cache {
  description: "Caching operations with TTL, tagging, and multi-tier support"
  version: "1.0.0"
  
  /**
   * Cache Entry
   */
  entity CacheEntry {
    key: String @unique
    value: Any
    ttl: Duration?
    tags: String[]
    createdAt: DateTime
    expiresAt: DateTime?
  }
  
  /**
   * Get a cached value
   */
  behavior get {
    description: "Retrieve a value from cache"
    
    input {
      key: String @minLength(1)
    }
    
    output {
      value: Any?
      found: Boolean
      ttlRemaining: Duration?
    }
    
    preconditions {
      key != null
      key.length > 0
    }
    
    postconditions {
      found implies value != null
      !found implies value == null
    }
    
    temporal {
      within 10ms at p99
    }
  }
  
  /**
   * Set a cached value
   */
  behavior set {
    description: "Store a value in cache"
    
    input {
      key: String @minLength(1)
      value: Any
      ttl: Duration? @default(3600s)
      tags: String[]?
    }
    
    output {
      success: Boolean
      previousValue: Any?
    }
    
    preconditions {
      key != null
      key.length > 0
    }
    
    postconditions {
      success implies get(key).found
      success implies get(key).value == value
    }
    
    temporal {
      within 20ms at p99
    }
  }
  
  /**
   * Delete a cached value
   */
  behavior delete {
    description: "Remove a value from cache"
    
    input {
      key: String @minLength(1)
    }
    
    output {
      deleted: Boolean
      previousValue: Any?
    }
    
    preconditions {
      key != null
    }
    
    postconditions {
      !get(key).found
    }
    
    temporal {
      within 10ms at p99
    }
  }
  
  /**
   * Check if key exists
   */
  behavior exists {
    description: "Check if a key exists in cache"
    
    input {
      key: String @minLength(1)
    }
    
    output {
      exists: Boolean
    }
    
    temporal {
      within 5ms at p99
    }
  }
  
  /**
   * Get or set with factory
   */
  behavior getOrSet {
    description: "Get cached value or compute and cache if missing"
    
    input {
      key: String @minLength(1)
      factory: Function<Any>
      ttl: Duration? @default(3600s)
    }
    
    output {
      value: Any
      fromCache: Boolean
    }
    
    postconditions {
      value != null
      get(key).found
    }
  }
  
  /**
   * Invalidate by tags
   */
  behavior invalidateByTags {
    description: "Remove all entries with matching tags"
    
    input {
      tags: String[] @minLength(1)
    }
    
    output {
      count: Integer
    }
    
    postconditions {
      count >= 0
    }
  }
  
  /**
   * Invalidate by pattern
   */
  behavior invalidateByPattern {
    description: "Remove all entries matching key pattern"
    
    input {
      pattern: String @minLength(1)
    }
    
    output {
      count: Integer
    }
    
    postconditions {
      count >= 0
    }
  }
  
  /**
   * Get multiple values
   */
  behavior mget {
    description: "Get multiple values at once"
    
    input {
      keys: String[] @minLength(1)
    }
    
    output {
      values: Map<String, Any?>
    }
    
    temporal {
      within 50ms at p99
    }
  }
  
  /**
   * Set multiple values
   */
  behavior mset {
    description: "Set multiple values at once"
    
    input {
      entries: Map<String, Any>
      ttl: Duration? @default(3600s)
    }
    
    output {
      success: Boolean
    }
    
    temporal {
      within 100ms at p99
    }
  }
  
  /**
   * Get cache statistics
   */
  behavior stats {
    description: "Get cache hit/miss statistics"
    
    output {
      hits: Integer
      misses: Integer
      hitRate: Float @range(0, 1)
      size: Integer
      memoryUsed: Integer
    }
  }
  
  /**
   * Clear all cache
   */
  behavior clear {
    description: "Remove all entries from cache"
    
    output {
      count: Integer
    }
    
    postconditions {
      stats().size == 0
    }
  }
  
  // Domain invariants
  invariants {
    // Hit rate is always valid
    stats().hitRate >= 0 && stats().hitRate <= 1
    
    // Size is non-negative
    stats().size >= 0
    
    // TTL is positive when set
    forall e: CacheEntry | e.ttl implies e.ttl > 0s
  }
}
