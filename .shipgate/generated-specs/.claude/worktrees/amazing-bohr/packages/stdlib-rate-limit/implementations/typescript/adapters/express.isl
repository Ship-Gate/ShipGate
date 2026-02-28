# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: rateLimitMiddleware, ipRateLimit, userRateLimit, apiKeyRateLimit, endpointRateLimit, slowDown, Request, Response, NextFunction, ExpressMiddleware, RateLimitMiddlewareOptions, SlowDownOptions
# dependencies: @isl-lang/stdlib-rate-limit, @isl-lang/stdlib-rate-limit/adapters/express

domain Express {
  version: "1.0.0"

  type Request = String
  type Response = String
  type NextFunction = String
  type ExpressMiddleware = String
  type RateLimitMiddlewareOptions = String
  type SlowDownOptions = String

  invariants exports_present {
    - true
  }
}
