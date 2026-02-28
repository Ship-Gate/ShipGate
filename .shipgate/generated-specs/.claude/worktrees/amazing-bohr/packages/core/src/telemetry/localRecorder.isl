# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: createLocalRecorder, LocalTelemetryRecorder
# dependencies: fs, fs/promises, path

domain LocalRecorder {
  version: "1.0.0"

  type LocalTelemetryRecorder = String

  invariants exports_present {
    - true
  }
}
