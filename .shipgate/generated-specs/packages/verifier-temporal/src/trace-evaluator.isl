# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: loadTraceFile, loadTraceFiles, discoverTraceFiles, evaluateTemporalRequirement, evaluateTemporalProperties, TemporalPropertyEvaluation, TemporalEvaluationReport, TraceEvaluationOptions
# dependencies: fs/promises, fs, path

domain TraceEvaluator {
  version: "1.0.0"

  type TemporalPropertyEvaluation = String
  type TemporalEvaluationReport = String
  type TraceEvaluationOptions = String

  invariants exports_present {
    - true
  }
}
