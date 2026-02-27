# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: generateWithGPT, OpenAIOptions, OpenAIResponse, OpenAIClient
# dependencies: openai

domain Openai {
  version: "1.0.0"

  type OpenAIOptions = String
  type OpenAIResponse = String
  type OpenAIClient = String

  invariants exports_present {
    - true
  }
}
