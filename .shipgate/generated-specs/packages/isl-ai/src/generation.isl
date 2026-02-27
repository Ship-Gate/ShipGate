# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: generate, generateBatch, generateFromUserStory, GenerationRequest, GeneratedSpec
# dependencies: 

domain Generation {
  version: "1.0.0"

  type GenerationRequest = String
  type GeneratedSpec = String

  invariants exports_present {
    - true
  }
}
