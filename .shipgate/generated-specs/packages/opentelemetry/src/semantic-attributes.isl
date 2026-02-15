# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: ISLSemanticAttributes, ISLSemanticAttributeKey, ISLSemanticAttributeValue, VerificationVerdict, CheckType, ChaosInjectionType, VerificationType
# dependencies: 

domain SemanticAttributes {
  version: "1.0.0"

  type ISLSemanticAttributeKey = String
  type ISLSemanticAttributeValue = String
  type VerificationVerdict = String
  type CheckType = String
  type ChaosInjectionType = String
  type VerificationType = String

  invariants exports_present {
    - true
  }
}
