# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: CircuitState, CircuitBreakerConfig, CircuitStats, RetryConfig, BulkheadConfig, RateLimiterConfig, TimeoutConfig, FallbackConfig, ResiliencePolicy, BehaviorResilienceConfig
# dependencies: 

domain Types {
  version: "1.0.0"

  type CircuitState = String
  type CircuitBreakerConfig = String
  type CircuitStats = String
  type RetryConfig = String
  type BulkheadConfig = String
  type RateLimiterConfig = String
  type TimeoutConfig = String
  type FallbackConfig = String
  type ResiliencePolicy = String
  type BehaviorResilienceConfig = String

  invariants exports_present {
    - true
  }
}
