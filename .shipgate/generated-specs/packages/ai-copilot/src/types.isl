# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: CopilotConfig, ConversationMessage, ConversationContext, ISLContext, CodeContext, GenerationRequest, GenerationOptions, GenerationResult, Suggestion, Warning, NLToISLRequest, Example, ISLToCodeRequest, CodeToISLRequest, ReviewRequest, ReviewResult, ReviewIssue, CompletionRequest, CompletionResult, Completion, ExplainRequest, RefactorRequest, TestGenerationRequest
# dependencies: 

domain Types {
  version: "1.0.0"

  type CopilotConfig = String
  type ConversationMessage = String
  type ConversationContext = String
  type ISLContext = String
  type CodeContext = String
  type GenerationRequest = String
  type GenerationOptions = String
  type GenerationResult = String
  type Suggestion = String
  type Warning = String
  type NLToISLRequest = String
  type Example = String
  type ISLToCodeRequest = String
  type CodeToISLRequest = String
  type ReviewRequest = String
  type ReviewResult = String
  type ReviewIssue = String
  type CompletionRequest = String
  type CompletionResult = String
  type Completion = String
  type ExplainRequest = String
  type RefactorRequest = String
  type TestGenerationRequest = String

  invariants exports_present {
    - true
  }
}
