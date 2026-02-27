# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: isValidOutput, SpecAssistConfig, ChatMessage, CompletionOptions, SpecAssistRequest, SpecAssistResponse, ValidationResult, ParseError, SemanticError, VerifyIssue, Diagnostic, AIOutputEnvelope, FeatureFlagConfig
# dependencies: 

domain Types {
  version: "1.0.0"

  type SpecAssistConfig = String
  type ChatMessage = String
  type CompletionOptions = String
  type SpecAssistRequest = String
  type SpecAssistResponse = String
  type ValidationResult = String
  type ParseError = String
  type SemanticError = String
  type VerifyIssue = String
  type Diagnostic = String
  type AIOutputEnvelope = String
  type FeatureFlagConfig = String

  invariants exports_present {
    - true
  }
}
