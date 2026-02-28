# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: createResilienceVerifier, verifyResilience, replayResilience, createSpecClauseMapping, buildSpecClauseMappings, ResilienceConfig, ResilienceResult, ResilienceVerifyInput, ResilienceVerifier
# dependencies: 

domain ResilienceVerifier {
  version: "1.0.0"

  type ResilienceConfig = String
  type ResilienceResult = String
  type ResilienceVerifyInput = String
  type ResilienceVerifier = String

  invariants exports_present {
    - true
  }
}
