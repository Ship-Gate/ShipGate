# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: readJson, readJsonSync, writeJson, writeJsonSync, ensureDir, ensureDirSync, fileExists, fileExistsSync, deleteFile, updateJson, JsonStoreOptions
# dependencies: fs, path

domain JsonStore {
  version: "1.0.0"

  type JsonStoreOptions = String

  invariants exports_present {
    - true
  }
}
