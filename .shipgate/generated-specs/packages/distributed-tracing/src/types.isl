# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: TracingConfig, ExporterConfig, SamplingConfig, SamplingRule, PropagationConfig, EnrichmentConfig, SpanEnricher, BehaviorSpan, SpanKind, SpanStatus, AttributeValue, SpanEvent, SpanLink, BehaviorContext, ConditionResult, ErrorInfo, TraceContext, TracedBehavior, TracingMetrics
# dependencies: 

domain Types {
  version: "1.0.0"

  type TracingConfig = String
  type ExporterConfig = String
  type SamplingConfig = String
  type SamplingRule = String
  type PropagationConfig = String
  type EnrichmentConfig = String
  type SpanEnricher = String
  type BehaviorSpan = String
  type SpanKind = String
  type SpanStatus = String
  type AttributeValue = String
  type SpanEvent = String
  type SpanLink = String
  type BehaviorContext = String
  type ConditionResult = String
  type ErrorInfo = String
  type TraceContext = String
  type TracedBehavior = String
  type TracingMetrics = String

  invariants exports_present {
    - true
  }
}
