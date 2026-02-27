# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: setupCommandHandlers, setupProjections, generateEventSourcing, EventGeneratorOptions, EventGenerator
# dependencies: @isl-lang/event-sourcing

domain Generator {
  version: "1.0.0"

  type EventGeneratorOptions = String
  type EventGenerator = String

  invariants exports_present {
    - true
  }
}
