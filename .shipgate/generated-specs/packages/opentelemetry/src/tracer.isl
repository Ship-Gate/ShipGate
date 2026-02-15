# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: createISLTracer, ISLTracerConfig, VerificationResult, CheckResult, CoverageResult, ISLTracer
# dependencies: @opentelemetry/api, @opentelemetry/sdk-trace-node, @opentelemetry/resources, @opentelemetry/semantic-conventions, @opentelemetry/context-async-hooks

domain Tracer {
  version: "1.0.0"

  type ISLTracerConfig = String
  type VerificationResult = String
  type CheckResult = String
  type CoverageResult = String
  type ISLTracer = String

  invariants exports_present {
    - true
  }
}
