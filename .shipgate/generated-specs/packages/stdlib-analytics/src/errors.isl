# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: AnalyticsError, InvalidEventNameError, MissingIdentityError, QueueFullError, DuplicateEventError, PipelineBackpressureError, SinkError, MetricError, FunnelError
# dependencies: 

domain Errors {
  version: "1.0.0"

  type AnalyticsError = String
  type InvalidEventNameError = String
  type MissingIdentityError = String
  type QueueFullError = String
  type DuplicateEventError = String
  type PipelineBackpressureError = String
  type SinkError = String
  type MetricError = String
  type FunnelError = String

  invariants exports_present {
    - true
  }
}
