# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: createEmptyScanResult, normalizeVerdict, Verdict, FileStatus, VerificationMode, FileFinding, ScanRunResult, ScanRunMetadata, ScanResult
# dependencies: 

domain Types {
  version: "1.0.0"

  type Verdict = String
  type FileStatus = String
  type VerificationMode = String
  type FileFinding = String
  type ScanRunResult = String
  type ScanRunMetadata = String
  type ScanResult = String

  invariants exports_present {
    - true
  }
}
