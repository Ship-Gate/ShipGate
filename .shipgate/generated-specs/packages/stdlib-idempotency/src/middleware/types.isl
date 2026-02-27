# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: RequestContext, ResponseContext, IdempotencyContext, GuardOptions, MiddlewareResult
# dependencies: 

domain Types {
  version: "1.0.0"

  type RequestContext = String
  type ResponseContext = String
  type IdempotencyContext = String
  type GuardOptions = String
  type MiddlewareResult = String

  invariants exports_present {
    - true
  }
}
