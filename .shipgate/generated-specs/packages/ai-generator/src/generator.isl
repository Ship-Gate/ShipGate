# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: createAnthropicGenerator, createOpenAIGenerator, createGenerator, isModelSupported, getSupportedModels, GeneratorOptions, GenerationResult, GenerationMetadata, GeneratorError, Generator
# dependencies: 

domain Generator {
  version: "1.0.0"

  type GeneratorOptions = String
  type GenerationResult = String
  type GenerationMetadata = String
  type GeneratorError = String
  type Generator = String

  invariants exports_present {
    - true
  }
}
