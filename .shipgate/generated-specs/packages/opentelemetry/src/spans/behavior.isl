# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: withBehaviorSpan, TraceBehavior, createBehaviorSpan, BehaviorSpanConfig, BehaviorResult, BehaviorSpan, BehaviorSpanBuilder
# dependencies: @opentelemetry/api

domain Behavior {
  version: "1.0.0"

  type BehaviorSpanConfig = String
  type BehaviorResult = String
  type BehaviorSpan = String
  type BehaviorSpanBuilder = String

  invariants exports_present {
    - true
  }
}
