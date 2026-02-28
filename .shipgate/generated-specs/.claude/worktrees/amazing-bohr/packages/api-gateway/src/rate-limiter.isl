# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: createRateLimiter, RateLimitConfig, RateLimitResult, RateLimiter
# dependencies: 

domain RateLimiter {
  version: "1.0.0"

  type RateLimitConfig = String
  type RateLimitResult = String
  type RateLimiter = String

  invariants exports_present {
    - true
  }
}
