# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: runMutations, createFileLoader, createVitestRunner, MutationRunner, TestRunnerFn, SourceLoaderFn, MutationProgress, MutationRunnerWithProgress
# dependencies: 

domain Runner {
  version: "1.0.0"

  type MutationRunner = String
  type TestRunnerFn = String
  type SourceLoaderFn = String
  type MutationProgress = String
  type MutationRunnerWithProgress = String

  invariants exports_present {
    - true
  }
}
