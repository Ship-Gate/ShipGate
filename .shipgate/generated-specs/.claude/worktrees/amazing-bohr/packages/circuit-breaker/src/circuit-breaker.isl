# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: CircuitBreaker, CircuitOpenError, TimeoutError
# dependencies: 

domain CircuitBreaker {
  version: "1.0.0"

  type CircuitBreaker = String
  type CircuitOpenError = String
  type TimeoutError = String

  invariants exports_present {
    - true
  }
}
