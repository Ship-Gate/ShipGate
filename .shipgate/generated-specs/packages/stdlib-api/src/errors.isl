# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: networkError, timeoutError, abortError, httpError, parseError, graphqlError, unknownError, isRetryableStatus, ApiErrorKind, ApiError
# dependencies: 

domain Errors {
  version: "1.0.0"

  type ApiErrorKind = String
  type ApiError = String

  invariants exports_present {
    - true
  }
}
