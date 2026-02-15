# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: generateImplementation, generateAllImplementations, GenerationResult, GeneratorOptions, ImplementationGenerator
# dependencies: @anthropic-ai/sdk

domain ImplementationGenerator {
  version: "1.0.0"

  type GenerationResult = String
  type GeneratorOptions = String
  type ImplementationGenerator = String

  invariants exports_present {
    - true
  }
}
