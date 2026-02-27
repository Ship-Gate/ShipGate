# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: PIPELINE_TOOL_SCHEMAS, OutputPaths, WorkspaceConfig, BuildInput, GeneratedFileInfo, BuildReportSummary, BuildResult, BuildErrorCode, VerifyInput, CategoryScore, VerificationFailure, VerifyReportSummary, VerifyResult, VerifyErrorCode, PipelineToolName
# dependencies: 

domain PipelineTypes {
  version: "1.0.0"

  type OutputPaths = String
  type WorkspaceConfig = String
  type BuildInput = String
  type GeneratedFileInfo = String
  type BuildReportSummary = String
  type BuildResult = String
  type BuildErrorCode = String
  type VerifyInput = String
  type CategoryScore = String
  type VerificationFailure = String
  type VerifyReportSummary = String
  type VerifyResult = String
  type VerifyErrorCode = String
  type PipelineToolName = String

  invariants exports_present {
    - true
  }
}
