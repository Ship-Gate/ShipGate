# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: RetryOptions, CircuitBreakerOptions, RetryResult, CircuitBreakerMetrics, BackoffStrategy, RetryCondition
# dependencies: 

domain Types {
  version: "1.0.0"

  type RetryOptions = String
  type CircuitBreakerOptions = String
  type RetryResult = String
  type CircuitBreakerMetrics = String
  type BackoffStrategy = String
  type RetryCondition = String

  invariants exports_present {
    - true
  }
}
