# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: EventId, StreamId, EventVersion, CorrelationId, CausationId, Actor, RetryPolicy, EventFilter, Snapshot, ProjectionError
# dependencies: 

domain Types {
  version: "1.0.0"

  type EventId = String
  type StreamId = String
  type EventVersion = String
  type CorrelationId = String
  type CausationId = String
  type Actor = String
  type RetryPolicy = String
  type EventFilter = String
  type Snapshot = String
  type ProjectionError = String

  invariants exports_present {
    - true
  }
}
