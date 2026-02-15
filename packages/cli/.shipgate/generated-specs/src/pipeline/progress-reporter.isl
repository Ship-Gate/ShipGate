# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: ProgressEventType, StageStartEvent, StageProgressEvent, StageCompleteEvent, StageErrorEvent, StageRetryEvent, PipelineCompleteEvent, ProgressEvent, ProgressReporter, NoopProgressReporter, JsonProgressReporter, CliProgressReporter, VscodeProgressReporter
# dependencies: 

domain ProgressReporter {
  version: "1.0.0"

  type ProgressEventType = String
  type StageStartEvent = String
  type StageProgressEvent = String
  type StageCompleteEvent = String
  type StageErrorEvent = String
  type StageRetryEvent = String
  type PipelineCompleteEvent = String
  type ProgressEvent = String
  type ProgressReporter = String
  type NoopProgressReporter = String
  type JsonProgressReporter = String
  type CliProgressReporter = String
  type VscodeProgressReporter = String

  invariants exports_present {
    - true
  }
}
