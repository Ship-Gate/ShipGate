# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: ComplianceFramework, ControlStatus, RiskLevel, Domain, TypeDefinition, FieldDefinition, BehaviorDefinition, ConditionDefinition, ActorDefinition, SecuritySpec, RateLimitSpec, EncryptionSpec, ObservabilitySpec, LogSpec, ComplianceSpec, BehaviorComplianceSpec, VerifyResult, VerifyDetail, ControlMapping, ComplianceEvidence, ComplianceGap, VerificationProof, ComplianceReport, ComplianceSummary, ComplianceOptions, FrameworkControl, ISLMapping
# dependencies: 

domain Types {
  version: "1.0.0"

  type ComplianceFramework = String
  type ControlStatus = String
  type RiskLevel = String
  type Domain = String
  type TypeDefinition = String
  type FieldDefinition = String
  type BehaviorDefinition = String
  type ConditionDefinition = String
  type ActorDefinition = String
  type SecuritySpec = String
  type RateLimitSpec = String
  type EncryptionSpec = String
  type ObservabilitySpec = String
  type LogSpec = String
  type ComplianceSpec = String
  type BehaviorComplianceSpec = String
  type VerifyResult = String
  type VerifyDetail = String
  type ControlMapping = String
  type ComplianceEvidence = String
  type ComplianceGap = String
  type VerificationProof = String
  type ComplianceReport = String
  type ComplianceSummary = String
  type ComplianceOptions = String
  type FrameworkControl = String
  type ISLMapping = String

  invariants exports_present {
    - true
  }
}
