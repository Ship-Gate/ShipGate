# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: ResolvedImport, ResolvedImportItem, ExportedSymbol, ImportResolutionResult, ISLImportResolver
# dependencies: @isl-lang/lsp-core, vscode-uri, path, ${importStmt.from.value}

domain ImportResolver {
  version: "1.0.0"

  type ResolvedImport = String
  type ResolvedImportItem = String
  type ExportedSymbol = String
  type ImportResolutionResult = String
  type ISLImportResolver = String

  invariants exports_present {
    - true
  }
}
