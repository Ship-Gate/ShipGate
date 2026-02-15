# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: parsePython, extractValidationsFromPython, PythonParseResult, ParsedPythonClass, ParsedDataclass, ParsedDataclassField, ParsedPythonFunction, ParsedPythonParameter, ParsedPythonAttribute, ParsedPythonEnum, ParsedPythonTypeAlias, ParsedPythonLocation, PythonValidationPattern
# dependencies: fs

domain Python {
  version: "1.0.0"

  type PythonParseResult = String
  type ParsedPythonClass = String
  type ParsedDataclass = String
  type ParsedDataclassField = String
  type ParsedPythonFunction = String
  type ParsedPythonParameter = String
  type ParsedPythonAttribute = String
  type ParsedPythonEnum = String
  type ParsedPythonTypeAlias = String
  type ParsedPythonLocation = String
  type PythonValidationPattern = String

  invariants exports_present {
    - true
  }
}
