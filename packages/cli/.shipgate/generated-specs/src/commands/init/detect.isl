# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: scanForPatterns, getSubDirs, detectProject, ProjectProfile, DetectedPattern
# dependencies: fs/promises, path

domain Detect {
  version: "1.0.0"

  type ProjectProfile = String
  type DetectedPattern = String

  invariants exports_present {
    - true
  }
}
