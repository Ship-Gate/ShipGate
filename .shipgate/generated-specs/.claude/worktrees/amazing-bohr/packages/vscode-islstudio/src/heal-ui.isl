# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: HealUIPanel, HealIteration, PatchPreview, HealResult
# dependencies: vscode, path

domain HealUi {
  version: "1.0.0"

  type HealUIPanel = String
  type HealIteration = String
  type PatchPreview = String
  type HealResult = String

  invariants exports_present {
    - true
  }
}
