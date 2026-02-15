# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: createPreconditionIntegration, getPreconditionIntegration, trackPreconditionFailure, PreconditionIntegration
# dependencies: @sentry/node

domain Precondition {
  version: "1.0.0"

  type PreconditionIntegration = String

  invariants exports_present {
    - true
  }
}
