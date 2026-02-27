# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: loadConfigFromFile, loadConfig, getDefaultConfig, createConfigTemplate, createJsonConfigTemplate, OutputConfig, AIConfig, VerifyConfig, ISLConfig, ConfigSearchResult, CONFIG_FILES, DEFAULT_CONFIG
# dependencies: fs/promises, path, yaml

domain Config {
  version: "1.0.0"

  type OutputConfig = String
  type AIConfig = String
  type VerifyConfig = String
  type ISLConfig = String
  type ConfigSearchResult = String

  invariants exports_present {
    - true
  }
}
