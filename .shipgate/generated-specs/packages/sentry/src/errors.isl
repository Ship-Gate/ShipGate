# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: isISLError, isPreconditionError, isPostconditionError, isInvariantError, isTemporalError, isVerificationError, PreconditionError, PostconditionError, InvariantError, TemporalError, VerificationError
# dependencies: 

domain Errors {
  version: "1.0.0"

  type PreconditionError = String
  type PostconditionError = String
  type InvariantError = String
  type TemporalError = String
  type VerificationError = String

  invariants exports_present {
    - true
  }
}
