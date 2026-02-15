# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: simulateCommand, printSimulateResult, getSimulateExitCode, SimulateOptions, SimulateResult
# dependencies: fs/promises, path, chalk, @isl-lang/parser

domain Simulate {
  version: "1.0.0"

  type SimulateOptions = String
  type SimulateResult = String

  invariants exports_present {
    - true
  }
}
