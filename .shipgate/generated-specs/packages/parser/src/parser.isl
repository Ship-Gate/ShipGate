# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: parse, ParseResult, Parser
# dependencies: path, y

domain Parser {
  version: "1.0.0"

  type ParseResult = String
  type Parser = String

  invariants exports_present {
    - true
  }
}
