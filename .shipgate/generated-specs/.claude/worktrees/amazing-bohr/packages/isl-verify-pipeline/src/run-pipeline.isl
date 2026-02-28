# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: runPipeline, PipelineRunConfig, GateEvidence, StageOutcome, PipelineRunResult
# dependencies: fs/promises, path, crypto

domain RunPipeline {
  version: "1.0.0"

  type PipelineRunConfig = String
  type GateEvidence = String
  type StageOutcome = String
  type PipelineRunResult = String

  invariants exports_present {
    - true
  }
}
