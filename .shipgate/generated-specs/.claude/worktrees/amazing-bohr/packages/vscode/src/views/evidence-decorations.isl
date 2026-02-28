# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: EvidenceItem, EvidenceDecorationManager
# dependencies: vscode, path

domain EvidenceDecorations {
  version: "1.0.0"

  type EvidenceItem = String
  type EvidenceDecorationManager = String

  invariants exports_present {
    - true
  }
}
