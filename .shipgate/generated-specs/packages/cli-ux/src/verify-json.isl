# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: createVerifyJsonOutput, formatVerifyJson, printVerifyJson, parseVerifyJson, getVerifyKeyMetrics, createMinimalVerifyJson, VerifyJsonOptions, VerifyJsonFormatResult, VerifyJsonParseResult, VerifyKeyMetrics
# dependencies: 

domain VerifyJson {
  version: "1.0.0"

  type VerifyJsonOptions = String
  type VerifyJsonFormatResult = String
  type VerifyJsonParseResult = String
  type VerifyKeyMetrics = String

  invariants exports_present {
    - true
  }
}
