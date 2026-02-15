# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: parseVersion, formatVersion, computeNextVersion, bumpVersion, compareVersions, satisfiesRange, getMajor, getMinor, getPatch, isPrerelease, isValidVersion, SemanticVersion, VersionBump, VersionOptions
# dependencies: 

domain Versioner {
  version: "1.0.0"

  type SemanticVersion = String
  type VersionBump = String
  type VersionOptions = String

  invariants exports_present {
    - true
  }
}
