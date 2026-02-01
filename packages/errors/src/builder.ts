// ============================================================================
// ISL Diagnostic Builder
// ============================================================================
//
// Fluent API for building diagnostics with all the bells and whistles.
//
// ============================================================================

import type {
  Diagnostic,
  DiagnosticSeverity,
  SourceLocation,
  RelatedInformation,
  CodeFix,
  TextEdit,
  DiagnosticTag,
  ErrorCategory,
} from './types.js';
import { ERROR_CODES, formatErrorMessage, type ErrorCodeKey } from './codes.js';
import { findSimilar, getContextualHelp } from './suggestions.js';

/**
 * Builder for creating diagnostics with a fluent API.
 * 
 * Example:
 * ```ts
 * const diag = new DiagnosticBuilder()
 *   .error('E0200')
 *   .message('Type mismatch: expected Number, got String')
 *   .at(location)
 *   .note('The field is declared as Number')
 *   .help('Use parseInt() to convert the string')
 *   .related('Field declared here', fieldLocation)
 *   .build();
 * ```
 */
export class DiagnosticBuilder {
  private _code: string = 'E0000';
  private _category: ErrorCategory = 'parser';
  private _severity: DiagnosticSeverity = 'error';
  private _message: string = '';
  private _location: SourceLocation = {
    file: '',
    line: 1,
    column: 1,
    endLine: 1,
    endColumn: 1,
  };
  private _source: Diagnostic['source'] = 'parser';
  private _related: RelatedInformation[] = [];
  private _notes: string[] = [];
  private _help: string[] = [];
  private _tags: DiagnosticTag[] = [];
  private _fix?: CodeFix;

  /**
   * Set error code and severity to 'error'
   */
  error(code: string | ErrorCodeKey): this {
    const def = typeof code === 'string' && code.startsWith('E')
      ? undefined
      : ERROR_CODES[code as ErrorCodeKey];
    
    if (def) {
      this._code = def.code;
      this._category = def.category;
    } else {
      this._code = code as string;
    }
    this._severity = 'error';
    return this;
  }

  /**
   * Set warning code and severity to 'warning'
   */
  warning(code: string): this {
    this._code = code;
    this._severity = 'warning';
    return this;
  }

  /**
   * Set info code and severity to 'info'
   */
  info(code: string): this {
    this._code = code;
    this._severity = 'info';
    return this;
  }

  /**
   * Set hint code and severity to 'hint'
   */
  hint(code: string): this {
    this._code = code;
    this._severity = 'hint';
    return this;
  }

  /**
   * Set severity explicitly
   */
  severity(sev: DiagnosticSeverity): this {
    this._severity = sev;
    return this;
  }

  /**
   * Set error message
   */
  message(msg: string): this {
    this._message = msg;
    return this;
  }

  /**
   * Set error message using template and values
   */
  messageTemplate(template: string, values: Record<string, string | number>): this {
    this._message = formatErrorMessage(template, values);
    return this;
  }

  /**
   * Set source location
   */
  at(location: SourceLocation): this {
    this._location = location;
    return this;
  }

  /**
   * Set source location from line/column (useful for testing)
   */
  atPosition(
    file: string,
    line: number,
    column: number,
    endLine?: number,
    endColumn?: number
  ): this {
    this._location = {
      file,
      line,
      column,
      endLine: endLine ?? line,
      endColumn: endColumn ?? column,
    };
    return this;
  }

  /**
   * Set component source
   */
  from(source: Diagnostic['source']): this {
    this._source = source;
    return this;
  }

  /**
   * Add a note
   */
  note(text: string): this {
    this._notes.push(text);
    return this;
  }

  /**
   * Add a help suggestion
   */
  help(text: string): this {
    this._help.push(text);
    return this;
  }

  /**
   * Add "Did you mean?" suggestion if similar value found
   */
  suggestSimilar(input: string, candidates: string[]): this {
    const suggestions = findSimilar(input, candidates);
    if (suggestions.length > 0) {
      const names = suggestions.map(s => `'${s.value}'`).join(', ');
      this._help.push(`Did you mean ${names}?`);
    }
    return this;
  }

  /**
   * Add contextual help based on error patterns
   */
  addContextualHelp(context: Record<string, unknown> = {}): this {
    const helps = getContextualHelp(this._code, this._message, context);
    this._help.push(...helps);
    return this;
  }

  /**
   * Add related information
   */
  related(message: string, location: SourceLocation): this {
    this._related.push({ message, location });
    return this;
  }

  /**
   * Mark as unnecessary code
   */
  unnecessary(): this {
    this._tags.push('unnecessary');
    return this;
  }

  /**
   * Mark as deprecated
   */
  deprecated(): this {
    this._tags.push('deprecated');
    return this;
  }

  /**
   * Add a quick fix
   */
  fix(title: string, edits: TextEdit[], isPreferred?: boolean): this {
    this._fix = { title, edits, isPreferred };
    return this;
  }

  /**
   * Add a simple replacement fix
   */
  fixReplace(
    title: string,
    startLine: number,
    startCol: number,
    endLine: number,
    endCol: number,
    newText: string
  ): this {
    this._fix = {
      title,
      edits: [{
        range: {
          start: { line: startLine, character: startCol },
          end: { line: endLine, character: endCol },
        },
        newText,
      }],
      isPreferred: true,
    };
    return this;
  }

  /**
   * Build the diagnostic
   */
  build(): Diagnostic {
    return {
      code: this._code,
      category: this._category,
      severity: this._severity,
      message: this._message,
      location: this._location,
      source: this._source,
      relatedInformation: this._related.length > 0 ? this._related : undefined,
      notes: this._notes.length > 0 ? this._notes : undefined,
      help: this._help.length > 0 ? this._help : undefined,
      tags: this._tags.length > 0 ? this._tags : undefined,
      fix: this._fix,
    };
  }
}

/**
 * Create a diagnostic builder
 */
export function diagnostic(): DiagnosticBuilder {
  return new DiagnosticBuilder();
}

// ============================================================================
// QUICK DIAGNOSTIC FACTORIES
// ============================================================================

/**
 * Create an error diagnostic quickly
 */
export function errorDiag(
  code: string,
  message: string,
  location: SourceLocation,
  source: Diagnostic['source'] = 'parser'
): Diagnostic {
  return diagnostic()
    .error(code)
    .message(message)
    .at(location)
    .from(source)
    .build();
}

/**
 * Create a warning diagnostic quickly
 */
export function warningDiag(
  code: string,
  message: string,
  location: SourceLocation,
  source: Diagnostic['source'] = 'parser'
): Diagnostic {
  return diagnostic()
    .warning(code)
    .message(message)
    .at(location)
    .from(source)
    .build();
}

// ============================================================================
// ERROR COLLECTOR
// ============================================================================

/**
 * Collects multiple diagnostics during parsing/type checking.
 * Supports a maximum error limit to avoid overwhelming output.
 */
export class DiagnosticCollector {
  private diagnostics: Diagnostic[] = [];
  private readonly maxErrors: number;

  constructor(maxErrors: number = 100) {
    this.maxErrors = maxErrors;
  }

  /**
   * Add a diagnostic
   */
  add(diagnostic: Diagnostic): void {
    if (this.diagnostics.length < this.maxErrors) {
      this.diagnostics.push(diagnostic);
    }
  }

  /**
   * Add multiple diagnostics
   */
  addAll(diagnostics: Diagnostic[]): void {
    for (const d of diagnostics) {
      this.add(d);
    }
  }

  /**
   * Check if any errors exist
   */
  hasErrors(): boolean {
    return this.diagnostics.some(d => d.severity === 'error');
  }

  /**
   * Get all errors
   */
  getErrors(): Diagnostic[] {
    return this.diagnostics.filter(d => d.severity === 'error');
  }

  /**
   * Get all warnings
   */
  getWarnings(): Diagnostic[] {
    return this.diagnostics.filter(d => d.severity === 'warning');
  }

  /**
   * Get all diagnostics
   */
  getAll(): Diagnostic[] {
    return [...this.diagnostics];
  }

  /**
   * Get error count
   */
  errorCount(): number {
    return this.diagnostics.filter(d => d.severity === 'error').length;
  }

  /**
   * Get warning count
   */
  warningCount(): number {
    return this.diagnostics.filter(d => d.severity === 'warning').length;
  }

  /**
   * Get total count
   */
  count(): number {
    return this.diagnostics.length;
  }

  /**
   * Check if at max capacity
   */
  isFull(): boolean {
    return this.diagnostics.length >= this.maxErrors;
  }

  /**
   * Clear all diagnostics
   */
  clear(): void {
    this.diagnostics = [];
  }
}
