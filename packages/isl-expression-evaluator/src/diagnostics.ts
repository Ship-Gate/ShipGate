// ============================================================================
// ISL Expression Evaluator - Diagnostics System
// ============================================================================
//
// Structured diagnostic format for evaluator failures with:
//   - Unique error codes (EVAL_*)
//   - Source span information
//   - Human-readable messages
//   - Actionable suggestions
//
// ============================================================================

import type { Expression, SourceLocation } from '@isl-lang/parser';

// ============================================================================
// DIAGNOSTIC CODES
// ============================================================================

/**
 * Evaluator-specific diagnostic codes
 * These map to the E0400-E0499 range in the unified error catalog
 */
export const EvaluatorDiagnosticCode = {
  // Operator errors (E0412-E0419)
  EVAL_UNSUPPORTED_OP: {
    code: 'E0412',
    id: 'EVAL_UNSUPPORTED_OP',
    title: 'Unsupported operator',
    messageTemplate: "Operator '{operator}' is not supported in evaluation",
  },
  EVAL_INVALID_OPERAND_TYPE: {
    code: 'E0413',
    id: 'EVAL_INVALID_OPERAND_TYPE',
    title: 'Invalid operand type',
    messageTemplate: "Cannot apply operator '{operator}' to {actualType} (expected {expectedType})",
  },
  
  // Identifier errors (E0420-E0429)
  EVAL_UNKNOWN_IDENTIFIER: {
    code: 'E0420',
    id: 'EVAL_UNKNOWN_IDENTIFIER',
    title: 'Unknown identifier',
    messageTemplate: "Identifier '{name}' is not defined in the current scope",
  },
  EVAL_UNKNOWN_ENTITY: {
    code: 'E0421',
    id: 'EVAL_UNKNOWN_ENTITY',
    title: 'Unknown entity type',
    messageTemplate: "Entity type '{name}' is not defined",
  },
  EVAL_UNKNOWN_FUNCTION: {
    code: 'E0422',
    id: 'EVAL_UNKNOWN_FUNCTION',
    title: 'Unknown function',
    messageTemplate: "Function '{name}' is not defined",
  },
  EVAL_UNKNOWN_METHOD: {
    code: 'E0423',
    id: 'EVAL_UNKNOWN_METHOD',
    title: 'Unknown method',
    messageTemplate: "Method '{method}' does not exist on type '{type}'",
  },
  EVAL_UNKNOWN_PROPERTY: {
    code: 'E0424',
    id: 'EVAL_UNKNOWN_PROPERTY',
    title: 'Unknown property',
    messageTemplate: "Property '{property}' does not exist on type '{type}'",
  },
  
  // Type errors (E0430-E0439)
  EVAL_TYPE_MISMATCH: {
    code: 'E0430',
    id: 'EVAL_TYPE_MISMATCH',
    title: 'Type mismatch',
    messageTemplate: "Expected {expected}, got {actual}",
  },
  EVAL_NOT_CALLABLE: {
    code: 'E0431',
    id: 'EVAL_NOT_CALLABLE',
    title: 'Not callable',
    messageTemplate: "Value of type '{type}' is not callable",
  },
  EVAL_NOT_INDEXABLE: {
    code: 'E0432',
    id: 'EVAL_NOT_INDEXABLE',
    title: 'Not indexable',
    messageTemplate: "Cannot index into value of type '{type}'",
  },
  EVAL_NOT_ITERABLE: {
    code: 'E0433',
    id: 'EVAL_NOT_ITERABLE',
    title: 'Not iterable',
    messageTemplate: "Value of type '{type}' is not iterable (quantifier requires array or collection)",
  },
  
  // Null/undefined errors (E0440-E0449)
  EVAL_NULL_ACCESS: {
    code: 'E0440',
    id: 'EVAL_NULL_ACCESS',
    title: 'Null access',
    messageTemplate: "Cannot access property '{property}' on null or undefined value",
  },
  EVAL_NULL_CALL: {
    code: 'E0441',
    id: 'EVAL_NULL_CALL',
    title: 'Null call',
    messageTemplate: "Cannot call method '{method}' on null or undefined value",
  },
  EVAL_NULL_INDEX: {
    code: 'E0442',
    id: 'EVAL_NULL_INDEX',
    title: 'Null index',
    messageTemplate: "Cannot index into null or undefined value",
  },
  
  // Context errors (E0450-E0459)
  EVAL_OLD_WITHOUT_SNAPSHOT: {
    code: 'E0450',
    id: 'EVAL_OLD_WITHOUT_SNAPSHOT',
    title: 'old() without snapshot',
    messageTemplate: "old() expression requires a previous state snapshot (only valid in postconditions)",
  },
  EVAL_RESULT_UNAVAILABLE: {
    code: 'E0451',
    id: 'EVAL_RESULT_UNAVAILABLE',
    title: 'Result unavailable',
    messageTemplate: "'result' is not available in this context (only valid in postconditions)",
  },
  EVAL_INPUT_MISSING: {
    code: 'E0452',
    id: 'EVAL_INPUT_MISSING',
    title: 'Input missing',
    messageTemplate: "Input field '{field}' is not provided",
  },
  
  // Runtime errors (E0460-E0469)
  EVAL_DIVISION_BY_ZERO: {
    code: 'E0460',
    id: 'EVAL_DIVISION_BY_ZERO',
    title: 'Division by zero',
    messageTemplate: "Cannot divide by zero",
  },
  EVAL_INDEX_OUT_OF_BOUNDS: {
    code: 'E0461',
    id: 'EVAL_INDEX_OUT_OF_BOUNDS',
    title: 'Index out of bounds',
    messageTemplate: "Index {index} is out of bounds for array of length {length}",
  },
  EVAL_MAX_DEPTH_EXCEEDED: {
    code: 'E0462',
    id: 'EVAL_MAX_DEPTH_EXCEEDED',
    title: 'Maximum depth exceeded',
    messageTemplate: "Maximum evaluation depth ({depth}) exceeded - possible infinite recursion",
  },
  
  // Quantifier errors (E0470-E0479)
  EVAL_UNKNOWN_QUANTIFIER: {
    code: 'E0470',
    id: 'EVAL_UNKNOWN_QUANTIFIER',
    title: 'Unknown quantifier',
    messageTemplate: "Unknown quantifier '{quantifier}' (expected: all, any, none, count, sum, filter)",
  },
  EVAL_QUANTIFIER_PREDICATE_ERROR: {
    code: 'E0471',
    id: 'EVAL_QUANTIFIER_PREDICATE_ERROR',
    title: 'Quantifier predicate error',
    messageTemplate: "Error evaluating quantifier predicate: {reason}",
  },
} as const;

export type EvaluatorDiagnosticCodeKey = keyof typeof EvaluatorDiagnosticCode;
export type EvaluatorDiagnosticCodeId = (typeof EvaluatorDiagnosticCode)[EvaluatorDiagnosticCodeKey]['id'];

// ============================================================================
// DIAGNOSTIC SPAN
// ============================================================================

/**
 * Source span for diagnostic location
 */
export interface DiagnosticSpan {
  /** Source file path */
  file: string;
  /** Starting line number (1-indexed) */
  line: number;
  /** Starting column number (1-indexed) */
  col: number;
  /** Length of the span in characters */
  len: number;
  /** Ending line number (for multi-line spans) */
  endLine?: number;
  /** Ending column number (for multi-line spans) */
  endCol?: number;
}

/**
 * Convert SourceLocation to DiagnosticSpan
 */
export function sourceLocationToSpan(location: SourceLocation): DiagnosticSpan {
  const len = location.endColumn - location.column;
  return {
    file: location.file,
    line: location.line,
    col: location.column,
    len: len > 0 ? len : 1,
    endLine: location.endLine !== location.line ? location.endLine : undefined,
    endCol: location.endLine !== location.line ? location.endColumn : undefined,
  };
}

// ============================================================================
// EVALUATOR DIAGNOSTIC
// ============================================================================

/**
 * Severity levels for diagnostics
 */
export type DiagnosticSeverity = 'error' | 'warning' | 'info' | 'hint';

/**
 * Structured diagnostic for evaluator failures
 */
export interface EvaluatorDiagnostic {
  /** Unique diagnostic code (e.g., EVAL_UNSUPPORTED_OP) */
  code: EvaluatorDiagnosticCodeId;
  
  /** Numeric error code from catalog (e.g., E0412) */
  catalogCode: string;
  
  /** Source span */
  span: DiagnosticSpan;
  
  /** Human-readable error message */
  message: string;
  
  /** Actionable suggestion to fix the error */
  suggestion?: string;
  
  /** Severity level */
  severity: DiagnosticSeverity;
  
  /** Related expression (for context) */
  expression?: Expression;
  
  /** Nested diagnostics (for compound expressions) */
  children?: EvaluatorDiagnostic[];
  
  /** Additional context values */
  context?: Record<string, unknown>;
}

// ============================================================================
// DIAGNOSTIC BUILDER
// ============================================================================

/**
 * Builder for creating evaluator diagnostics
 */
export class DiagnosticBuilder {
  private _code: EvaluatorDiagnosticCodeKey;
  private _span: DiagnosticSpan;
  private _values: Record<string, string | number> = {};
  private _suggestion?: string;
  private _severity: DiagnosticSeverity = 'error';
  private _expression?: Expression;
  private _children?: EvaluatorDiagnostic[];
  private _context?: Record<string, unknown>;

  constructor(code: EvaluatorDiagnosticCodeKey, location: SourceLocation | DiagnosticSpan) {
    this._code = code;
    this._span = 'file' in location && 'line' in location && 'col' in location
      ? location as DiagnosticSpan
      : sourceLocationToSpan(location as SourceLocation);
  }

  /**
   * Set template values for message formatting
   */
  values(vals: Record<string, string | number>): this {
    this._values = { ...this._values, ...vals };
    return this;
  }

  /**
   * Add an actionable suggestion
   */
  suggest(suggestion: string): this {
    this._suggestion = suggestion;
    return this;
  }

  /**
   * Set severity level
   */
  severity(sev: DiagnosticSeverity): this {
    this._severity = sev;
    return this;
  }

  /**
   * Attach the related expression
   */
  expression(expr: Expression): this {
    this._expression = expr;
    return this;
  }

  /**
   * Add child diagnostics
   */
  children(diags: EvaluatorDiagnostic[]): this {
    this._children = diags;
    return this;
  }

  /**
   * Add context values
   */
  context(ctx: Record<string, unknown>): this {
    this._context = { ...this._context, ...ctx };
    return this;
  }

  /**
   * Build the diagnostic
   */
  build(): EvaluatorDiagnostic {
    const codeDef = EvaluatorDiagnosticCode[this._code];
    const message = formatTemplate(codeDef.messageTemplate, this._values);

    return {
      code: codeDef.id,
      catalogCode: codeDef.code,
      span: this._span,
      message,
      suggestion: this._suggestion,
      severity: this._severity,
      expression: this._expression,
      children: this._children,
      context: this._context,
    };
  }
}

/**
 * Create a diagnostic builder
 */
export function diagnostic(
  code: EvaluatorDiagnosticCodeKey,
  location: SourceLocation | DiagnosticSpan
): DiagnosticBuilder {
  return new DiagnosticBuilder(code, location);
}

// ============================================================================
// QUICK DIAGNOSTIC FACTORIES
// ============================================================================

/**
 * Create an "unsupported operator" diagnostic
 */
export function unsupportedOperator(
  operator: string,
  location: SourceLocation,
  suggestion?: string
): EvaluatorDiagnostic {
  return diagnostic('EVAL_UNSUPPORTED_OP', location)
    .values({ operator })
    .suggest(suggestion ?? `Check the ISL documentation for supported operators`)
    .build();
}

/**
 * Create an "unknown identifier" diagnostic
 */
export function unknownIdentifier(
  name: string,
  location: SourceLocation,
  suggestions?: string[]
): EvaluatorDiagnostic {
  const suggestion = suggestions && suggestions.length > 0
    ? `Did you mean: ${suggestions.slice(0, 3).join(', ')}?`
    : `Make sure the variable is declared before use`;
  
  return diagnostic('EVAL_UNKNOWN_IDENTIFIER', location)
    .values({ name })
    .suggest(suggestion)
    .context({ availableSuggestions: suggestions })
    .build();
}

/**
 * Create a "type mismatch" diagnostic
 */
export function typeMismatch(
  expected: string,
  actual: string,
  location: SourceLocation,
  suggestion?: string
): EvaluatorDiagnostic {
  return diagnostic('EVAL_TYPE_MISMATCH', location)
    .values({ expected, actual })
    .suggest(suggestion ?? `Ensure the expression evaluates to ${expected}`)
    .build();
}

/**
 * Create a "null access" diagnostic
 */
export function nullAccess(
  property: string,
  location: SourceLocation
): EvaluatorDiagnostic {
  return diagnostic('EVAL_NULL_ACCESS', location)
    .values({ property })
    .suggest(`Use optional chaining (?.) or add a null check before accessing '${property}'`)
    .build();
}

/**
 * Create an "old() without snapshot" diagnostic
 */
export function oldWithoutSnapshot(
  location: SourceLocation
): EvaluatorDiagnostic {
  return diagnostic('EVAL_OLD_WITHOUT_SNAPSHOT', location)
    .suggest(`old() can only be used in postconditions where a state snapshot is available`)
    .build();
}

/**
 * Create a "max depth exceeded" diagnostic
 */
export function maxDepthExceeded(
  depth: number,
  location: SourceLocation
): EvaluatorDiagnostic {
  return diagnostic('EVAL_MAX_DEPTH_EXCEEDED', location)
    .values({ depth })
    .suggest(`Check for circular references or infinite recursion in your expressions`)
    .severity('error')
    .build();
}

/**
 * Create an "unknown method" diagnostic
 */
export function unknownMethod(
  method: string,
  type: string,
  location: SourceLocation,
  availableMethods?: string[]
): EvaluatorDiagnostic {
  const suggestion = availableMethods && availableMethods.length > 0
    ? `Available methods on ${type}: ${availableMethods.join(', ')}`
    : `Check that '${method}' is a valid method for type '${type}'`;
  
  return diagnostic('EVAL_UNKNOWN_METHOD', location)
    .values({ method, type })
    .suggest(suggestion)
    .context({ availableMethods })
    .build();
}

/**
 * Create an "unknown property" diagnostic
 */
export function unknownProperty(
  property: string,
  type: string,
  location: SourceLocation,
  availableProperties?: string[]
): EvaluatorDiagnostic {
  const suggestion = availableProperties && availableProperties.length > 0
    ? `Available properties on ${type}: ${availableProperties.join(', ')}`
    : `Check that '${property}' is a valid field on type '${type}'`;
  
  return diagnostic('EVAL_UNKNOWN_PROPERTY', location)
    .values({ property, type })
    .suggest(suggestion)
    .context({ availableProperties })
    .build();
}

/**
 * Create a "not iterable" diagnostic for quantifier errors
 */
export function notIterable(
  type: string,
  location: SourceLocation
): EvaluatorDiagnostic {
  return diagnostic('EVAL_NOT_ITERABLE', location)
    .values({ type })
    .suggest(`Quantifiers (all, any, etc.) require an array or entity collection`)
    .build();
}

/**
 * Create an "index out of bounds" diagnostic
 */
export function indexOutOfBounds(
  index: number,
  length: number,
  location: SourceLocation
): EvaluatorDiagnostic {
  return diagnostic('EVAL_INDEX_OUT_OF_BOUNDS', location)
    .values({ index, length })
    .suggest(`Array has ${length} element(s), valid indices are 0 to ${length - 1}`)
    .build();
}

/**
 * Create a "division by zero" diagnostic
 */
export function divisionByZero(
  location: SourceLocation
): EvaluatorDiagnostic {
  return diagnostic('EVAL_DIVISION_BY_ZERO', location)
    .suggest(`Add a precondition to ensure the divisor is non-zero`)
    .build();
}

// ============================================================================
// UTILITIES
// ============================================================================

/**
 * Format a template string with values
 */
function formatTemplate(
  template: string,
  values: Record<string, string | number>
): string {
  let result = template;
  for (const [key, value] of Object.entries(values)) {
    result = result.replace(`{${key}}`, String(value));
  }
  return result;
}

/**
 * Get all diagnostic codes
 */
export function getAllDiagnosticCodes(): typeof EvaluatorDiagnosticCode {
  return EvaluatorDiagnosticCode;
}

/**
 * Get diagnostic code by ID
 */
export function getDiagnosticCode(
  id: EvaluatorDiagnosticCodeId
): (typeof EvaluatorDiagnosticCode)[EvaluatorDiagnosticCodeKey] | undefined {
  return Object.values(EvaluatorDiagnosticCode).find(c => c.id === id);
}

/**
 * Get diagnostic code by catalog code (E0xxx)
 */
export function getDiagnosticByCatalogCode(
  catalogCode: string
): (typeof EvaluatorDiagnosticCode)[EvaluatorDiagnosticCodeKey] | undefined {
  return Object.values(EvaluatorDiagnosticCode).find(c => c.code === catalogCode);
}
