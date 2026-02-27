# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: parse, DomainDeclaration, ParseResult
# dependencies: 

domain ParserD {
  version: "1.0.0"

  type DomainDeclaration = String
  type ParseResult = String

  invariants exports_present {
    - true
  }
}
