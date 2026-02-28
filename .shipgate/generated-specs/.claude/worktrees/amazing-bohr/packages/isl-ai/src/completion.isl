# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: complete, CompletionContext, CompletionResult, CompletionOptions
# dependencies: 

domain Completion {
  version: "1.0.0"

  type CompletionContext = String
  type CompletionResult = String
  type CompletionOptions = String

  invariants exports_present {
    - true
  }
}
