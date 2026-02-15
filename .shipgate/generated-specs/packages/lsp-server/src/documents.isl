# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: ParsedDocument, ISLDocumentManager
# dependencies: @isl-lang/lsp-core

domain Documents {
  version: "1.0.0"

  type ParsedDocument = String
  type ISLDocumentManager = String

  invariants exports_present {
    - true
  }
}
