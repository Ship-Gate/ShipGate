# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: createSampler, createDeterministicSampler, createAdaptiveSampler, SamplerOptions, Sampler
# dependencies: 

domain Sampler {
  version: "1.0.0"

  type SamplerOptions = String
  type Sampler = String

  invariants exports_present {
    - true
  }
}
