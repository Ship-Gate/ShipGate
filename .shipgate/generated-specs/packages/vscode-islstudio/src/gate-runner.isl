# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: runGate, getChangedFiles, GateResult, Violation
# dependencies: vscode, path, child_process, util

domain GateRunner {
  version: "1.0.0"

  type GateResult = String
  type Violation = String

  invariants exports_present {
    - true
  }
}
