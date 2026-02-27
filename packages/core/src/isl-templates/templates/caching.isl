# Caching Domain
# Cache management with TTL, invalidation, and warming strategies

domain Caching {
  version: "1.0.0"
  
  # ============================================
  # Types
  # ============================================
  
  type CacheKey = String { max_length: 512 }
  type TTL = Int { min: 0 }  # seconds
  
  enum CachePolicy {
    CACHE_FIRST
    NETWORK_FIRST
    STALE_WHILE_REVALIDATE
    NETWORK_ONLY
    CACHE_ONLY
  }
  
  enum InvalidationStrategy {
    KEY
    PATTERN
    TAG
    ALL
  }
  
  # ============================================
  # Entities
  # ============================================
  
  entity CacheEntry {
    key: CacheKey [unique, indexed]
    value: Any
    tags: List<String> [indexed]
    created_at: Timestamp
    expires_at: Timestamp?
    stale_at: Timestamp?
    last_accessed_at: Timestamp
    access_count: Int [default: 0]
    size_bytes: Int
    metadata: Map<String, String>?
    
    invariants {
      expires_at == null or expires_at > created_at
      stale_at == null or stale_at <= expires_at
    }
  }
  
  entity CacheConfig {
    id: UUID [immutable, unique]
    namespace: String [unique, indexed]
    default_ttl_seconds: TTL [default: 3600]
    max_size_bytes: Int?
    eviction_policy: String [default: "lru"]
    compression_enabled: Boolean [default: false]
    encryption_enabled: Boolean [default: false]
    created_at: Timestamp [immutable]
    updated_at: Timestamp
  }
  
  entity CacheStats {
    namespace: String [indexed]
    period_start: Timestamp
    period_end: Timestamp
    hits: Int [default: 0]
    misses: Int [default: 0]
    sets: Int [default: 0]
    deletes: Int [default: 0]
    evictions: Int [default: 0]
    bytes_read: Int [default: 0]
    bytes_written: Int [default: 0]
  }
  
  # ============================================
  # Behaviors
  # ============================================
  
  behavior Get {
    description: "Get a value from cache"
    
    actors {
      System { }
    }
    
    input {
      key: CacheKey
      namespace: String?
    }
    
    output {
      success: {
        value: Any?
        hit: Boolean
        stale: Boolean
        metadata: Map<String, String>?
      }
    }
    
    postconditions {
      success and result.hit implies {
        CacheEntry.lookup(input.key).last_accessed_at == now()
        CacheEntry.lookup(input.key).access_count == 
          old(CacheEntry.lookup(input.key).access_count) + 1
      }
    }
    
    temporal {
      response within 1ms (p50)
      response within 5ms (p99)
    }
  }
  
  behavior Set {
    description: "Set a value in cache"
    
    actors {
      System { }
    }
    
    input {
      key: CacheKey
      value: Any
      ttl_seconds: TTL?
      stale_ttl_seconds: TTL?
      tags: List<String>?
      namespace: String?
      metadata: Map<String, String>?
    }
    
    output {
      success: Boolean
      
      errors {
        VALUE_TOO_LARGE {
          when: "Value exceeds maximum size"
          retriable: false
        }
        QUOTA_EXCEEDED {
          when: "Cache quota exceeded"
          retriable: false
        }
      }
    }
    
    postconditions {
      success implies {
        CacheEntry.exists(key: input.key)
      }
    }
  }
  
  behavior GetOrSet {
    description: "Get from cache or compute and cache"
    
    actors {
      System { }
    }
    
    input {
      key: CacheKey
      compute: Function  # Function to compute value if miss
      ttl_seconds: TTL?
      tags: List<String>?
      policy: CachePolicy [default: CACHE_FIRST]
    }
    
    output {
      success: {
        value: Any
        from_cache: Boolean
        computed: Boolean
      }
    }
    
    temporal {
      policy == STALE_WHILE_REVALIDATE implies {
        // Return stale value immediately, revalidate in background
        response within 5ms
      }
    }
  }
  
  behavior Delete {
    description: "Delete a cache entry"
    
    actors {
      System { }
    }
    
    input {
      key: CacheKey
      namespace: String?
    }
    
    output {
      success: Boolean
    }
    
    postconditions {
      success implies {
        not CacheEntry.exists(key: input.key)
      }
    }
  }
  
  behavior Invalidate {
    description: "Invalidate cache entries"
    
    actors {
      System { }
    }
    
    input {
      strategy: InvalidationStrategy
      keys: List<CacheKey>?
      pattern: String?
      tags: List<String>?
      namespace: String?
    }
    
    output {
      success: {
        invalidated_count: Int
      }
    }
    
    postconditions {
      success implies {
        input.strategy == KEY implies 
          input.keys.all(k => not CacheEntry.exists(key: k))
        input.strategy == TAG implies
          CacheEntry.count(tags: input.tags) == 0
      }
    }
  }
  
  behavior InvalidateByTag {
    description: "Invalidate all entries with specific tags"
    
    actors {
      System { }
    }
    
    input {
      tags: List<String>
      namespace: String?
    }
    
    output {
      success: {
        invalidated_count: Int
      }
    }
  }
  
  behavior Warm {
    description: "Pre-warm cache with computed values"
    
    actors {
      System { }
    }
    
    input {
      keys: List<{
        key: CacheKey
        compute: Function
        ttl_seconds: TTL?
        tags: List<String>?
      }>
      parallel: Boolean [default: true]
    }
    
    output {
      success: {
        warmed_count: Int
        failed_count: Int
        errors: List<{
          key: CacheKey
          error: String
        }>?
      }
    }
  }
  
  behavior GetMultiple {
    description: "Get multiple values from cache"
    
    actors {
      System { }
    }
    
    input {
      keys: List<CacheKey>
      namespace: String?
    }
    
    output {
      success: {
        results: Map<CacheKey, {
          value: Any?
          hit: Boolean
        }>
        hit_count: Int
        miss_count: Int
      }
    }
  }
  
  behavior SetMultiple {
    description: "Set multiple values in cache"
    
    actors {
      System { }
    }
    
    input {
      entries: List<{
        key: CacheKey
        value: Any
        ttl_seconds: TTL?
        tags: List<String>?
      }>
      namespace: String?
    }
    
    output {
      success: {
        set_count: Int
        failed_count: Int
      }
    }
  }
  
  behavior GetStats {
    description: "Get cache statistics"
    
    actors {
      Admin { must: authenticated }
    }
    
    input {
      namespace: String?
      from_date: Timestamp?
      to_date: Timestamp?
    }
    
    output {
      success: {
        hit_rate: Decimal
        miss_rate: Decimal
        total_entries: Int
        total_size_bytes: Int
        stats: CacheStats
      }
    }
  }
  
  behavior Flush {
    description: "Flush entire cache or namespace"
    
    actors {
      Admin { must: authenticated }
    }
    
    input {
      namespace: String?
      confirm: Boolean
    }
    
    output {
      success: {
        flushed_count: Int
      }
    }
    
    preconditions {
      input.confirm == true
    }
    
    effects {
      AuditLog { log_cache_flush }
    }
  }
  
  # ============================================
  # Scenarios
  # ============================================
  
  scenarios GetOrSet {
    scenario "cache hit" {
      given {
        CacheEntry.create(
          key: "user:123",
          value: { id: 123, name: "John" },
          expires_at: now() + 1h
        )
      }
      
      when {
        result = GetOrSet(
          key: "user:123",
          compute: () => fetchUser(123),
          ttl_seconds: 3600
        )
      }
      
      then {
        result is success
        result.from_cache == true
        result.computed == false
      }
    }
    
    scenario "cache miss with compute" {
      when {
        result = GetOrSet(
          key: "user:456",
          compute: () => fetchUser(456),
          ttl_seconds: 3600
        )
      }
      
      then {
        result is success
        result.from_cache == false
        result.computed == true
        CacheEntry.exists(key: "user:456")
      }
    }
    
    scenario "stale while revalidate" {
      given {
        CacheEntry.create(
          key: "data:abc",
          value: { old: true },
          stale_at: now() - 1m,
          expires_at: now() + 1h
        )
      }
      
      when {
        result = GetOrSet(
          key: "data:abc",
          compute: () => fetchData("abc"),
          policy: STALE_WHILE_REVALIDATE
        )
      }
      
      then {
        result is success
        // Returns stale value immediately
        result.value.old == true
        // Revalidation happens in background
      }
    }
  }
}
