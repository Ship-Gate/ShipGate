# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: RouteHandlerEvidence, ImportEvidence, EvidenceCodeLensProvider, ImportDecorationManager
# dependencies: vscode

domain EvidenceCodelens {
  version: "1.0.0"

  type RouteHandlerEvidence = String
  type ImportEvidence = String
  type EvidenceCodeLensProvider = String
  type ImportDecorationManager = String

  invariants exports_present {
    - true
  }
}
