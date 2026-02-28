# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: isPrimitiveType, createToken, KEYWORDS, DURATION_UNITS, SHORT_UNIT_MAP, PRECEDENCE, TokenType, TokenKind, Token, DurationUnit
# dependencies: 

domain Tokens {
  version: "1.0.0"

  type TokenType = String
  type TokenKind = String
  type Token = String
  type DurationUnit = String

  invariants exports_present {
    - true
  }
}
