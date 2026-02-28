# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: create, generateXState, XStateOptions, XStateGenerator
# dependencies: xstate

domain XstateGenerator {
  version: "1.0.0"

  type XStateOptions = String
  type XStateGenerator = String

  invariants exports_present {
    - true
  }
}
