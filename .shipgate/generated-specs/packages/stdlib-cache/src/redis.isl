# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: createRedisCache, RedisCacheConfig, RedisCache
# dependencies: 

domain Redis {
  version: "1.0.0"

  type RedisCacheConfig = String
  type RedisCache = String

  invariants exports_present {
    - true
  }
}
