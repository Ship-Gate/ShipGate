// ============================================================================
// @isl-lang/errors - Unified Error Infrastructure for ISL
// ============================================================================
//
// Best-in-class error messages for the ISL toolchain.
//
// Features:
//   - Unified error codes (E0001-E0999)
//   - Beautiful formatting with code snippets
//   - "Did you mean?" suggestions using Levenshtein distance
//   - Detailed explanations via `isl explain <code>`
//   - Works with and without colors (CI-friendly)
//
// Inspired by: Elm, Rust, and Deno error messages
//
// ============================================================================

// Types
export type {
  SourceLocation,
  Position,
  DiagnosticSeverity,
  RelatedInformation,
  CodeFix,
  TextEdit,
  ErrorCategory,
  Diagnostic,
  DiagnosticTag,
  ErrorExplanation,
  SourceFile,
  FormatOptions,
  DiagnosticResult,
} from './types.js';

export { DEFAULT_FORMAT_OPTIONS } from './types.js';

// Error codes
export {
  LEXER_ERRORS,
  PARSER_ERRORS,
  TYPE_ERRORS,
  SEMANTIC_ERRORS,
  EVAL_ERRORS,
  VERIFY_ERRORS,
  CONFIG_ERRORS,
  IO_ERRORS,
  ERROR_CODES,
  getErrorDef,
  getErrorsByCategory,
  formatErrorMessage,
  type ErrorCodeDef,
  type ErrorCodeKey,
  type ErrorCode,
} from './codes.js';

// Error catalog (explanations)
export {
  ERROR_EXPLANATIONS,
  getExplanation,
  getAllExplainedCodes,
  hasExplanation,
  getExplanationsByCategory,
} from './catalog.js';

// Suggestions
export {
  levenshteinDistance,
  damerauLevenshteinDistance,
  findSimilar,
  formatDidYouMean,
  formatDidYouMeanMultiple,
  suggestKeyword,
  suggestType,
  suggestField,
  suggestEntity,
  suggestBehavior,
  getContextualHelp,
  ISL_KEYWORDS,
  ISL_BUILTIN_TYPES,
  ERROR_PATTERNS,
  type SuggestionOptions,
  type Suggestion,
  type ErrorPattern,
} from './suggestions.js';

// Formatter
export {
  registerSource,
  clearSourceCache,
  getSource,
  formatDiagnostic,
  formatDiagnostics,
  formatExplanation,
  formatErrorCodeList,
} from './formatter.js';

// Builder
export {
  DiagnosticBuilder,
  diagnostic,
  errorDiag,
  warningDiag,
  DiagnosticCollector,
} from './builder.js';

// Verdict formatter
export {
  formatVerdict,
  formatViolationMessage,
  formatVerdictCompact,
  type Verdict,
  type ViolationSeverity,
  type VerdictViolation,
  type VerdictResult,
  type VerdictFormatOptions,
} from './verdict.js';

// Bridge (legacy code mapping)
export {
  LEGACY_CODE_MAP,
  resolveErrorCode,
  categoryFromCode,
  fromParserDiagnostic,
  fromParserDiagnostics,
  type LegacyParserDiagnostic,
} from './bridge.js';

// ============================================================================
// CONVENIENCE RE-EXPORTS
// ============================================================================

/**
 * Create a new source location
 */
export function createLocation(
  file: string,
  line: number,
  column: number,
  endLine?: number,
  endColumn?: number
): import('./types.js').SourceLocation {
  return {
    file,
    line,
    column,
    endLine: endLine ?? line,
    endColumn: endColumn ?? column,
  };
}

/**
 * Format a location as a string: file:line:column
 */
export function formatLocationString(loc: import('./types.js').SourceLocation): string {
  return `${loc.file}:${loc.line}:${loc.column}`;
}
