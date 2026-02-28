# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: DEFAULT_GUARDRAIL_POLICY, EXIT_CODES, DEFAULT_THRESHOLDS, DEV_THRESHOLDS, GuardrailPolicy, RiskAcceptance, GuardrailResult, AuthoritativeVerdict, SignalSource, VerificationSignal, SignalFinding, ThresholdConfig, AggregatedSignals, EvidenceArtifact, EvidenceBundle, AuthoritativeGateResult, VerdictReason, AuthoritativeGateInput, VerdictSource, CombinedVerdictResult
# dependencies: 

domain Types {
  version: "1.0.0"

  type GuardrailPolicy = String
  type RiskAcceptance = String
  type GuardrailResult = String
  type AuthoritativeVerdict = String
  type SignalSource = String
  type VerificationSignal = String
  type SignalFinding = String
  type ThresholdConfig = String
  type AggregatedSignals = String
  type EvidenceArtifact = String
  type EvidenceBundle = String
  type AuthoritativeGateResult = String
  type VerdictReason = String
  type AuthoritativeGateInput = String
  type VerdictSource = String
  type CombinedVerdictResult = String

  invariants exports_present {
    - true
  }
}
