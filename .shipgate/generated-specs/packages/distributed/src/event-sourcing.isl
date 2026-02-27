# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: createEvent, projection, eventToISL, aggregateToISL, InMemoryEventStore, AggregateRepository, ConcurrentModificationError, ProjectionRunner, SnapshotStore, SnapshottingAggregateRepository
# dependencies: 

domain EventSourcing {
  version: "1.0.0"

  type InMemoryEventStore = String
  type AggregateRepository = String
  type ConcurrentModificationError = String
  type ProjectionRunner = String
  type SnapshotStore = String
  type SnapshottingAggregateRepository = String

  invariants exports_present {
    - true
  }
}
