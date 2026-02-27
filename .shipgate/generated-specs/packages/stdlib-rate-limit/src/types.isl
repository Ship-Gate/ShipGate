# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: BucketId, RateLimitKey, RateLimitConfig, BucketState, RateLimitBucket, CheckResult, RateLimitBlock, Violation, CheckInput, IncrementInput, IncrementResult, BlockInput, UnblockInput, RateLimitStorage, RateLimiterOptions, Clock, MiddlewareContext, MiddlewareResult, PolicyEvaluation, PolicyContext, TierConfig
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
  type Clock = String
  type MiddlewareContext = String
  type MiddlewareResult = String
  type PolicyEvaluation = String
  type PolicyContext = String
  type TierConfig = String

  invariants exports_present {
    - true
  }
}
