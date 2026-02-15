# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: createIdempotencyTracker, createConcurrentIdempotencyTracker, createStrictIdempotencyTracker, IdempotencyConfig, IdempotencyState, IdempotentRequest, IdempotencyCheckResult, IdempotencyTracker, IdempotencyError
# dependencies: crypto

domain Idempotency {
  version: "1.0.0"

  type IdempotencyConfig = String
  type IdempotencyState = String
  type IdempotentRequest = String
  type IdempotencyCheckResult = String
  type IdempotencyTracker = String
  type IdempotencyError = String

  invariants exports_present {
    - true
  }
}
