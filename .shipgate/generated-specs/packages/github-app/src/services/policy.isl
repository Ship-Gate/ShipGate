# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: createPolicyService, PolicyService, PolicyBundle, PolicyPackConfig, PinBundleConfig
# dependencies: 

domain Policy {
  version: "1.0.0"

  type PolicyService = String
  type PolicyBundle = String
  type PolicyPackConfig = String
  type PinBundleConfig = String

  invariants exports_present {
    - true
  }
}
