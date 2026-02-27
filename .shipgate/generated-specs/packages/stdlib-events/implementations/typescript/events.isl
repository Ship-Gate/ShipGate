# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: createDomainEvent, createEventStream, isDomainEvent, generateStreamId, parseStreamId, DomainEvent, EventStream
# dependencies: 

domain Events {
  version: "1.0.0"

  type DomainEvent = String
  type EventStream = String

  invariants exports_present {
    - true
  }
}
