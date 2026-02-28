# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: findISLSpecs, parseIntentBlocks, findAllIntentBlocks, IntentBlock
# dependencies: vscode, path, fs/promises, glob

domain IntentManager {
  version: "1.0.0"

  type IntentBlock = String

  invariants exports_present {
    - true
  }
}
