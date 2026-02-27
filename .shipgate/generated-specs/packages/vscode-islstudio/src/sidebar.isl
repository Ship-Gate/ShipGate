# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: ISLStudioTreeProvider, GateResult, Violation, IntentBlock, ProofBundle
# dependencies: vscode, path, fs/promises

domain Sidebar {
  version: "1.0.0"

  type ISLStudioTreeProvider = String
  type GateResult = String
  type Violation = String
  type IntentBlock = String
  type ProofBundle = String

  invariants exports_present {
    - true
  }
}
