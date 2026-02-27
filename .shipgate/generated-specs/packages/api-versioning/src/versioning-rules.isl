# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: createVersioningRules, determineVersionBump, VersionBump, VersioningRules, DefaultVersioningRules
# dependencies: semver

domain VersioningRules {
  version: "1.0.0"

  type VersionBump = String
  type VersioningRules = String
  type DefaultVersioningRules = String

  invariants exports_present {
    - true
  }
}
