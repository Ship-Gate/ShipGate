# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: getPolicyManifest, getRulesByCategory, getCategories, getPolicyManifestJSON, RuleSeverity, PolicyManifestEntry
# dependencies: 

domain PolicyManifest {
  version: "1.0.0"

  type RuleSeverity = String
  type PolicyManifestEntry = String

  invariants exports_present {
    - true
  }
}
