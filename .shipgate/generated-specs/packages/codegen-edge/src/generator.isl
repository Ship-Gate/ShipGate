# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: generate, validateRequired, validateString, validateNumber, validateEmail, validateUUID, jsonResponse, errorResponse, validationErrorResponse, notFoundResponse, unauthorizedResponse, rateLimitResponse, cors, handleCorsPreFlight, checkRateLimit, getRateLimitKey, EdgeGenOptions, EdgeGenResult, ValidationError, CorsOptions, RateLimitConfig, RateLimitStore
# dependencies: vitest

domain Generator {
  version: "1.0.0"

  type EdgeGenOptions = String
  type EdgeGenResult = String
  type ValidationError = String
  type CorsOptions = String
  type RateLimitConfig = String
  type RateLimitStore = String

  invariants exports_present {
    - true
  }
}
