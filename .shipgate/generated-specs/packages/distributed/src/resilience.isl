# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: retry, withResilience, CircuitBreaker, CircuitOpenError, Bulkhead, BulkheadRejectError, BulkheadTimeoutError, RateLimiter
# dependencies: 

domain Resilience {
  version: "1.0.0"

  type CircuitBreaker = String
  type CircuitOpenError = String
  type Bulkhead = String
  type BulkheadRejectError = String
  type BulkheadTimeoutError = String
  type RateLimiter = String

  invariants exports_present {
    - true
  }
}
