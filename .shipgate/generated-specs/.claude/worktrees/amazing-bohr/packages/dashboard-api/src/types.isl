# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: VerdictSchema, FileVerdictSchema, MethodSchema, TriggerSchema, FileResultSchema, CoverageSchema, CreateReportSchema, ListReportsQuerySchema, TrendsQuerySchema, DriftQuerySchema, Verdict, FileVerdict, Method, Trigger, FileResult, Coverage, CreateReportInput, VerificationReport, ListReportsQuery, TrendsQuery, DriftQuery, ApiResponse, PaginatedResponse, ApiError, TrendPoint, DriftAlert, CoverageSummary, ReportDiff
# dependencies: zod

domain Types {
  version: "1.0.0"

  type Verdict = String
  type FileVerdict = String
  type Method = String
  type Trigger = String
  type FileResult = String
  type Coverage = String
  type CreateReportInput = String
  type VerificationReport = String
  type ListReportsQuery = String
  type TrendsQuery = String
  type DriftQuery = String
  type ApiResponse = String
  type PaginatedResponse = String
  type ApiError = String
  type TrendPoint = String
  type DriftAlert = String
  type CoverageSummary = String
  type ReportDiff = String

  invariants exports_present {
    - true
  }
}
