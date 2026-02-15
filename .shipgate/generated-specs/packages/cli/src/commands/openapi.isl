# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: openapiGenerate, openapiValidate, printOpenAPIGenerateResult, printOpenAPIValidateResult, getOpenAPIGenerateExitCode, getOpenAPIValidateExitCode, OpenAPIGenerateOptions, OpenAPIGenerateResult, OpenAPIValidateOptions, OpenAPIValidateResult
# dependencies: fs/promises, path, chalk, ora, @isl-lang/parser, @isl-lang/codegen-openapi

domain Openapi {
  version: "1.0.0"

  type OpenAPIGenerateOptions = String
  type OpenAPIGenerateResult = String
  type OpenAPIValidateOptions = String
  type OpenAPIValidateResult = String

  invariants exports_present {
    - true
  }
}
