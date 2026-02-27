# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: registerHealCommand, HealResult, HealState
# dependencies: vscode, child_process, fs, path

domain Heal {
  version: "1.0.0"

  type HealResult = String
  type HealState = String

  invariants exports_present {
    - true
  }
}
