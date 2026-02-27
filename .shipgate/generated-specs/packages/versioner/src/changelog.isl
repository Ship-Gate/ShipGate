# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: generateChangelog, prependToChangelog, parseChangelog, ChangelogOptions, ChangelogEntry, ChangelogChange
# dependencies: 

domain Changelog {
  version: "1.0.0"

  type ChangelogOptions = String
  type ChangelogEntry = String
  type ChangelogChange = String

  invariants exports_present {
    - true
  }
}
