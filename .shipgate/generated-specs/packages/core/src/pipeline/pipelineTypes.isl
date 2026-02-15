# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: DEFAULT_PIPELINE_OPTIONS, PipelineInputMode, PipelineInput, PipelineOptions, StepResult, ContextStepResult, TranslateStepResult, ValidateStepResult, GenerateStepResult, VerifyStepResult, ScoreStepResult, AnyStepResult, PipelineStatus, PipelineResult, PipelineState, ClauseInfo
# dependencies: 

domain PipelineTypes {
  version: "1.0.0"

  type PipelineInputMode = String
  type PipelineInput = String
  type PipelineOptions = String
  type StepResult = String
  type ContextStepResult = String
  type TranslateStepResult = String
  type ValidateStepResult = String
  type GenerateStepResult = String
  type VerifyStepResult = String
  type ScoreStepResult = String
  type AnyStepResult = String
  type PipelineStatus = String
  type PipelineResult = String
  type PipelineState = String
  type ClauseInfo = String

  invariants exports_present {
    - true
  }
}
