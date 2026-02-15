# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: isTransientError, isNonRetryableError, TimeoutError, OrchestratorConfig, PipelineCheckpoint, PipelineOrchestrator
# dependencies: fs/promises, path

domain Orchestrator {
  version: "1.0.0"

  type TimeoutError = String
  type OrchestratorConfig = String
  type PipelineCheckpoint = String
  type PipelineOrchestrator = String

  invariants exports_present {
    - true
  }
}
