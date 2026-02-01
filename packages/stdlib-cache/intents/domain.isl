/**
 * ISL Cache Domain
 * 
 * Defines the caching abstractions and behaviors for the ISL stdlib-cache module.
 */

domain Cache {
  // ===========================================================================
  // Types
  // ===========================================================================
  
  /**
   * Cache key - string identifier for cached values
   */
  type CacheKey = String {
    constraints {
      length >= 1
      length <= 1024
      matches "[a-zA-Z0-9:._-]+"
    }
  }
  
  /**
   * Time-to-live duration
   */
  type TTL = Duration {
    constraints {
      value >= 0
      value <= 31536000000  // Max 1 year in ms
    }
  }
  
  /**
   * Cache backend type
   */
  enum CacheBackend {
    MEMORY
    REDIS
    MEMCACHED
    MULTI_LEVEL
  }
  
  /**
   * Serialization format
   */
  enum SerializationFormat {
    JSON
    MSGPACK
    BINARY
  }
  
  // ===========================================================================
  // Entities
  // ===========================================================================
  
  /**
   * Cache entry with metadata
   */
  entity CacheEntry<T> {
    key: CacheKey
    value: T
    createdAt: Timestamp
    expiresAt: Timestamp?
    version: Int?
    tags: List<String>?
    metadata: Map<String, String>?
    
    computed isExpired: Boolean = 
      expiresAt != null && now() > expiresAt
  }
  
  /**
   * Cache statistics
   */
  entity CacheStats {
    hits: Int
    misses: Int
    sets: Int
    deletes: Int
    size: Int
    memoryUsage: Int?
    
    computed hitRate: Float = 
      if hits + misses > 0 then hits / (hits + misses) else 0
  }
  
  /**
   * Cache configuration
   */
  entity CacheConfig {
    backend: CacheBackend
    keyPrefix: String?
    defaultTtl: TTL?
    maxSize: Int?
    serialization: SerializationFormat = JSON
  }
  
  // ===========================================================================
  // Behaviors
  // ===========================================================================
  
  /**
   * Get a value from cache
   */
  behavior Get<T> {
    input {
      key: CacheKey
    }
    
    output {
      | Hit { entry: CacheEntry<T> }
      | Miss
      | Error { code: String, message: String }
    }
    
    precondition {
      key.length >= 1
    }
    
    postcondition {
      result is Hit implies result.entry.key == input.key
      result is Hit implies !result.entry.isExpired
    }
  }
  
  /**
   * Set a value in cache
   */
  behavior Set<T> {
    input {
      key: CacheKey
      value: T
      ttl: TTL?
      tags: List<String>?
    }
    
    output {
      | Success { entry: CacheEntry<T> }
      | Error { code: String, message: String }
    }
    
    precondition {
      key.length >= 1
    }
    
    postcondition {
      result is Success implies Get(input.key) is Hit
      result is Success implies result.entry.key == input.key
      result is Success implies result.entry.value == input.value
    }
  }
  
  /**
   * Delete a value from cache
   */
  behavior Delete {
    input {
      key: CacheKey
    }
    
    output {
      | Deleted
      | NotFound
      | Error { code: String, message: String }
    }
    
    precondition {
      key.length >= 1
    }
    
    postcondition {
      result is Deleted implies Get(input.key) is Miss
      result is NotFound implies Get(input.key) is Miss
    }
  }
  
  /**
   * Check if key exists in cache
   */
  behavior Has {
    input {
      key: CacheKey
    }
    
    output {
      | Exists
      | NotExists
      | Error { code: String, message: String }
    }
    
    precondition {
      key.length >= 1
    }
  }
  
  /**
   * Get or set (cache-aside pattern)
   */
  behavior GetOrSet<T> {
    input {
      key: CacheKey
      factory: () -> T
      ttl: TTL?
    }
    
    output {
      | CacheHit { value: T }
      | CacheMiss { value: T }
      | Error { code: String, message: String }
    }
    
    precondition {
      key.length >= 1
    }
    
    postcondition {
      result is CacheHit or result is CacheMiss implies Get(input.key) is Hit
    }
  }
  
  /**
   * Get multiple values
   */
  behavior MGet<T> {
    input {
      keys: List<CacheKey>
    }
    
    output {
      | Success { entries: Map<CacheKey, T>, misses: List<CacheKey> }
      | Error { code: String, message: String }
    }
    
    precondition {
      keys.length >= 1
      keys.length <= 1000
    }
    
    postcondition {
      result is Success implies 
        result.entries.keys.all(k => k in input.keys)
    }
  }
  
  /**
   * Set multiple values
   */
  behavior MSet<T> {
    input {
      entries: Map<CacheKey, T>
      ttl: TTL?
    }
    
    output {
      | Success { count: Int }
      | PartialSuccess { succeeded: List<CacheKey>, failed: List<CacheKey> }
      | Error { code: String, message: String }
    }
    
    precondition {
      entries.size >= 1
      entries.size <= 1000
    }
    
    postcondition {
      result is Success implies result.count == input.entries.size
    }
  }
  
  /**
   * Delete by pattern (glob)
   */
  behavior DeleteByPattern {
    input {
      pattern: String
    }
    
    output {
      | Success { deletedCount: Int }
      | Error { code: String, message: String }
    }
    
    precondition {
      pattern.length >= 1
    }
  }
  
  /**
   * Delete by tags
   */
  behavior DeleteByTags {
    input {
      tags: List<String>
    }
    
    output {
      | Success { deletedCount: Int }
      | Error { code: String, message: String }
    }
    
    precondition {
      tags.length >= 1
    }
  }
  
  /**
   * Clear all cache entries
   */
  behavior Clear {
    input {}
    
    output {
      | Success
      | Error { code: String, message: String }
    }
    
    postcondition {
      result is Success implies Stats().size == 0
    }
  }
  
  /**
   * Get cache statistics
   */
  behavior Stats {
    input {}
    
    output {
      | Success { stats: CacheStats }
      | Error { code: String, message: String }
    }
    
    postcondition {
      result is Success implies result.stats.hits >= 0
      result is Success implies result.stats.misses >= 0
    }
  }
  
  /**
   * Acquire distributed lock
   */
  behavior Lock {
    input {
      key: CacheKey
      ttl: TTL
      retryCount: Int?
      retryDelay: Duration?
    }
    
    output {
      | Acquired { lockId: String }
      | NotAcquired
      | Error { code: String, message: String }
    }
    
    precondition {
      key.length >= 1
      ttl > 0
    }
  }
  
  /**
   * Release distributed lock
   */
  behavior Unlock {
    input {
      key: CacheKey
      lockId: String
    }
    
    output {
      | Released
      | NotOwned
      | NotFound
      | Error { code: String, message: String }
    }
    
    precondition {
      key.length >= 1
      lockId.length >= 1
    }
  }
}
