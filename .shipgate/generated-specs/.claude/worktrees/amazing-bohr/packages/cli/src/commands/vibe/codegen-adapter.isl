# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: getCodegenAdapter, isValidLanguage, SUPPORTED_LANGUAGES, SupportedLanguage, CodegenAdapterOptions, AdapterGeneratedFile, QualityResult, ICodegenAdapter, PythonCodegenAdapter, RustCodegenAdapter, GoCodegenAdapter
# dependencies: 

domain CodegenAdapter {
  version: "1.0.0"

  type SupportedLanguage = String
  type CodegenAdapterOptions = String
  type AdapterGeneratedFile = String
  type QualityResult = String
  type ICodegenAdapter = String
  type PythonCodegenAdapter = String
  type RustCodegenAdapter = String
  type GoCodegenAdapter = String

  invariants exports_present {
    - true
  }
}
