# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: createIdempotencyError, IdempotencyError
# dependencies: 

domain Errors {
  version: "1.0.0"

  type IdempotencyError = String

  invariants exports_present {
    - true
  }
}
