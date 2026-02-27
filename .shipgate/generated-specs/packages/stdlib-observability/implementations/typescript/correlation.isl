# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: getCorrelationContext, setCorrelationContext, withCorrelationContext, withoutCorrelationContext, generateCorrelationId, generateRequestId, startNewTrace, extractCorrelationFromHeaders, injectCorrelationIntoHeaders, isValidTraceId, isValidSpanId, isValidUUID, createCorrelationMiddleware, CorrelationContext, CorrelationHeaders, CorrelationMiddleware
# dependencies: async_hooks

domain Correlation {
  version: "1.0.0"

  type CorrelationContext = String
  type CorrelationHeaders = String
  type CorrelationMiddleware = String

  invariants exports_present {
    - true
  }
}
