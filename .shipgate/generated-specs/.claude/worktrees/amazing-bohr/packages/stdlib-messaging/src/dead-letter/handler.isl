# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: DefaultDeadLetterHandler, LoggingDeadLetterHandler, CallbackDeadLetterHandler, CompositeDeadLetterHandler, DefaultDeadLetterProcessor, DeadLetterHandlerBuilder
# dependencies: 

domain Handler {
  version: "1.0.0"

  type DefaultDeadLetterHandler = String
  type LoggingDeadLetterHandler = String
  type CallbackDeadLetterHandler = String
  type CompositeDeadLetterHandler = String
  type DefaultDeadLetterProcessor = String
  type DeadLetterHandlerBuilder = String

  invariants exports_present {
    - true
  }
}
