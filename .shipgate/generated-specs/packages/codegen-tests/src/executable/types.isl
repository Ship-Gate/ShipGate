# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: TargetLanguage, TestFramework, ExecutableTestOptions, ExecutableTestResult, ExecutableTestFile, TestGenerationError, TestBinding, TypeBinding, PostconditionBinding, PreconditionBinding, ErrorBinding, ContractAssertion, LanguageAdapter, CompilationContext, StateCaptureSpec
# dependencies: 

domain Types {
  version: "1.0.0"

  type TargetLanguage = String
  type TestFramework = String
  type ExecutableTestOptions = String
  type ExecutableTestResult = String
  type ExecutableTestFile = String
  type TestGenerationError = String
  type TestBinding = String
  type TypeBinding = String
  type PostconditionBinding = String
  type PreconditionBinding = String
  type ErrorBinding = String
  type ContractAssertion = String
  type LanguageAdapter = String
  type CompilationContext = String
  type StateCaptureSpec = String

  invariants exports_present {
    - true
  }
}
