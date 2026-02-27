# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: getISLContext, setISLContext, withISLContext, runWithISLContext, createISLContextFromSpan, createISLHeaders, parseISLHeaders, ISL_HEADERS, ISLContextData, ISLContextPropagator, ISLCompositePropagator
# dependencies: @opentelemetry/api

domain IslContext {
  version: "1.0.0"

  type ISLContextData = String
  type ISLContextPropagator = String
  type ISLCompositePropagator = String

  invariants exports_present {
    - true
  }
}
