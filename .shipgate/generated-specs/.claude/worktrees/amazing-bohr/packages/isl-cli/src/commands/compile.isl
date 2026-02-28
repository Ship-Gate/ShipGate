# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: compile, printCompileResult, CompileOptions, CompileResult
# dependencies: fs/promises, path, chalk, @isl-lang/isl-core, @isl-lang/isl-compiler

domain Compile {
  version: "1.0.0"

  type CompileOptions = String
  type CompileResult = String

  invariants exports_present {
    - true
  }
}
