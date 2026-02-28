# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: ISLParser, ParsedISL, ParsedType, ParsedEntity, ParsedBehavior, ParsedField
# dependencies: 

domain Parser {
  version: "1.0.0"

  type ISLParser = String
  type ParsedISL = String
  type ParsedType = String
  type ParsedEntity = String
  type ParsedBehavior = String
  type ParsedField = String

  invariants exports_present {
    - true
  }
}
