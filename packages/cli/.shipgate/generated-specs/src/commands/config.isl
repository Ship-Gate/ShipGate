# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: configSet, configGet, configList, configPath, printConfigResult, getConfigExitCode, ConfigCommandResult
# dependencies: fs/promises, fs, path, chalk, yaml

domain Config {
  version: "1.0.0"

  type ConfigCommandResult = String

  invariants exports_present {
    - true
  }
}
