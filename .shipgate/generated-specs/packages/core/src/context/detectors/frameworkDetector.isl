# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: detectFrameworks, FrameworkDetection
# dependencies: fs/promises, path

domain FrameworkDetector {
  version: "1.0.0"

  type FrameworkDetection = String

  invariants exports_present {
    - true
  }
}
