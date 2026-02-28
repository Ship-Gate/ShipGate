# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: startBehaviorSpan, startVerificationSpan, startCheckSpan, recordVerificationToSpan, createISLSpan, withBehaviorTracking, withVerificationTracking, measureTiming, addTimingMeasurement, startDomainTransaction, ISL_OPERATIONS, ISLOperation
# dependencies: @sentry/node

domain Spans {
  version: "1.0.0"

  type ISLOperation = String

  invariants exports_present {
    - true
  }
}
