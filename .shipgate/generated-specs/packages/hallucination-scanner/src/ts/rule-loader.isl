# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: loadRules, loadRulesFromFile, RuleLoaderOptions
# dependencies: node:path, node:fs/promises

domain RuleLoader {
  version: "1.0.0"

  type RuleLoaderOptions = String

  invariants exports_present {
    - true
  }
}
