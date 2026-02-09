// ============================================================================
// ISL Error Code Bridge
// ============================================================================
//
// Maps legacy error codes from the parser (L001, P001) to unified
// error codes (E0001, E0100) and provides conversion utilities.
//
// This bridge enables gradual migration: existing packages can continue
// using their local codes while the errors package provides the unified
// formatting and catalog.
//
// ============================================================================

import type { Diagnostic, SourceLocation, ErrorCategory } from './types.js';

// ============================================================================
// LEGACY CODE MAPPING
// ============================================================================

/**
 * Mapping from legacy parser error codes to unified codes.
 */
export const LEGACY_CODE_MAP: Record<string, string> = {
  // Lexer errors (L00x -> E000x)
  'L001': 'E0001', // UNEXPECTED_CHARACTER
  'L002': 'E0002', // UNTERMINATED_STRING
  'L003': 'E0003', // UNTERMINATED_REGEX
  'L004': 'E0004', // INVALID_ESCAPE
  'L005': 'E0005', // INVALID_NUMBER
  'L006': 'E0006', // UNTERMINATED_COMMENT

  // Parser errors (P00x -> E01xx)
  'P001': 'E0100', // UNEXPECTED_TOKEN
  'P002': 'E0101', // EXPECTED_TOKEN
  'P003': 'E0102', // EXPECTED_IDENTIFIER
  'P004': 'E0103', // EXPECTED_TYPE
  'P005': 'E0104', // EXPECTED_EXPRESSION
  'P006': 'E0105', // MISSING_CLOSING_BRACE
  'P007': 'E0106', // MISSING_CLOSING_PAREN
  'P008': 'E0107', // MISSING_CLOSING_BRACKET
  'P009': 'E0108', // DUPLICATE_FIELD
  'P010': 'E0109', // DUPLICATE_ENTITY
  'P011': 'E0110', // DUPLICATE_BEHAVIOR
  'P012': 'E0111', // DUPLICATE_TYPE
  'P013': 'E0112', // MISSING_VERSION
  'P014': 'E0113', // INVALID_CONSTRAINT
  'P015': 'E0114', // INVALID_ANNOTATION
  'P016': 'E0115', // INVALID_LIFECYCLE
  'P017': 'E0116', // EXPECTED_STATEMENT
  'P018': 'E0117', // INVALID_OPERATOR
  'P019': 'E0118', // UNCLOSED_BLOCK
};

/**
 * Resolve a potentially legacy error code to a unified code.
 * If the code is already a unified code (Exxxx), returns it as-is.
 * If it's a legacy code (L00x, P00x), maps it to the unified equivalent.
 */
export function resolveErrorCode(code: string): string {
  // Already a unified code
  if (code.startsWith('E')) {
    return code;
  }
  return LEGACY_CODE_MAP[code] ?? code;
}

/**
 * Determine the error category from a code string.
 */
export function categoryFromCode(code: string): ErrorCategory {
  const unified = resolveErrorCode(code);
  const num = parseInt(unified.slice(1), 10);

  if (num < 100) return 'lexer';
  if (num < 200) return 'parser';
  if (num < 300) return 'type';
  if (num < 400) return 'semantic';
  if (num < 500) return 'eval';
  if (num < 600) return 'verify';
  if (num < 700) return 'config';
  return 'io';
}

// ============================================================================
// PARSER DIAGNOSTIC CONVERSION
// ============================================================================

/**
 * A legacy parser diagnostic (from @isl-lang/parser).
 * This is the format the parser currently emits.
 */
export interface LegacyParserDiagnostic {
  severity: 'error' | 'warning' | 'info' | 'hint';
  code: string;
  message: string;
  location: SourceLocation;
  source: string;
  relatedInformation?: Array<{
    message: string;
    location: SourceLocation;
  }>;
  fix?: {
    title: string;
    edits: Array<{
      range: { start: { line: number; character: number }; end: { line: number; character: number } };
      newText: string;
    }>;
    isPreferred?: boolean;
  };
  tags?: Array<'unnecessary' | 'deprecated'>;
  notes?: string[];
  help?: string[];
}

/**
 * Convert a legacy parser diagnostic to a unified diagnostic.
 * Maps error codes and normalizes the structure.
 */
export function fromParserDiagnostic(legacy: LegacyParserDiagnostic): Diagnostic {
  const unifiedCode = resolveErrorCode(legacy.code);

  return {
    code: unifiedCode,
    category: categoryFromCode(unifiedCode),
    severity: legacy.severity,
    message: legacy.message,
    location: legacy.location,
    source: legacy.source === 'parser' ? 'parser' : legacy.source as Diagnostic['source'],
    relatedInformation: legacy.relatedInformation,
    fix: legacy.fix ? {
      title: legacy.fix.title,
      edits: legacy.fix.edits.map(e => ({
        range: {
          start: { line: e.range.start.line, column: e.range.start.character },
          end: { line: e.range.end.line, column: e.range.end.character },
        },
        newText: e.newText,
      })),
      isPreferred: legacy.fix.isPreferred,
    } : undefined,
    tags: legacy.tags,
    notes: legacy.notes,
    help: legacy.help,
  };
}

/**
 * Convert multiple legacy parser diagnostics to unified diagnostics.
 */
export function fromParserDiagnostics(legacies: LegacyParserDiagnostic[]): Diagnostic[] {
  return legacies.map(fromParserDiagnostic);
}
