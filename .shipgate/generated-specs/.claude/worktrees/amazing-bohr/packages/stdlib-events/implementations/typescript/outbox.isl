# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: createOutboxMessage, createOutboxProcessor, createIntegrationEvent, OutboxMessage, IOutboxProcessor, MessagePublisher, InMemoryOutboxProcessor, IntegrationEvent
# dependencies: 

domain Outbox {
  version: "1.0.0"

  type OutboxMessage = String
  type IOutboxProcessor = String
  type MessagePublisher = String
  type InMemoryOutboxProcessor = String
  type IntegrationEvent = String

  invariants exports_present {
    - true
  }
}
