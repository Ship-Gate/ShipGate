# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: toISLError, errorFromStatus, ISLError, ValidationError, PreconditionError, PostconditionError, NetworkError, ServerError, ApiError, UnauthorizedError, ForbiddenError, NotFoundError, RateLimitError
# dependencies: 

domain Errors {
  version: "1.0.0"

  type ISLError = String
  type ValidationError = String
  type PreconditionError = String
  type PostconditionError = String
  type NetworkError = String
  type ServerError = String
  type ApiError = String
  type UnauthorizedError = String
  type ForbiddenError = String
  type NotFoundError = String
  type RateLimitError = String

  invariants exports_present {
    - true
  }
}
