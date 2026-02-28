# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: extractIntentTags, extractEndpoints, calculateIntentCoverage, formatIntentCoverage, checkIntentMismatch, IntentTag, IntentCoverage, IntentMismatch
# dependencies: fs/promises, path

domain IntentCoverage {
  version: "1.0.0"

  type IntentTag = String
  type IntentCoverage = String
  type IntentMismatch = String

  invariants exports_present {
    - true
  }
}
