// ============================================================================
// ISL Parser Error Handling
// ============================================================================

import type { SourceLocation } from './ast.js';
import type { Token } from './tokens.js';

// Diagnostic severity levels
export type DiagnosticSeverity = 'error' | 'warning' | 'info' | 'hint';

// Diagnostic interface matching the API contract
export interface Diagnostic {
  severity: DiagnosticSeverity;
  code: string;
  message: string;
  location: SourceLocation;
  source: string;
  relatedInformation?: RelatedInformation[];
  fix?: CodeFix;
  tags?: DiagnosticTag[];
}

export type DiagnosticTag = 'unnecessary' | 'deprecated';

export interface RelatedInformation {
  message: string;
  location: SourceLocation;
}

export interface CodeFix {
  title: string;
  edits: TextEdit[];
  isPreferred?: boolean;
}

export interface TextEdit {
  range: { start: Position; end: Position };
  newText: string;
}

export interface Position {
  line: number;
  character: number;
}

// Error codes
export const ErrorCode = {
  // Lexer errors (L001-L099)
  UNEXPECTED_CHARACTER: 'L001',
  UNTERMINATED_STRING: 'L002',
  UNTERMINATED_REGEX: 'L003',
  INVALID_ESCAPE: 'L004',
  INVALID_NUMBER: 'L005',
  UNTERMINATED_COMMENT: 'L006',

  // Parser errors (P001-P199)
  UNEXPECTED_TOKEN: 'P001',
  EXPECTED_TOKEN: 'P002',
  EXPECTED_IDENTIFIER: 'P003',
  EXPECTED_TYPE: 'P004',
  EXPECTED_EXPRESSION: 'P005',
  MISSING_CLOSING_BRACE: 'P006',
  MISSING_CLOSING_PAREN: 'P007',
  MISSING_CLOSING_BRACKET: 'P008',
  DUPLICATE_FIELD: 'P009',
  DUPLICATE_ENTITY: 'P010',
  DUPLICATE_BEHAVIOR: 'P011',
  DUPLICATE_TYPE: 'P012',
  MISSING_VERSION: 'P013',
  INVALID_CONSTRAINT: 'P014',
  INVALID_ANNOTATION: 'P015',
  INVALID_LIFECYCLE: 'P016',
  EXPECTED_STATEMENT: 'P017',
  INVALID_OPERATOR: 'P018',
  UNCLOSED_BLOCK: 'P019',
  
  // Semantic errors (S001-S099) - for future type checker
  UNDEFINED_TYPE: 'S001',
  UNDEFINED_REFERENCE: 'S002',
  TYPE_MISMATCH: 'S003',
  INVALID_FIELD_REFERENCE: 'S004',
} as const;

export type ErrorCodeType = typeof ErrorCode[keyof typeof ErrorCode];

// Parse error class
export class ParseError extends Error {
  public readonly code: string;
  public readonly location: SourceLocation;
  public readonly related: RelatedInformation[];

  constructor(
    message: string,
    code: string,
    location: SourceLocation,
    related: RelatedInformation[] = []
  ) {
    super(message);
    this.name = 'ParseError';
    this.code = code;
    this.location = location;
    this.related = related;
  }

  toDiagnostic(): Diagnostic {
    return {
      severity: 'error',
      code: this.code,
      message: this.message,
      location: this.location,
      source: 'parser',
      relatedInformation: this.related.length > 0 ? this.related : undefined,
    };
  }
}

// Error collector for multi-error parsing
export class ErrorCollector {
  private diagnostics: Diagnostic[] = [];
  private readonly maxErrors: number;

  constructor(maxErrors: number = 100) {
    this.maxErrors = maxErrors;
  }

  add(diagnostic: Diagnostic): void {
    if (this.diagnostics.length < this.maxErrors) {
      this.diagnostics.push(diagnostic);
    }
  }

  addError(
    message: string,
    code: string,
    location: SourceLocation,
    related?: RelatedInformation[]
  ): void {
    this.add({
      severity: 'error',
      code,
      message,
      location,
      source: 'parser',
      relatedInformation: related,
    });
  }

  addWarning(message: string, code: string, location: SourceLocation): void {
    this.add({
      severity: 'warning',
      code,
      message,
      location,
      source: 'parser',
    });
  }

  hasErrors(): boolean {
    return this.diagnostics.some(d => d.severity === 'error');
  }

  getErrors(): Diagnostic[] {
    return this.diagnostics.filter(d => d.severity === 'error');
  }

  getWarnings(): Diagnostic[] {
    return this.diagnostics.filter(d => d.severity === 'warning');
  }

  getAll(): Diagnostic[] {
    return [...this.diagnostics];
  }

  clear(): void {
    this.diagnostics = [];
  }

  count(): number {
    return this.diagnostics.length;
  }
}

// Helper to create error messages
export function createErrorMessage(
  template: string,
  values: Record<string, string | number>
): string {
  let message = template;
  for (const [key, value] of Object.entries(values)) {
    message = message.replace(`{${key}}`, String(value));
  }
  return message;
}

// Format location for error messages
export function formatLocation(location: SourceLocation): string {
  return `${location.file}:${location.line}:${location.column}`;
}

// Create unexpected token error
export function unexpectedToken(token: Token, expected?: string): ParseError {
  const message = expected
    ? `Unexpected token '${token.value}', expected ${expected}`
    : `Unexpected token '${token.value}'`;
  return new ParseError(message, ErrorCode.UNEXPECTED_TOKEN, token.location);
}

// Create expected token error
export function expectedToken(
  expected: string,
  got: Token,
  location?: SourceLocation
): ParseError {
  return new ParseError(
    `Expected ${expected}, got '${got.value}'`,
    ErrorCode.EXPECTED_TOKEN,
    location ?? got.location
  );
}

// Create missing closing delimiter error
export function missingClosingDelimiter(
  delimiter: '{' | ')' | ']',
  openLocation: SourceLocation,
  currentLocation: SourceLocation
): ParseError {
  const codes: Record<string, string> = {
    '{': ErrorCode.MISSING_CLOSING_BRACE,
    ')': ErrorCode.MISSING_CLOSING_PAREN,
    ']': ErrorCode.MISSING_CLOSING_BRACKET,
  };
  const names: Record<string, string> = {
    '{': 'closing brace \'}\'',
    ')': 'closing parenthesis \')\'',
    ']': 'closing bracket \']\'',
  };
  return new ParseError(
    `Expected ${names[delimiter]}`,
    codes[delimiter] ?? ErrorCode.UNEXPECTED_TOKEN,
    currentLocation,
    [{ message: `Opening ${delimiter === '{' ? 'brace' : delimiter === ')' ? 'parenthesis' : 'bracket'} here`, location: openLocation }]
  );
}

// Create duplicate definition error
export function duplicateDefinition(
  kind: 'entity' | 'behavior' | 'type' | 'field',
  name: string,
  newLocation: SourceLocation,
  originalLocation: SourceLocation
): ParseError {
  const codes: Record<string, string> = {
    entity: ErrorCode.DUPLICATE_ENTITY,
    behavior: ErrorCode.DUPLICATE_BEHAVIOR,
    type: ErrorCode.DUPLICATE_TYPE,
    field: ErrorCode.DUPLICATE_FIELD,
  };
  return new ParseError(
    `Duplicate ${kind} '${name}'`,
    codes[kind] ?? ErrorCode.UNEXPECTED_TOKEN,
    newLocation,
    [{ message: `Previously defined here`, location: originalLocation }]
  );
}

// Synchronization tokens for error recovery
export const SYNC_TOKENS = new Set([
  'DOMAIN', 'ENTITY', 'BEHAVIOR', 'TYPE', 'ENUM', 'VIEW', 'POLICY',
  'INVARIANTS', 'SCENARIOS', 'CHAOS', 'INPUT', 'OUTPUT', 'PRECONDITIONS',
  'POSTCONDITIONS', 'TEMPORAL', 'SECURITY', 'RBRACE', 'EOF',
]);
