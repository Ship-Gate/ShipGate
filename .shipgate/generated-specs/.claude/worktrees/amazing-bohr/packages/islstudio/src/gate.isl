# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: runGate, GateConfig, GateFile, RulepackVersion, GateResult
# dependencies: @isl-lang/policy-packs, crypto

domain Gate {
  version: "1.0.0"

  type GateConfig = String
  type GateFile = String
  type RulepackVersion = String
  type GateResult = String

  invariants exports_present {
    - true
  }
}
