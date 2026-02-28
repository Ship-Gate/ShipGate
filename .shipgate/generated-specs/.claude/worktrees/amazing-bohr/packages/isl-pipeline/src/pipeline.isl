# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: createPipeline, runPipeline, PipelineInput, PipelineOptions, PipelineResult, ISLPipeline
# dependencies: @isl-lang/translator, @isl-lang/generator, @isl-lang/proof

domain Pipeline {
  version: "1.0.0"

  type PipelineInput = String
  type PipelineOptions = String
  type PipelineResult = String
  type ISLPipeline = String

  invariants exports_present {
    - true
  }
}
