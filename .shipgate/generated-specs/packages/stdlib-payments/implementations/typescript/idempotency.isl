# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: withIdempotency, IdempotencyManager, InMemoryIdempotencyManager, RedisClient, RedisIdempotencyManager
# dependencies: 

domain Idempotency {
  version: "1.0.0"

  type IdempotencyManager = String
  type InMemoryIdempotencyManager = String
  type RedisClient = String
  type RedisIdempotencyManager = String

  invariants exports_present {
    - true
  }
}
