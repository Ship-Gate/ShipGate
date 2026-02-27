# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: getCorrelationContext, extractCorrelationFromHeaders, injectCorrelationToHeaders, getCorrelationId, getCorrelationMetadata, runWithCorrelationContext, CORRELATION_HEADERS, CorrelationContext
# dependencies: @opentelemetry/api

domain Correlation {
  version: "1.0.0"

  type CorrelationContext = String

  invariants exports_present {
    - true
  }
}
