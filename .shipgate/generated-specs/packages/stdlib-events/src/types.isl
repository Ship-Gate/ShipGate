# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: ok, err, EventId, StreamId, EventVersion, CorrelationId, CausationId, GlobalPosition, Actor, Ok, Err, Result, EventEnvelope, EventMap, Snapshot, EventFilter
# dependencies: 

domain Types {
  version: "1.0.0"

  type EventId = String
  type StreamId = String
  type EventVersion = String
  type CorrelationId = String
  type CausationId = String
  type GlobalPosition = String
  type Actor = String
  type Ok = String
  type Err = String
  type Result = String
  type EventEnvelope = String
  type EventMap = String
  type Snapshot = String
  type EventFilter = String

  invariants exports_present {
    - true
  }
}
