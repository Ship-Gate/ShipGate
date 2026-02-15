# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: listRuns, getRun, getRunDiff, ingestProofBundle, FileResult, Coverage, VerificationReport, ListRunsParams, PaginatedRuns, ReportDiff, IngestProofBundlePayload
# dependencies: 

domain RunsApi {
  version: "1.0.0"

  type FileResult = String
  type Coverage = String
  type VerificationReport = String
  type ListRunsParams = String
  type PaginatedRuns = String
  type ReportDiff = String
  type IngestProofBundlePayload = String

  invariants exports_present {
    - true
  }
}
