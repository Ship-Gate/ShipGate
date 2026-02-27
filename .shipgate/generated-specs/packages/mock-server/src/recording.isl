# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: Recording, RecordingOptions, RecordingManager
# dependencies: fs, path

domain Recording {
  version: "1.0.0"

  type Recording = String
  type RecordingOptions = String
  type RecordingManager = String

  invariants exports_present {
    - true
  }
}
