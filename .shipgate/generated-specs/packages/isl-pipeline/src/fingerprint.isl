# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: normalizeMessage, normalizeSpan, stableFingerprint, computeViolationFingerprint, fingerprintsEqual, hasViolationsChanged, violationsDiffSummary, ViolationLike, FingerprintOptions, StuckDetectionConfig, AbortReason, AbortCondition, FingerprintTracker
# dependencies: crypto

domain Fingerprint {
  version: "1.0.0"

  type ViolationLike = String
  type FingerprintOptions = String
  type StuckDetectionConfig = String
  type AbortReason = String
  type AbortCondition = String
  type FingerprintTracker = String

  invariants exports_present {
    - true
  }
}
