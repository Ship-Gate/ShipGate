# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: gate, printGateResult, getGateExitCode, GateOptions, GateResult
# dependencies: fs/promises, fs, path, chalk, crypto, @isl-lang/observability, @isl-lang/proof

domain Gate {
  version: "1.0.0"

  type GateOptions = String
  type GateResult = String

  invariants exports_present {
    - true
  }
}
