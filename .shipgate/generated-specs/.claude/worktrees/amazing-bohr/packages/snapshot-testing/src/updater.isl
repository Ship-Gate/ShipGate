# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: markAccessed, getAccessedSnapshots, clearAccessedSnapshots, saveSnapshots, isUpdateMode, findSnapshotFiles, getSnapshotSummary, removeObsoleteSnapshots, cleanEmptySnapshotDirs, resetStats, recordPassed, recordFailed, recordAdded, recordUpdated, recordRemoved, recordObsolete, getStats, formatStats, UpdateResult, UpdateOptions, SnapshotSummary, TestRunStats
# dependencies: fs, path

domain Updater {
  version: "1.0.0"

  type UpdateResult = String
  type UpdateOptions = String
  type SnapshotSummary = String
  type TestRunStats = String

  invariants exports_present {
    - true
  }
}
