# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: createEventStore, StoredEvent, EventMetadata, EventStoreOptions, EventStoreAdapter, InMemoryEventStoreAdapter, EventStore
# dependencies: uuid

domain EventStore {
  version: "1.0.0"

  type StoredEvent = String
  type EventMetadata = String
  type EventStoreOptions = String
  type EventStoreAdapter = String
  type InMemoryEventStoreAdapter = String
  type EventStore = String

  invariants exports_present {
    - true
  }
}
