# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: createException, checkException, revokeException, getActiveExceptions, getExpiringSoon, formatException, Exception, ExceptionRequest
# dependencies: 

domain Exceptions {
  version: "1.0.0"

  type Exception = String
  type ExceptionRequest = String

  invariants exports_present {
    - true
  }
}
