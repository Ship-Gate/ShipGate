# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: writeFiles, generateSnapshotFile, WriteOptions, WriteResult
# dependencies: fs, path, prettier, @biomejs/biome

domain FileWriter {
  version: "1.0.0"

  type WriteOptions = String
  type WriteResult = String

  invariants exports_present {
    - true
  }
}
