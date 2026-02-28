# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: detectStack, StackDetectionResult
# dependencies: fs/promises, path

domain StackDetector {
  version: "1.0.0"

  type StackDetectionResult = String

  invariants exports_present {
    - true
  }
}
