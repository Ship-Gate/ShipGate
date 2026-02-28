# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: ISLNode, DomainNode, TypeNode, EntityNode, BehaviorNode, FieldNode, ConstraintNode, InvariantNode, ConditionNode, OutputNode, ErrorNode, ISLSymbol, ISLAnalyzer, ParsedDocument, ParseError
# dependencies: vscode-languageserver-textdocument, vscode-languageserver

domain Analyzer {
  version: "1.0.0"

  type ISLNode = String
  type DomainNode = String
  type TypeNode = String
  type EntityNode = String
  type BehaviorNode = String
  type FieldNode = String
  type ConstraintNode = String
  type InvariantNode = String
  type ConditionNode = String
  type OutputNode = String
  type ErrorNode = String
  type ISLSymbol = String
  type ISLAnalyzer = String
  type ParsedDocument = String
  type ParseError = String

  invariants exports_present {
    - true
  }
}
