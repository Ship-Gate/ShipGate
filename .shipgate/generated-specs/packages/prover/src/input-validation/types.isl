# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: ValidationLibrary, ConstraintQuality, PropertyStatus, ValidationEvidence, ValidationSchema, ValidationField, FieldConstraints, FieldAccess, EndpointInfo, InputValidationPropertyProof, Finding
# dependencies: 

domain Types {
  version: "1.0.0"

  type ValidationLibrary = String
  type ConstraintQuality = String
  type PropertyStatus = String
  type ValidationEvidence = String
  type ValidationSchema = String
  type ValidationField = String
  type FieldConstraints = String
  type FieldAccess = String
  type EndpointInfo = String
  type InputValidationPropertyProof = String
  type Finding = String

  invariants exports_present {
    - true
  }
}
