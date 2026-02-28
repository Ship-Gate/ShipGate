# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: runPBTVerification, createPBTVerifier, formatPBTResult, createTracedImplementation, PBTVerifyOptions, PBTVerifyResult, BehaviorPBTResult, PBTTrace
# dependencies: @isl-lang/parser, @isl-lang/pbt

domain CliIntegration {
  version: "1.0.0"

  type PBTVerifyOptions = String
  type PBTVerifyResult = String
  type BehaviorPBTResult = String
  type PBTTrace = String

  invariants exports_present {
    - true
  }
}
