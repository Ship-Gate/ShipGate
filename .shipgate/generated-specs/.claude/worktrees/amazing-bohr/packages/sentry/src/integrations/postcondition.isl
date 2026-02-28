# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: createPostconditionIntegration, getPostconditionIntegration, trackPostconditionFailure, PostconditionIntegration
# dependencies: @sentry/node

domain Postcondition {
  version: "1.0.0"

  type PostconditionIntegration = String

  invariants exports_present {
    - true
  }
}
