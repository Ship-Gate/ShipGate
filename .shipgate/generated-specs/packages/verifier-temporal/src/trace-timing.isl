# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: extractHandlerDurations, extractTimingSamples, extractEventTimestamps, verifyWithinFromTraces, verifyMultipleTimings, verifyEventuallyWithin, verifyAlwaysFromTraces, verifyNeverFromTraces, verifyTemporalClauses, formatTemporalClauseTable, DEFAULT_TRACE_TIMING_OPTIONS, TraceTimingResult, TraceTimingOptions, TimingCheck, EventuallyWithinResult, TemporalClauseResult, AlwaysNeverResult
# dependencies: 

domain TraceTiming {
  version: "1.0.0"

  type TraceTimingResult = String
  type TraceTimingOptions = String
  type TimingCheck = String
  type EventuallyWithinResult = String
  type TemporalClauseResult = String
  type AlwaysNeverResult = String

  invariants exports_present {
    - true
  }
}
