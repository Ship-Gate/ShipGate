# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: DEFAULT_POLICY_CONFIG, PolicyConfig, ThresholdProfile, EvidenceRequirement, EvidenceType, PolicyException
# dependencies: 

domain PolicySchema {
  version: "1.0.0"

  type PolicyConfig = String
  type ThresholdProfile = String
  type EvidenceRequirement = String
  type EvidenceType = String
  type PolicyException = String

  invariants exports_present {
    - true
  }
}
