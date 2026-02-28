# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: ReportFormat, ReportScope, ReportVerdict, FileStatus, FileVerificationMethod, ReportOptions, ReportRepositoryInfo, ReportFileResult, ReportCoverageSummary, TrendDataPoint, ReportRecommendation, ReportData, ReportResult
# dependencies: 

domain ReportTypes {
  version: "1.0.0"

  type ReportFormat = String
  type ReportScope = String
  type ReportVerdict = String
  type FileStatus = String
  type FileVerificationMethod = String
  type ReportOptions = String
  type ReportRepositoryInfo = String
  type ReportFileResult = String
  type ReportCoverageSummary = String
  type TrendDataPoint = String
  type ReportRecommendation = String
  type ReportData = String
  type ReportResult = String

  invariants exports_present {
    - true
  }
}
