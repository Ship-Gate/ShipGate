# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: getErrorDef, getErrorsByCategory, formatErrorMessage, LEXER_ERRORS, PARSER_ERRORS, TYPE_ERRORS, SEMANTIC_ERRORS, EVAL_ERRORS, VERIFY_ERRORS, CONFIG_ERRORS, IO_ERRORS, ERROR_CODES, ErrorCodeDef, ErrorCodeKey, ErrorCode
# dependencies: 

domain Codes {
  version: "1.0.0"

  type ErrorCodeDef = String
  type ErrorCodeKey = String
  type ErrorCode = String

  invariants exports_present {
    - true
  }
}
