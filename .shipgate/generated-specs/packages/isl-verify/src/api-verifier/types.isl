# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: APICallEvidence, ExtractedAPICall, PackageSignature, MethodSignature, ParameterSignature, DeprecatedMethod, APIVerificationResult
# dependencies: 

domain Types {
  version: "1.0.0"

  type APICallEvidence = String
  type ExtractedAPICall = String
  type PackageSignature = String
  type MethodSignature = String
  type ParameterSignature = String
  type DeprecatedMethod = String
  type APIVerificationResult = String

  invariants exports_present {
    - true
  }
}
