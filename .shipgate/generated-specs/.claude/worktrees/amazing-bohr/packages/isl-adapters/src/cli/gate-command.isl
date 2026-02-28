# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: runGateCommand, runQuickCheck, GateCommandOptions, GateCommandResult
# dependencies: path, @isl-lang/gate, @isl-lang/evidence

domain GateCommand {
  version: "1.0.0"

  type GateCommandOptions = String
  type GateCommandResult = String

  invariants exports_present {
    - true
  }
}
