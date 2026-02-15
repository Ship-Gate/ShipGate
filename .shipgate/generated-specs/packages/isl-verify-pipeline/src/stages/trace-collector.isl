# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: collectTraces, collectInlineTraces, writeTraces, findTracesByBehavior, findTraceSlice, extractStateSnapshots, TraceCollectorConfig
# dependencies: fs/promises, path

domain TraceCollector {
  version: "1.0.0"

  type TraceCollectorConfig = String

  invariants exports_present {
    - true
  }
}
