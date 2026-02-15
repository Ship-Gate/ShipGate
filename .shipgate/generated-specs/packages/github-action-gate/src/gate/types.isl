# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: GateRunnerOptions, GateRunnerResult, ProcessedFinding, GateConfig
# dependencies: @isl-lang/gate

domain Types {
  version: "1.0.0"

  type GateRunnerOptions = String
  type GateRunnerResult = String
  type ProcessedFinding = String
  type GateConfig = String

  invariants exports_present {
    - true
  }
}
