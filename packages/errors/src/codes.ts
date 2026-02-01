// ============================================================================
// ISL Unified Error Code Catalog
// ============================================================================
// 
// Error Code Ranges:
//   E0001-E0099: Lexer errors (tokenization)
//   E0100-E0199: Parser errors (syntax)
//   E0200-E0299: Type errors (type checking)
//   E0300-E0399: Semantic errors (name resolution, scoping)
//   E0400-E0499: Evaluation errors (runtime)
//   E0500-E0599: Verification errors (pre/post conditions)
//   E0600-E0699: Configuration errors
//   E0700-E0799: I/O errors
//   E0800-E0899: LSP/IDE errors
//   E0900-E0999: Reserved for future use
//
// ============================================================================

import type { ErrorCategory, ErrorExplanation } from './types.js';

/**
 * Error code definition
 */
export interface ErrorCodeDef {
  code: string;
  category: ErrorCategory;
  title: string;
  messageTemplate: string;
}

// ============================================================================
// LEXER ERRORS (E0001-E0099)
// ============================================================================

export const LEXER_ERRORS = {
  UNEXPECTED_CHARACTER: {
    code: 'E0001',
    category: 'lexer' as ErrorCategory,
    title: 'Unexpected character',
    messageTemplate: "Unexpected character '{char}'",
  },
  UNTERMINATED_STRING: {
    code: 'E0002',
    category: 'lexer' as ErrorCategory,
    title: 'Unterminated string literal',
    messageTemplate: 'Unterminated string literal',
  },
  UNTERMINATED_REGEX: {
    code: 'E0003',
    category: 'lexer' as ErrorCategory,
    title: 'Unterminated regular expression',
    messageTemplate: 'Unterminated regular expression',
  },
  INVALID_ESCAPE: {
    code: 'E0004',
    category: 'lexer' as ErrorCategory,
    title: 'Invalid escape sequence',
    messageTemplate: "Invalid escape sequence '\\{char}'",
  },
  INVALID_NUMBER: {
    code: 'E0005',
    category: 'lexer' as ErrorCategory,
    title: 'Invalid number literal',
    messageTemplate: "Invalid number literal '{value}'",
  },
  UNTERMINATED_COMMENT: {
    code: 'E0006',
    category: 'lexer' as ErrorCategory,
    title: 'Unterminated block comment',
    messageTemplate: 'Unterminated block comment',
  },
  INVALID_UNICODE: {
    code: 'E0007',
    category: 'lexer' as ErrorCategory,
    title: 'Invalid Unicode escape',
    messageTemplate: "Invalid Unicode escape sequence '\\u{value}'",
  },
} as const;

// ============================================================================
// PARSER ERRORS (E0100-E0199)
// ============================================================================

export const PARSER_ERRORS = {
  UNEXPECTED_TOKEN: {
    code: 'E0100',
    category: 'parser' as ErrorCategory,
    title: 'Unexpected token',
    messageTemplate: "Unexpected token '{token}'",
  },
  EXPECTED_TOKEN: {
    code: 'E0101',
    category: 'parser' as ErrorCategory,
    title: 'Expected token',
    messageTemplate: "Expected {expected}, got '{got}'",
  },
  EXPECTED_IDENTIFIER: {
    code: 'E0102',
    category: 'parser' as ErrorCategory,
    title: 'Expected identifier',
    messageTemplate: "Expected identifier, got '{got}'",
  },
  EXPECTED_TYPE: {
    code: 'E0103',
    category: 'parser' as ErrorCategory,
    title: 'Expected type annotation',
    messageTemplate: 'Expected type annotation',
  },
  EXPECTED_EXPRESSION: {
    code: 'E0104',
    category: 'parser' as ErrorCategory,
    title: 'Expected expression',
    messageTemplate: 'Expected expression',
  },
  MISSING_CLOSING_BRACE: {
    code: 'E0105',
    category: 'parser' as ErrorCategory,
    title: 'Missing closing brace',
    messageTemplate: "Expected '}' to close block",
  },
  MISSING_CLOSING_PAREN: {
    code: 'E0106',
    category: 'parser' as ErrorCategory,
    title: 'Missing closing parenthesis',
    messageTemplate: "Expected ')' to close group",
  },
  MISSING_CLOSING_BRACKET: {
    code: 'E0107',
    category: 'parser' as ErrorCategory,
    title: 'Missing closing bracket',
    messageTemplate: "Expected ']' to close list",
  },
  DUPLICATE_FIELD: {
    code: 'E0108',
    category: 'parser' as ErrorCategory,
    title: 'Duplicate field',
    messageTemplate: "Duplicate field '{name}'",
  },
  DUPLICATE_ENTITY: {
    code: 'E0109',
    category: 'parser' as ErrorCategory,
    title: 'Duplicate entity',
    messageTemplate: "Entity '{name}' is already defined",
  },
  DUPLICATE_BEHAVIOR: {
    code: 'E0110',
    category: 'parser' as ErrorCategory,
    title: 'Duplicate behavior',
    messageTemplate: "Behavior '{name}' is already defined",
  },
  DUPLICATE_TYPE: {
    code: 'E0111',
    category: 'parser' as ErrorCategory,
    title: 'Duplicate type',
    messageTemplate: "Type '{name}' is already defined",
  },
  MISSING_VERSION: {
    code: 'E0112',
    category: 'parser' as ErrorCategory,
    title: 'Missing version',
    messageTemplate: "Domain is missing required 'version' field",
  },
  INVALID_CONSTRAINT: {
    code: 'E0113',
    category: 'parser' as ErrorCategory,
    title: 'Invalid constraint',
    messageTemplate: "Invalid constraint '{constraint}'",
  },
  INVALID_ANNOTATION: {
    code: 'E0114',
    category: 'parser' as ErrorCategory,
    title: 'Invalid annotation',
    messageTemplate: "Invalid annotation '@{name}'",
  },
  INVALID_LIFECYCLE: {
    code: 'E0115',
    category: 'parser' as ErrorCategory,
    title: 'Invalid lifecycle definition',
    messageTemplate: 'Invalid lifecycle definition',
  },
  EXPECTED_STATEMENT: {
    code: 'E0116',
    category: 'parser' as ErrorCategory,
    title: 'Expected statement',
    messageTemplate: 'Expected statement',
  },
  INVALID_OPERATOR: {
    code: 'E0117',
    category: 'parser' as ErrorCategory,
    title: 'Invalid operator',
    messageTemplate: "Invalid operator '{op}'",
  },
  UNCLOSED_BLOCK: {
    code: 'E0118',
    category: 'parser' as ErrorCategory,
    title: 'Unclosed block',
    messageTemplate: "Unclosed {kind} block",
  },
  UNEXPECTED_KEYWORD: {
    code: 'E0119',
    category: 'parser' as ErrorCategory,
    title: 'Unexpected keyword',
    messageTemplate: "Unexpected keyword '{keyword}' in this context",
  },
  INVALID_DOMAIN_STRUCTURE: {
    code: 'E0120',
    category: 'parser' as ErrorCategory,
    title: 'Invalid domain structure',
    messageTemplate: 'Invalid domain structure',
  },
} as const;

// ============================================================================
// TYPE ERRORS (E0200-E0299)
// ============================================================================

export const TYPE_ERRORS = {
  TYPE_MISMATCH: {
    code: 'E0200',
    category: 'type' as ErrorCategory,
    title: 'Type mismatch',
    messageTemplate: "Type mismatch: expected '{expected}', got '{actual}'",
  },
  UNDEFINED_TYPE: {
    code: 'E0201',
    category: 'type' as ErrorCategory,
    title: 'Undefined type',
    messageTemplate: "Type '{name}' is not defined",
  },
  UNDEFINED_FIELD: {
    code: 'E0202',
    category: 'type' as ErrorCategory,
    title: 'Undefined field',
    messageTemplate: "Field '{field}' does not exist on type '{type}'",
  },
  INCOMPATIBLE_TYPES: {
    code: 'E0203',
    category: 'type' as ErrorCategory,
    title: 'Incompatible types',
    messageTemplate: "Cannot apply operator '{op}' to types '{left}' and '{right}'",
  },
  INVALID_OPERATOR_FOR_TYPE: {
    code: 'E0204',
    category: 'type' as ErrorCategory,
    title: 'Invalid operator for type',
    messageTemplate: "Operator '{op}' cannot be applied to type '{type}'",
  },
  WRONG_NUMBER_OF_ARGUMENTS: {
    code: 'E0205',
    category: 'type' as ErrorCategory,
    title: 'Wrong number of arguments',
    messageTemplate: "Expected {expected} argument(s), got {actual}",
  },
  INVALID_ARGUMENT_TYPE: {
    code: 'E0206',
    category: 'type' as ErrorCategory,
    title: 'Invalid argument type',
    messageTemplate: "Argument {index}: expected '{expected}', got '{actual}'",
  },
  CIRCULAR_TYPE_REFERENCE: {
    code: 'E0207',
    category: 'type' as ErrorCategory,
    title: 'Circular type reference',
    messageTemplate: "Circular type reference: {cycle}",
  },
  INVALID_GENERIC_ARGUMENT: {
    code: 'E0208',
    category: 'type' as ErrorCategory,
    title: 'Invalid generic argument',
    messageTemplate: "Invalid generic argument for '{type}'",
  },
  MISSING_GENERIC_ARGUMENT: {
    code: 'E0209',
    category: 'type' as ErrorCategory,
    title: 'Missing generic argument',
    messageTemplate: "Type '{type}' requires {count} generic argument(s)",
  },
  INCOMPATIBLE_COMPARISON: {
    code: 'E0210',
    category: 'type' as ErrorCategory,
    title: 'Incompatible comparison',
    messageTemplate: "Cannot compare '{left}' with '{right}'",
  },
  NOT_CALLABLE: {
    code: 'E0211',
    category: 'type' as ErrorCategory,
    title: 'Not callable',
    messageTemplate: "Type '{type}' is not callable",
  },
  NOT_INDEXABLE: {
    code: 'E0212',
    category: 'type' as ErrorCategory,
    title: 'Not indexable',
    messageTemplate: "Type '{type}' is not indexable",
  },
  INVALID_RETURN_TYPE: {
    code: 'E0213',
    category: 'type' as ErrorCategory,
    title: 'Invalid return type',
    messageTemplate: "Return type mismatch: expected '{expected}', got '{actual}'",
  },
  NULLABLE_ACCESS: {
    code: 'E0214',
    category: 'type' as ErrorCategory,
    title: 'Nullable access',
    messageTemplate: "Value may be null. Use optional chaining (?.) or null check",
  },
} as const;

// ============================================================================
// SEMANTIC ERRORS (E0300-E0399)
// ============================================================================

export const SEMANTIC_ERRORS = {
  UNDEFINED_VARIABLE: {
    code: 'E0300',
    category: 'semantic' as ErrorCategory,
    title: 'Undefined variable',
    messageTemplate: "Variable '{name}' is not defined",
  },
  UNDEFINED_ENTITY: {
    code: 'E0301',
    category: 'semantic' as ErrorCategory,
    title: 'Undefined entity',
    messageTemplate: "Entity '{name}' is not defined",
  },
  UNDEFINED_BEHAVIOR: {
    code: 'E0302',
    category: 'semantic' as ErrorCategory,
    title: 'Undefined behavior',
    messageTemplate: "Behavior '{name}' is not defined",
  },
  UNDEFINED_ENUM_VARIANT: {
    code: 'E0303',
    category: 'semantic' as ErrorCategory,
    title: 'Undefined enum variant',
    messageTemplate: "Enum '{enum}' does not have variant '{variant}'",
  },
  OLD_OUTSIDE_POSTCONDITION: {
    code: 'E0304',
    category: 'semantic' as ErrorCategory,
    title: 'old() outside postcondition',
    messageTemplate: "'old()' can only be used in postconditions",
  },
  RESULT_OUTSIDE_POSTCONDITION: {
    code: 'E0305',
    category: 'semantic' as ErrorCategory,
    title: 'result outside postcondition',
    messageTemplate: "'result' can only be used in postconditions",
  },
  INPUT_INVALID_FIELD: {
    code: 'E0306',
    category: 'semantic' as ErrorCategory,
    title: 'Invalid input field',
    messageTemplate: "Input field '{field}' is not defined in behavior '{behavior}'",
  },
  INVALID_LIFECYCLE_STATE: {
    code: 'E0307',
    category: 'semantic' as ErrorCategory,
    title: 'Invalid lifecycle state',
    messageTemplate: "'{state}' is not a valid lifecycle state for entity '{entity}'",
  },
  INVALID_LIFECYCLE_TRANSITION: {
    code: 'E0308',
    category: 'semantic' as ErrorCategory,
    title: 'Invalid lifecycle transition',
    messageTemplate: "Cannot transition from '{from}' to '{to}' for entity '{entity}'",
  },
  DUPLICATE_DEFINITION: {
    code: 'E0309',
    category: 'semantic' as ErrorCategory,
    title: 'Duplicate definition',
    messageTemplate: "{kind} '{name}' is already defined",
  },
  SHADOWED_VARIABLE: {
    code: 'E0310',
    category: 'semantic' as ErrorCategory,
    title: 'Shadowed variable',
    messageTemplate: "Variable '{name}' shadows a variable in outer scope",
  },
  UNUSED_VARIABLE: {
    code: 'E0311',
    category: 'semantic' as ErrorCategory,
    title: 'Unused variable',
    messageTemplate: "Variable '{name}' is declared but never used",
  },
  UNUSED_ENTITY: {
    code: 'E0312',
    category: 'semantic' as ErrorCategory,
    title: 'Unused entity',
    messageTemplate: "Entity '{name}' is declared but never used",
  },
  MISSING_REQUIRED_FIELD: {
    code: 'E0313',
    category: 'semantic' as ErrorCategory,
    title: 'Missing required field',
    messageTemplate: "Required field '{field}' is missing from '{type}'",
  },
  INVALID_CONSTRAINT_VALUE: {
    code: 'E0314',
    category: 'semantic' as ErrorCategory,
    title: 'Invalid constraint value',
    messageTemplate: "Constraint '{constraint}' expects type '{expected}'",
  },
  INVALID_REFERENCE: {
    code: 'E0315',
    category: 'semantic' as ErrorCategory,
    title: 'Invalid reference',
    messageTemplate: "Cannot reference '{name}' in this context",
  },
} as const;

// ============================================================================
// EVALUATION ERRORS (E0400-E0499)
// ============================================================================

export const EVAL_ERRORS = {
  DIVISION_BY_ZERO: {
    code: 'E0400',
    category: 'eval' as ErrorCategory,
    title: 'Division by zero',
    messageTemplate: 'Division by zero',
  },
  NULL_REFERENCE: {
    code: 'E0401',
    category: 'eval' as ErrorCategory,
    title: 'Null reference',
    messageTemplate: "Cannot read property '{property}' of null",
  },
  INDEX_OUT_OF_BOUNDS: {
    code: 'E0402',
    category: 'eval' as ErrorCategory,
    title: 'Index out of bounds',
    messageTemplate: "Index {index} is out of bounds for array of length {length}",
  },
  UNDEFINED_PROPERTY: {
    code: 'E0403',
    category: 'eval' as ErrorCategory,
    title: 'Undefined property',
    messageTemplate: "Property '{property}' is undefined",
  },
  INVALID_OPERATION: {
    code: 'E0404',
    category: 'eval' as ErrorCategory,
    title: 'Invalid operation',
    messageTemplate: "{operation}",
  },
  STACK_OVERFLOW: {
    code: 'E0405',
    category: 'eval' as ErrorCategory,
    title: 'Stack overflow',
    messageTemplate: 'Maximum call stack exceeded (possible infinite recursion)',
  },
  TIMEOUT: {
    code: 'E0406',
    category: 'eval' as ErrorCategory,
    title: 'Evaluation timeout',
    messageTemplate: 'Evaluation exceeded maximum time limit of {limit}ms',
  },
  MEMORY_LIMIT: {
    code: 'E0407',
    category: 'eval' as ErrorCategory,
    title: 'Memory limit exceeded',
    messageTemplate: 'Evaluation exceeded memory limit',
  },
  TYPE_COERCION_FAILED: {
    code: 'E0408',
    category: 'eval' as ErrorCategory,
    title: 'Type coercion failed',
    messageTemplate: "Cannot coerce '{actual}' to '{expected}'",
  },
  INVALID_REGEX: {
    code: 'E0409',
    category: 'eval' as ErrorCategory,
    title: 'Invalid regular expression',
    messageTemplate: "Invalid regular expression: {reason}",
  },
  ENTITY_NOT_FOUND: {
    code: 'E0410',
    category: 'eval' as ErrorCategory,
    title: 'Entity not found',
    messageTemplate: "Entity '{entity}' with id '{id}' not found",
  },
  IMMUTABLE_MODIFICATION: {
    code: 'E0411',
    category: 'eval' as ErrorCategory,
    title: 'Immutable modification',
    messageTemplate: "Cannot modify immutable value '{name}'",
  },
} as const;

// ============================================================================
// VERIFICATION ERRORS (E0500-E0599)
// ============================================================================

export const VERIFY_ERRORS = {
  PRECONDITION_FAILED: {
    code: 'E0500',
    category: 'verify' as ErrorCategory,
    title: 'Precondition failed',
    messageTemplate: "Precondition failed: {condition}",
  },
  POSTCONDITION_FAILED: {
    code: 'E0501',
    category: 'verify' as ErrorCategory,
    title: 'Postcondition failed',
    messageTemplate: "Postcondition failed: {condition}",
  },
  INVARIANT_VIOLATED: {
    code: 'E0502',
    category: 'verify' as ErrorCategory,
    title: 'Invariant violated',
    messageTemplate: "Invariant violated: {invariant}",
  },
  ASSERTION_FAILED: {
    code: 'E0503',
    category: 'verify' as ErrorCategory,
    title: 'Assertion failed',
    messageTemplate: "Assertion failed: {assertion}",
  },
  CONSTRAINT_VIOLATED: {
    code: 'E0504',
    category: 'verify' as ErrorCategory,
    title: 'Constraint violated',
    messageTemplate: "Constraint '{constraint}' violated: {reason}",
  },
  TEMPORAL_VIOLATION: {
    code: 'E0505',
    category: 'verify' as ErrorCategory,
    title: 'Temporal constraint violation',
    messageTemplate: "Temporal constraint violated: {constraint}",
  },
  SECURITY_POLICY_VIOLATED: {
    code: 'E0506',
    category: 'verify' as ErrorCategory,
    title: 'Security policy violation',
    messageTemplate: "Security policy violated: {policy}",
  },
  STATE_INVARIANT_VIOLATED: {
    code: 'E0507',
    category: 'verify' as ErrorCategory,
    title: 'State invariant violated',
    messageTemplate: "State invariant violated for entity '{entity}': {invariant}",
  },
} as const;

// ============================================================================
// CONFIGURATION ERRORS (E0600-E0699)
// ============================================================================

export const CONFIG_ERRORS = {
  INVALID_CONFIG_FILE: {
    code: 'E0600',
    category: 'config' as ErrorCategory,
    title: 'Invalid configuration file',
    messageTemplate: "Invalid configuration file: {reason}",
  },
  MISSING_CONFIG: {
    code: 'E0601',
    category: 'config' as ErrorCategory,
    title: 'Missing configuration',
    messageTemplate: "Missing required configuration: {name}",
  },
  INVALID_CONFIG_VALUE: {
    code: 'E0602',
    category: 'config' as ErrorCategory,
    title: 'Invalid configuration value',
    messageTemplate: "Invalid value for '{key}': {reason}",
  },
  CONFLICTING_CONFIG: {
    code: 'E0603',
    category: 'config' as ErrorCategory,
    title: 'Conflicting configuration',
    messageTemplate: "Configuration conflict: '{key1}' and '{key2}' cannot both be set",
  },
  DEPRECATED_CONFIG: {
    code: 'E0604',
    category: 'config' as ErrorCategory,
    title: 'Deprecated configuration',
    messageTemplate: "Configuration '{key}' is deprecated. Use '{replacement}' instead",
  },
} as const;

// ============================================================================
// I/O ERRORS (E0700-E0799)
// ============================================================================

export const IO_ERRORS = {
  FILE_NOT_FOUND: {
    code: 'E0700',
    category: 'io' as ErrorCategory,
    title: 'File not found',
    messageTemplate: "File not found: {path}",
  },
  FILE_READ_ERROR: {
    code: 'E0701',
    category: 'io' as ErrorCategory,
    title: 'File read error',
    messageTemplate: "Failed to read file '{path}': {reason}",
  },
  FILE_WRITE_ERROR: {
    code: 'E0702',
    category: 'io' as ErrorCategory,
    title: 'File write error',
    messageTemplate: "Failed to write file '{path}': {reason}",
  },
  PERMISSION_DENIED: {
    code: 'E0703',
    category: 'io' as ErrorCategory,
    title: 'Permission denied',
    messageTemplate: "Permission denied: {path}",
  },
  INVALID_PATH: {
    code: 'E0704',
    category: 'io' as ErrorCategory,
    title: 'Invalid path',
    messageTemplate: "Invalid path: {path}",
  },
  IMPORT_NOT_FOUND: {
    code: 'E0705',
    category: 'io' as ErrorCategory,
    title: 'Import not found',
    messageTemplate: "Cannot find module '{module}'",
  },
  CIRCULAR_IMPORT: {
    code: 'E0706',
    category: 'io' as ErrorCategory,
    title: 'Circular import',
    messageTemplate: "Circular import detected: {cycle}",
  },
} as const;

// ============================================================================
// ALL ERROR CODES
// ============================================================================

export const ERROR_CODES = {
  ...LEXER_ERRORS,
  ...PARSER_ERRORS,
  ...TYPE_ERRORS,
  ...SEMANTIC_ERRORS,
  ...EVAL_ERRORS,
  ...VERIFY_ERRORS,
  ...CONFIG_ERRORS,
  ...IO_ERRORS,
} as const;

export type ErrorCodeKey = keyof typeof ERROR_CODES;
export type ErrorCode = (typeof ERROR_CODES)[ErrorCodeKey]['code'];

/**
 * Get error code definition by code string
 */
export function getErrorDef(code: string): ErrorCodeDef | undefined {
  for (const def of Object.values(ERROR_CODES)) {
    if (def.code === code) {
      return def;
    }
  }
  return undefined;
}

/**
 * Get all error codes in a category
 */
export function getErrorsByCategory(category: ErrorCategory): ErrorCodeDef[] {
  return Object.values(ERROR_CODES).filter(def => def.category === category);
}

/**
 * Format an error message using a template and values
 */
export function formatErrorMessage(
  template: string,
  values: Record<string, string | number>
): string {
  let message = template;
  for (const [key, value] of Object.entries(values)) {
    message = message.replace(`{${key}}`, String(value));
  }
  return message;
}
