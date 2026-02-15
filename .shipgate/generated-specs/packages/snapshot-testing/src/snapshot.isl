# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: hashContent, generateSnapshotKey, getSnapshotPath, getSnapshotStore, setSnapshotStore, resetSnapshotStore, matchSnapshot, updateSnapshot, defaultSerializer, defaultComparator, SNAPSHOT_VERSION, SNAPSHOT_EXTENSION, DEFAULT_SNAPSHOT_DIR, SnapshotMetadata, SnapshotType, Snapshot, SnapshotFile, SnapshotComparisonResult, SnapshotOptions, SnapshotStore
# dependencies: fs, path, crypto

domain Snapshot {
  version: "1.0.0"

  type SnapshotMetadata = String
  type SnapshotType = String
  type Snapshot = String
  type SnapshotFile = String
  type SnapshotComparisonResult = String
  type SnapshotOptions = String
  type SnapshotStore = String

  invariants exports_present {
    - true
  }
}
