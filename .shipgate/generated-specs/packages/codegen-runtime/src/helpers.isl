# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: generateRuntimeHelpers, deepClone, createVerificationReporter, configureRuntimeVerification, getRuntimeConfig, resetRuntimeConfig, PreconditionError, PostconditionError, InvariantError, VerificationError, EntityStore, InMemoryEntityStore, VerificationViolation, VerificationReport, RuntimeVerificationConfig
# dependencies: 

domain Helpers {
  version: "1.0.0"

  type PreconditionError = String
  type PostconditionError = String
  type InvariantError = String
  type VerificationError = String
  type EntityStore = String
  type InMemoryEntityStore = String
  type VerificationViolation = String
  type VerificationReport = String
  type RuntimeVerificationConfig = String

  invariants exports_present {
    - true
  }
}
