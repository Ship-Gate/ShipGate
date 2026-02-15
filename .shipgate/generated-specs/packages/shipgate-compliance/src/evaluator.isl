# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: evaluateSOC2, VerdictArtifact, Violation, SOC2EvaluationInput, SOC2EvaluationResult
# dependencies: 

domain Evaluator {
  version: "1.0.0"

  type VerdictArtifact = String
  type Violation = String
  type SOC2EvaluationInput = String
  type SOC2EvaluationResult = String

  invariants exports_present {
    - true
  }
}
