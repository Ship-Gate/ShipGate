# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: createEvaluatorAdapter, createCompilerAdapter, createTypeCheckAdapter, defaultEvaluatorAdapter, defaultCompilerAdapter, defaultTypeCheckAdapter, EvaluatorAdapterOptions, EvaluatorAdapter, CompilerAdapterOptions, OperatorInfo, CompilerAdapter, TypeCheckAdapter
# dependencies: @isl-lang/semantics/adapter

domain Adapter {
  version: "1.0.0"

  type EvaluatorAdapterOptions = String
  type EvaluatorAdapter = String
  type CompilerAdapterOptions = String
  type OperatorInfo = String
  type CompilerAdapter = String
  type TypeCheckAdapter = String

  invariants exports_present {
    - true
  }
}
