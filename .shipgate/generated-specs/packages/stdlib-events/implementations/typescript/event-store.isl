# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: AppendResult, EventStoreError, ReadOptions, ReadResult, ReadAllOptions, ReadAllResult, EventHandler, SubscribeOptions, Subscription, IEventStore, InMemoryEventStore
# dependencies: 

domain EventStore {
  version: "1.0.0"

  type AppendResult = String
  type EventStoreError = String
  type ReadOptions = String
  type ReadResult = String
  type ReadAllOptions = String
  type ReadAllResult = String
  type EventHandler = String
  type SubscribeOptions = String
  type Subscription = String
  type IEventStore = String
  type InMemoryEventStore = String

  invariants exports_present {
    - true
  }
}
