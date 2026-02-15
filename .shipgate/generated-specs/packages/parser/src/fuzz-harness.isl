# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: fuzzParse, batchFuzzParse, generateFuzzReport, DEFAULT_FUZZ_LIMITS, ParserFuzzLimits, FuzzParseResult, FuzzReport
# dependencies: 

domain FuzzHarness {
  version: "1.0.0"

  type ParserFuzzLimits = String
  type FuzzParseResult = String
  type FuzzReport = String

  invariants exports_present {
    - true
  }
}
