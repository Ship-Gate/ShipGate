# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: createPBTGateInput, createPBTGateInputBatch, calculatePBTTrustContribution, shouldBlockShip, getBlockReasons, generatePBTJsonReport, formatPBTConsoleOutput, PBTFinding, PBTBlockers, PBTGateInput, PBTMetrics, PBTTrustContribution, counterexampleRegistry, formatCounterexample
# dependencies: @isl-lang/pbt

domain VerificationIntegration {
  version: "1.0.0"

  type PBTFinding = String
  type PBTBlockers = String
  type PBTGateInput = String
  type PBTMetrics = String
  type PBTTrustContribution = String

  invariants exports_present {
    - true
  }
}
