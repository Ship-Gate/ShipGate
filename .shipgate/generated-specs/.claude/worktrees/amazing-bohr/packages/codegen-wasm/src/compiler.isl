# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: createCompiler, compileWAT, CompilerOptions, WASMFeatures, WASMCompiler, ValidationResult, ValidationError, ValidationWarning, SizeEstimate
# dependencies: 

domain Compiler {
  version: "1.0.0"

  type CompilerOptions = String
  type WASMFeatures = String
  type WASMCompiler = String
  type ValidationResult = String
  type ValidationError = String
  type ValidationWarning = String
  type SizeEstimate = String

  invariants exports_present {
    - true
  }
}
