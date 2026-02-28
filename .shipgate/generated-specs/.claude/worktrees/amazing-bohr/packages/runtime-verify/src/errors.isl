# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: isVerifyError, isPreconditionError, isPostconditionError, isInvariantError, formatVerifyError, ErrorCode, ErrorCodeType, VerifyError, PreconditionError, PostconditionError, InvariantError, HookError, EvaluationError
# dependencies: 

domain Errors {
  version: "1.0.0"

  type ErrorCodeType = String
  type VerifyError = String
  type PreconditionError = String
  type PostconditionError = String
  type InvariantError = String
  type HookError = String
  type EvaluationError = String

  invariants exports_present {
    - true
  }
}
