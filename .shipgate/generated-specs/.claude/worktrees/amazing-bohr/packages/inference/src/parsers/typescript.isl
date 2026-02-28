# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: parseTypeScript, extractValidationsFromBody, TypeScriptParseResult, ParsedInterface, ParsedTypeAlias, ParsedEnum, ParsedProperty, ParsedFunction, ParsedParameter, ParsedClass, ParsedLocation, ParsedJSDoc, ValidationPattern
# dependencies: typescript, fs

domain Typescript {
  version: "1.0.0"

  type TypeScriptParseResult = String
  type ParsedInterface = String
  type ParsedTypeAlias = String
  type ParsedEnum = String
  type ParsedProperty = String
  type ParsedFunction = String
  type ParsedParameter = String
  type ParsedClass = String
  type ParsedLocation = String
  type ParsedJSDoc = String
  type ValidationPattern = String

  invariants exports_present {
    - true
  }
}
