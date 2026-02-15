# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: createIntegratedFirewall, integratedGate, IntegratedGateResult, IntegratedFirewall
# dependencies: 

domain IslStudioIntegration {
  version: "1.0.0"

  type IntegratedGateResult = String
  type IntegratedFirewall = String

  invariants exports_present {
    - true
  }
}
