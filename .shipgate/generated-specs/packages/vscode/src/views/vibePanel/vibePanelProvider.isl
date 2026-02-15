# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: VibePanelState, VibePanelProvider
# dependencies: vscode, path

domain VibePanelProvider {
  version: "1.0.0"

  type VibePanelState = String
  type VibePanelProvider = String

  invariants exports_present {
    - true
  }
}
