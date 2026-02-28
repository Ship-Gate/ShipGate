# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: DeadLetterHandler, DeadLetterPolicy, BackoffPolicy, DeadLetterProcessor, DeadLetterInspector, DeadLetterQueryOptions, DeadLetterMessage, DeadLetterStats, DeadLetterManager
# dependencies: 

domain Types {
  version: "1.0.0"

  type DeadLetterHandler = String
  type DeadLetterPolicy = String
  type BackoffPolicy = String
  type DeadLetterProcessor = String
  type DeadLetterInspector = String
  type DeadLetterQueryOptions = String
  type DeadLetterMessage = String
  type DeadLetterStats = String
  type DeadLetterManager = String

  invariants exports_present {
    - true
  }
}
