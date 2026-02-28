# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: BuildTarget, TestFramework, BuildOptions, OutputFile, StageResult, StageError, ParseStageData, CheckStageData, ImportStageData, CodegenStageData, TestgenStageData, VerifyStageData, BuildEvidence, EvidenceSummary, BehaviorEvidence, TemporalEvidence, CheckEvidence, PipelineTiming, BuildResult, OutputManifest, ManifestEntry
# dependencies: 

domain Types {
  version: "1.0.0"

  type BuildTarget = String
  type TestFramework = String
  type BuildOptions = String
  type OutputFile = String
  type StageResult = String
  type StageError = String
  type ParseStageData = String
  type CheckStageData = String
  type ImportStageData = String
  type CodegenStageData = String
  type TestgenStageData = String
  type VerifyStageData = String
  type BuildEvidence = String
  type EvidenceSummary = String
  type BehaviorEvidence = String
  type TemporalEvidence = String
  type CheckEvidence = String
  type PipelineTiming = String
  type BuildResult = String
  type OutputManifest = String
  type ManifestEntry = String

  invariants exports_present {
    - true
  }
}
