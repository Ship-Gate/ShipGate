# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: detectAuth, scanForAuthPatterns, AuthDetection
# dependencies: fs/promises, path

domain AuthDetector {
  version: "1.0.0"

  type AuthDetection = String

  invariants exports_present {
    - true
  }
}
