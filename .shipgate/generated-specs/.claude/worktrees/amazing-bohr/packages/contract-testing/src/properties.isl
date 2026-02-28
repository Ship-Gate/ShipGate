# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: PropertyTest, PropertyGenerator
# dependencies: fast-check

domain Properties {
  version: "1.0.0"

  type PropertyTest = String
  type PropertyGenerator = String

  invariants exports_present {
    - true
  }
}
