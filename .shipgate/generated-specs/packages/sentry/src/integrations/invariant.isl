# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: trackInvariantViolation, trackInvariantViolations, createInvariantChecker, assertInvariant, createStateMonitor, withInvariantProxy, InvariantError
# dependencies: @sentry/node

domain Invariant {
  version: "1.0.0"

  type InvariantError = String

  invariants exports_present {
    - true
  }
}
