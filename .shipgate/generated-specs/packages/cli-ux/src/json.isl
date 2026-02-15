# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: getDecision, createJsonOutput, formatJson, printJson, parseJson, getKeyMetrics, createMinimalJson, JsonOutputOptions, JsonFormatResult, JsonParseResult, KeyMetrics
# dependencies: 

domain Json {
  version: "1.0.0"

  type JsonOutputOptions = String
  type JsonFormatResult = String
  type JsonParseResult = String
  type KeyMetrics = String

  invariants exports_present {
    - true
  }
}
