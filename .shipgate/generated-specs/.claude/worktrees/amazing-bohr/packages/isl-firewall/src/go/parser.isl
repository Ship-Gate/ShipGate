# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: parseGoImports, isGoFile, GoImportSpec, GoParseResult, GoParseError
# dependencies: tree-sitter, tree-sitter-go

domain Parser {
  version: "1.0.0"

  type GoImportSpec = String
  type GoParseResult = String
  type GoParseError = String

  invariants exports_present {
    - true
  }
}
