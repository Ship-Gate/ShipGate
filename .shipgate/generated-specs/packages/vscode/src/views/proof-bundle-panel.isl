# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: ProofBundleState, ProofBundlePanelProvider
# dependencies: vscode

domain ProofBundlePanel {
  version: "1.0.0"

  type ProofBundleState = String
  type ProofBundlePanelProvider = String

  invariants exports_present {
    - true
  }
}
