# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: BucketId, RateLimitKey, RateLimitConfig, BucketState, RateLimitBucket, CheckResult, RateLimitBlock, Violation, CheckInput, IncrementInput, IncrementResult, BlockInput, UnblockInput, RateLimitStorage, RateLimiterOptions
# dependencies: 

domain Types {
  version: "1.0.0"

  type BucketId = String
  type RateLimitKey = String
  type RateLimitConfig = String
  type BucketState = String
  type RateLimitBucket = String
  type CheckResult = String
  type RateLimitBlock = String
  type Violation = String
  type CheckInput = String
  type IncrementInput = String
  type IncrementResult = String
  type BlockInput = String
  type UnblockInput = String
  type RateLimitStorage = String
  type RateLimiterOptions = String

  invariants exports_present {
    - true
  }
}
