# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: islExpressMiddleware, islExpressErrorHandler, traceBehavior, traceVerification, createISLRequestHeaders, ExpressInstrumentationOptions
# dependencies: @opentelemetry/api

domain Express {
  version: "1.0.0"

  type ExpressInstrumentationOptions = String

  invariants exports_present {
    - true
  }
}
