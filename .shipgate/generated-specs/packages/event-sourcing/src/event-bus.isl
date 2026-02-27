# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: createEventBus, EventBusOptions, EventHandler, EventSubscription, EventBus
# dependencies: 

domain EventBus {
  version: "1.0.0"

  type EventBusOptions = String
  type EventHandler = String
  type EventSubscription = String
  type EventBus = String

  invariants exports_present {
    - true
  }
}
