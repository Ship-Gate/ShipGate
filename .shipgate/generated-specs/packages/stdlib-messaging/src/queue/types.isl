# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: queueRegistry, QueueAdapter, ConsumeOptions, RejectOptions, QueueAdapterFactory, QueueAdapterConfig, QueueRegistry
# dependencies: 

domain Types {
  version: "1.0.0"

  type QueueAdapter = String
  type ConsumeOptions = String
  type RejectOptions = String
  type QueueAdapterFactory = String
  type QueueAdapterConfig = String
  type QueueRegistry = String

  invariants exports_present {
    - true
  }
}
