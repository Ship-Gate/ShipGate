# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: ISLAuthRequirement, ObservedAuthPolicy, AuthDriftClaim, AuthDriftResult, AuthDriftConfig
# dependencies: 

domain Types {
  version: "1.0.0"

  type ISLAuthRequirement = String
  type ObservedAuthPolicy = String
  type AuthDriftClaim = String
  type AuthDriftResult = String
  type AuthDriftConfig = String

  invariants exports_present {
    - true
  }
}
