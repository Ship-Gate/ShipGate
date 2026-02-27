# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: ExponentialBackoff, LinearBackoff, FixedBackoff, RetryConditions
# dependencies: 

domain Strategies {
  version: "1.0.0"

  type ExponentialBackoff = String
  type LinearBackoff = String
  type FixedBackoff = String
  type RetryConditions = String

  invariants exports_present {
    - true
  }
}
