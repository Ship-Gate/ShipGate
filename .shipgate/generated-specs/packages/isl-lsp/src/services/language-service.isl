# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: ParsedDocument, DocumentAST, ASTNode, FieldInfo, ParseError, SymbolInfo, ISLLanguageService
# dependencies: vscode-languageserver/node.js

domain LanguageService {
  version: "1.0.0"

  type ParsedDocument = String
  type DocumentAST = String
  type ASTNode = String
  type FieldInfo = String
  type ParseError = String
  type SymbolInfo = String
  type ISLLanguageService = String

  invariants exports_present {
    - true
  }
}
