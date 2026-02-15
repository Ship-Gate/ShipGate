# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: StateOptions, MockState
# dependencies: uuid

domain State {
  version: "1.0.0"

  type StateOptions = String
  type MockState = String

  invariants exports_present {
    - true
  }
}
