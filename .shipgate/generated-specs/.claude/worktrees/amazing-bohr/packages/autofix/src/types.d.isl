# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: generateWithClaude, ChatCompletionMessage, ChatCompletionChoice, ChatCompletionResponse, ChatCompletionsCreateOptions, ChatCompletions, OpenAIClient
# dependencies: 

domain TypesD {
  version: "1.0.0"

  type ChatCompletionMessage = String
  type ChatCompletionChoice = String
  type ChatCompletionResponse = String
  type ChatCompletionsCreateOptions = String
  type ChatCompletions = String
  type OpenAIClient = String

  invariants exports_present {
    - true
  }
}
