# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: verify, verifyRequest, checkEventually, checkWithin, checkAlways, formatVerifyResult, VerifyRequest, VerifyOptions, ImplementationExecutor, VerifyResult, TemporalPropertyResult, VerifySummary, VerifyError, eventually, eventuallyWithin, within, withinDuration, withinMultiple, assertWithin, always, alwaysFor, alwaysN, assertAlways, alwaysAll
# dependencies: 

domain Verifier {
  version: "1.0.0"

  type VerifyRequest = String
  type VerifyOptions = String
  type ImplementationExecutor = String
  type VerifyResult = String
  type TemporalPropertyResult = String
  type VerifySummary = String
  type VerifyError = String

  invariants exports_present {
    - true
  }
}
