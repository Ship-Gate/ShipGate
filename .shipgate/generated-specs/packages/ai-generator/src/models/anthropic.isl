# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: generateWithClaude, AnthropicOptions, AnthropicResponse, AnthropicClient
# dependencies: @anthropic-ai/sdk

domain Anthropic {
  version: "1.0.0"

  type AnthropicOptions = String
  type AnthropicResponse = String
  type AnthropicClient = String

  invariants exports_present {
    - true
  }
}
