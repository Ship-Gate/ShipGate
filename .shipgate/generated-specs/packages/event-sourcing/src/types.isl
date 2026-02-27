# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: DomainEvent, EventMetadata, EventEnvelope, Command, CommandMetadata, CommandResult, CommandError, AggregateState, Snapshot, EventStream, StreamPosition, SubscriptionOptions, EventHandler, EventStoreConfig, EventQuery
# dependencies: 

domain Types {
  version: "1.0.0"

  type DomainEvent = String
  type EventMetadata = String
  type EventEnvelope = String
  type Command = String
  type CommandMetadata = String
  type CommandResult = String
  type CommandError = String
  type AggregateState = String
  type Snapshot = String
  type EventStream = String
  type StreamPosition = String
  type SubscriptionOptions = String
  type EventHandler = String
  type EventStoreConfig = String
  type EventQuery = String

  invariants exports_present {
    - true
  }
}
