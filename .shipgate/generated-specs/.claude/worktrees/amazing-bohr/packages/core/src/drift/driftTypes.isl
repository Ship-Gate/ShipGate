# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: DEFAULT_DRIFT_CONFIG, DEFAULT_DRIFT_WATCH_CONFIG, DriftReport, DriftSeverity, DriftIndicatorType, DriftIndicator, CodeLocation, ExtractedFunction, ExtractedImport, DriftConfig, DriftWatchConfig, DriftWatchEvent, DriftWatchEventCallback, DriftWatchHandle, SpecImplPair, DriftScanSummary
# dependencies: 

domain DriftTypes {
  version: "1.0.0"

  type DriftReport = String
  type DriftSeverity = String
  type DriftIndicatorType = String
  type DriftIndicator = String
  type CodeLocation = String
  type ExtractedFunction = String
  type ExtractedImport = String
  type DriftConfig = String
  type DriftWatchConfig = String
  type DriftWatchEvent = String
  type DriftWatchEventCallback = String
  type DriftWatchHandle = String
  type SpecImplPair = String
  type DriftScanSummary = String

  invariants exports_present {
    - true
  }
}
