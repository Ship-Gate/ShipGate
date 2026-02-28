# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: gate, printGateResult, getGateExitCode, GateResult, GateOptions
# dependencies: fs/promises, fs, path, chalk, crypto, @isl-lang/observability, @isl-lang/proof

domain Gate {
  version: "1.0.0"

  type GateResult = String
  type GateOptions = String

  invariants exports_present {
    - true
  }
}
