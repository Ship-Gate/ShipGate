# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: Idempotent, createIdempotencyManager, createIdempotencyMiddleware, IdempotencyRecord, IdempotencyOptions, IdempotencyManager, IdempotencyMiddlewareOptions, IdempotencyMiddleware
# dependencies: crypto

domain Idempotency {
  version: "1.0.0"

  type IdempotencyRecord = String
  type IdempotencyOptions = String
  type IdempotencyManager = String
  type IdempotencyMiddlewareOptions = String
  type IdempotencyMiddleware = String

  invariants exports_present {
    - true
  }
}
