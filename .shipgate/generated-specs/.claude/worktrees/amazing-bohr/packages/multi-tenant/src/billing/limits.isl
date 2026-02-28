# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: LimitConfig, EnforcementResult, LimitViolation, LimitEnforcer, QuotaManager, QuotaConfig, TenantRateLimiter, RateLimitConfig, RateLimitResult, LimitExceededError, QuotaExceededError, RateLimitExceededError
# dependencies: 

domain Limits {
  version: "1.0.0"

  type LimitConfig = String
  type EnforcementResult = String
  type LimitViolation = String
  type LimitEnforcer = String
  type QuotaManager = String
  type QuotaConfig = String
  type TenantRateLimiter = String
  type RateLimitConfig = String
  type RateLimitResult = String
  type LimitExceededError = String
  type QuotaExceededError = String
  type RateLimitExceededError = String

  invariants exports_present {
    - true
  }
}
