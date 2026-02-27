# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: IdempotencyConfig, IdempotencyRecord, CheckResult, LockResult, Clock, Random, StorageAdapter, FingerprintOptions, MiddlewareOptions
# dependencies: 

domain Types {
  version: "1.0.0"

  type IdempotencyConfig = String
  type IdempotencyRecord = String
  type CheckResult = String
  type LockResult = String
  type Clock = String
  type Random = String
  type StorageAdapter = String
  type FingerprintOptions = String
  type MiddlewareOptions = String

  invariants exports_present {
    - true
  }
}
