# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: RequestScope, RequestType, TriageResult, PlanStep, ExecutionPlan, ExecutionResult, GeneratedFile, VerificationResult, OrchestratorResult, OrchestratorOptions, OrchestratorEvent, Orchestrator
# dependencies: @isl-lang/intent-translator, react, vitest

domain Orchestrator {
  version: "1.0.0"

  type RequestScope = String
  type RequestType = String
  type TriageResult = String
  type PlanStep = String
  type ExecutionPlan = String
  type ExecutionResult = String
  type GeneratedFile = String
  type VerificationResult = String
  type OrchestratorResult = String
  type OrchestratorOptions = String
  type OrchestratorEvent = String
  type Orchestrator = String

  invariants exports_present {
    - true
  }
}
