# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: getGateMessage, getFeatureDescription, formatFeatureName, getHeadline, getCTA, FeatureNames, GateReasonMessages, Headlines, ValueProps, CTAs, FeatureDescriptions, FeatureName, GateReason
# dependencies: 

domain ProCopy {
  version: "1.0.0"

  type FeatureName = String
  type GateReason = String

  invariants exports_present {
    - true
  }
}
