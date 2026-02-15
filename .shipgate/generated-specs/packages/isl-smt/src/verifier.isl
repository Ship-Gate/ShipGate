# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: verifySMT, checkExpression, resolveUnknown, verifyFormal, SMTVerifier, UnknownResolution, FormalModeOptions
# dependencies: @isl-lang/prover

domain Verifier {
  version: "1.0.0"

  type SMTVerifier = String
  type UnknownResolution = String
  type FormalModeOptions = String

  invariants exports_present {
    - true
  }
}
