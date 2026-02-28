# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: createBehaviorPolicy, Bulkhead, RateLimiter, Retry, ResiliencePolicyExecutor, BulkheadFullError, BulkheadTimeoutError, RateLimitExceededError
# dependencies: 

domain Resilience {
  version: "1.0.0"

  type Bulkhead = String
  type RateLimiter = String
  type Retry = String
  type ResiliencePolicyExecutor = String
  type BulkheadFullError = String
  type BulkheadTimeoutError = String
  type RateLimitExceededError = String

  invariants exports_present {
    - true
  }
}
