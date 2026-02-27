# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: createTracedFetch, getCorrelationHeaders, tracedFetch, TracedFetchOptions, TracedFetchFunction
# dependencies: @opentelemetry/api, @isl-lang/distributed-tracing/adapters/fetch

domain Fetch {
  version: "1.0.0"

  type TracedFetchOptions = String
  type TracedFetchFunction = String

  invariants exports_present {
    - true
  }
}
