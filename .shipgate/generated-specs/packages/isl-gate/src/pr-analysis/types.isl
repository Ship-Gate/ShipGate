# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: DiffHunk, ChangeType, FileChange, PRAnalysis, RiskLabel, SpecVerification, SkipReason, SkippedFile, VerificationPlan, PRAnalysisConfig, AnalyzePROptions, ResolvedPRAnalysisConfig
# dependencies: 

domain Types {
  version: "1.0.0"

  type DiffHunk = String
  type ChangeType = String
  type FileChange = String
  type PRAnalysis = String
  type RiskLabel = String
  type SpecVerification = String
  type SkipReason = String
  type SkippedFile = String
  type VerificationPlan = String
  type PRAnalysisConfig = String
  type AnalyzePROptions = String
  type ResolvedPRAnalysisConfig = String

  invariants exports_present {
    - true
  }
}
