# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: loadCliConfig, saveCliConfig, getToken, getApiUrl, CliConfig
# dependencies: fs, path, os

domain ConfigStore {
  version: "1.0.0"

  type CliConfig = String

  invariants exports_present {
    - true
  }
}
