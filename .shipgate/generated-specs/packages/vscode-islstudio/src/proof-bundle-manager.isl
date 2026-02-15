# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: findProofBundles, viewProofBundle, ProofBundle
# dependencies: vscode, path, fs/promises

domain ProofBundleManager {
  version: "1.0.0"

  type ProofBundle = String

  invariants exports_present {
    - true
  }
}
