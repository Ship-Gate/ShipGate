# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: verifyAuthoritative, formatVerificationResult, AuthoritativeVerifyResult, AuthoritativePropertyResult, VerificationSummary, PropertyCategory, AuthoritativeVerifyOptions
# dependencies: 

domain AuthoritativeTranslator {
  version: "1.0.0"

  type AuthoritativeVerifyResult = String
  type AuthoritativePropertyResult = String
  type VerificationSummary = String
  type PropertyCategory = String
  type AuthoritativeVerifyOptions = String

  invariants exports_present {
    - true
  }
}
