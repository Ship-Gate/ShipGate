# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: VerificationResult, TrustScore, BuildResult, EvidenceReport, EvidenceStorageOptions, EvidenceQuery, EvidenceStorageService
# dependencies: vscode, path, fs, crypto

domain EvidenceStorageService {
  version: "1.0.0"

  type VerificationResult = String
  type TrustScore = String
  type BuildResult = String
  type EvidenceReport = String
  type EvidenceStorageOptions = String
  type EvidenceQuery = String
  type EvidenceStorageService = String

  invariants exports_present {
    - true
  }
}
