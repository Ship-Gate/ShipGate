# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: AppendResult, EventStore, NewEvent, InMemoryEventStore
# dependencies: 

domain Store {
  version: "1.0.0"

  type AppendResult = String
  type EventStore = String
  type NewEvent = String
  type InMemoryEventStore = String

  invariants exports_present {
    - true
  }
}
