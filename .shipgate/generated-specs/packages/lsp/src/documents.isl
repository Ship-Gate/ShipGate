# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: ISLDocument, SymbolInfo, DocumentManager
# dependencies: @isl-lang/isl-core

domain Documents {
  version: "1.0.0"

  type ISLDocument = String
  type SymbolInfo = String
  type DocumentManager = String

  invariants exports_present {
    - true
  }
}
