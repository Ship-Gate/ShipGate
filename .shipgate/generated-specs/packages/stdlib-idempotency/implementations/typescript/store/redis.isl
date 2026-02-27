# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: createRedisStore, RedisClient, RedisStoreOptions, RedisIdempotencyStore
# dependencies: 

domain Redis {
  version: "1.0.0"

  type RedisClient = String
  type RedisStoreOptions = String
  type RedisIdempotencyStore = String

  invariants exports_present {
    - true
  }
}
