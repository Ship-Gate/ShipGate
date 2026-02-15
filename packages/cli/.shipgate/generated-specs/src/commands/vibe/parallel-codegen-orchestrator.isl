# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: ParallelCodegenContext, ParallelCodegenOptions, CodegenStreamResult, ParallelCodegenResult, GeneratePrismaFn, GenerateSharedTypesFn, GenerateBackendFn, GenerateFrontendFn, GenerateTestsFn, ParallelCodegenOrchestrator
# dependencies: @isl-lang/coherence-engine

domain ParallelCodegenOrchestrator {
  version: "1.0.0"

  type ParallelCodegenContext = String
  type ParallelCodegenOptions = String
  type CodegenStreamResult = String
  type ParallelCodegenResult = String
  type GeneratePrismaFn = String
  type GenerateSharedTypesFn = String
  type GenerateBackendFn = String
  type GenerateFrontendFn = String
  type GenerateTestsFn = String
  type ParallelCodegenOrchestrator = String

  invariants exports_present {
    - true
  }
}
