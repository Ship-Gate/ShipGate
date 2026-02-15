# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: generateInvariantPatches, generateDefensiveMutation, InvariantFix, InvariantConstraint
# dependencies: 

domain Invariant {
  version: "1.0.0"

  type InvariantFix = String
  type InvariantConstraint = String

  invariants exports_present {
    - true
  }
}
