# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: DefaultJobProcessor, FixedBackoff, LinearBackoff, ExponentialBackoff, ExponentialBackoffWithJitter
# dependencies: 

domain Processor {
  version: "1.0.0"

  type DefaultJobProcessor = String
  type FixedBackoff = String
  type LinearBackoff = String
  type ExponentialBackoff = String
  type ExponentialBackoffWithJitter = String

  invariants exports_present {
    - true
  }
}
