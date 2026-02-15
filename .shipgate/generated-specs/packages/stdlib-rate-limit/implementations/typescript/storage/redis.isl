# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: createRedisStorage, RedisClient, RedisMulti, RedisStorageOptions, RedisRateLimitStorage
# dependencies: 

domain Redis {
  version: "1.0.0"

  type RedisClient = String
  type RedisMulti = String
  type RedisStorageOptions = String
  type RedisRateLimitStorage = String

  invariants exports_present {
    - true
  }
}
