# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: DEFAULT_WATCH_CONFIG, WatchConfig, WatchEvent, WatchPhase, VerificationResult, WatchEventCallback, WatchHandle, WatchStatus, MarkerFileContent, EvidenceWriteOptions, EvidenceSummaryFile
# dependencies: 

domain WatchTypes {
  version: "1.0.0"

  type WatchConfig = String
  type WatchEvent = String
  type WatchPhase = String
  type VerificationResult = String
  type WatchEventCallback = String
  type WatchHandle = String
  type WatchStatus = String
  type MarkerFileContent = String
  type EvidenceWriteOptions = String
  type EvidenceSummaryFile = String

  invariants exports_present {
    - true
  }
}
