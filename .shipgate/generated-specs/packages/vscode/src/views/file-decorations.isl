# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: FileVerificationStatus, FileDecorationProvider
# dependencies: vscode

domain FileDecorations {
  version: "1.0.0"

  type FileVerificationStatus = String
  type FileDecorationProvider = String

  invariants exports_present {
    - true
  }
}
