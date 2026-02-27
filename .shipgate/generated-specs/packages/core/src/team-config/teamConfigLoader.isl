# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: loadTeamConfig, loadTeamConfigFromFile, parseTeamConfigString, TeamConfigError
# dependencies: fs/promises, path, yaml

domain TeamConfigLoader {
  version: "1.0.0"

  type TeamConfigError = String

  invariants exports_present {
    - true
  }
}
