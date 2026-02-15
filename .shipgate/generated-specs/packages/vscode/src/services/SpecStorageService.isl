# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: SpecMetadata, StoredSpec, SpecStorageOptions, SpecStorageService
# dependencies: vscode, path, fs, crypto

domain SpecStorageService {
  version: "1.0.0"

  type SpecMetadata = String
  type StoredSpec = String
  type SpecStorageOptions = String
  type SpecStorageService = String

  invariants exports_present {
    - true
  }
}
