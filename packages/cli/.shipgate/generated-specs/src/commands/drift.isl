# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: detectDrift, printDriftResult, getDriftExitCode, generateSpecWithUnbound, DriftOptions, DetectedRoute, DetectedType, SpecBehavior, SpecEntity, DriftChange, DriftResult
# dependencies: fs/promises, fs, path, glob, chalk, @isl-lang/parser

domain Drift {
  version: "1.0.0"

  type DriftOptions = String
  type DetectedRoute = String
  type DetectedType = String
  type SpecBehavior = String
  type SpecEntity = String
  type DriftChange = String
  type DriftResult = String

  invariants exports_present {
    - true
  }
}
