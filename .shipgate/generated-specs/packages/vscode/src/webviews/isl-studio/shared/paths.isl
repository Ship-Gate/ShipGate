# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: getShipgateDir, getStudioDir, getStatePath, getTempPath, getBackupPath, createStudioPaths, normalizePath, isWithinWorkspace, SHIPGATE_DIR, STUDIO_DIR, STATE_FILE, StudioPaths
# dependencies: path

domain Paths {
  version: "1.0.0"

  type StudioPaths = String

  invariants exports_present {
    - true
  }
}
