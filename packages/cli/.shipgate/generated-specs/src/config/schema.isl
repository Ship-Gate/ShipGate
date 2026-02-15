# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: applyDefaults, DEFAULT_IGNORE, DEFAULT_CI_IGNORE, DEFAULT_CI_CONFIG, DEFAULT_SCANNING_CONFIG, DEFAULT_GENERATE_CONFIG, DEFAULT_GUARDRAILS_CONFIG, DEFAULT_SHIPGATE_CONFIG, FailOnLevel, SpeclessMode, ShipGateCIConfig, ShipGateScanningConfig, ShipGateGenerateConfig, ShipGateGuardrailsConfig, ShipGateSpecsConfig, ShipGatePolicyToggle, ShipGateVerifyConfig, ShipGateEvidenceConfig, ShipGateConfig
# dependencies: 

domain Schema {
  version: "1.0.0"

  type FailOnLevel = String
  type SpeclessMode = String
  type ShipGateCIConfig = String
  type ShipGateScanningConfig = String
  type ShipGateGenerateConfig = String
  type ShipGateGuardrailsConfig = String
  type ShipGateSpecsConfig = String
  type ShipGatePolicyToggle = String
  type ShipGateVerifyConfig = String
  type ShipGateEvidenceConfig = String
  type ShipGateConfig = String

  invariants exports_present {
    - true
  }
}
