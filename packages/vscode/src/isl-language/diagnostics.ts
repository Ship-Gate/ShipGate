/**
 * ISL Language Diagnostics Provider
 * 
 * Parses ISL files and reports errors/warnings as VS Code diagnostics.
 * Supports both parse errors from @isl-lang/parser and semantic lint warnings.
 */

import * as vscode from 'vscode';
import { ISL_LANGUAGE_ID, isISLDocument } from './islSelector';

// ============================================================================
// Types
// ============================================================================

/** Diagnostic code prefix for ISL diagnostics */
export const ISL_DIAGNOSTIC_SOURCE = 'isl';

/** Diagnostic codes for ISL-specific issues */
export enum ISLDiagnosticCode {
  // Parse errors (P-series)
  PARSE_ERROR = 'ISL-P001',
  UNEXPECTED_TOKEN = 'ISL-P002',
  MISSING_CLOSING_BRACE = 'ISL-P003',
  
  // Semantic warnings (S-series)
  MISSING_POSTCONDITIONS = 'ISL-S001',
  MISSING_VERSION = 'ISL-S002',
  MISSING_DESCRIPTION = 'ISL-S003',
  EMPTY_PRECONDITIONS = 'ISL-S004',
  EMPTY_POSTCONDITIONS = 'ISL-S005',
  UNUSED_INPUT = 'ISL-S006',
  
  // Style warnings (W-series)
  INCONSISTENT_NAMING = 'ISL-W001',
  LONG_BEHAVIOR_NAME = 'ISL-W002',
  MISSING_ERROR_WHEN = 'ISL-W003',
}

/** Parsed diagnostic from parser */
export interface ParsedDiagnostic {
  severity: 'error' | 'warning' | 'info' | 'hint';
  code: string;
  message: string;
  line: number;
  column: number;
  endLine?: number;
  endColumn?: number;
}

/** Lint warning from semantic analysis */
export interface LintWarning {
  code: ISLDiagnosticCode;
  message: string;
  line: number;
  column: number;
  endLine: number;
  endColumn: number;
  severity: vscode.DiagnosticSeverity;
}

// ============================================================================
// Parser Integration (optional import)
// ============================================================================

// Try to import the ISL parser - it may not be available
let parserAvailable = false;
let parseISL: ((source: string, filename?: string) => ParseResult) | undefined;

interface ParseResult {
  success: boolean;
  domain?: unknown;
  errors: Array<{
    severity: string;
    code: string;
    message: string;
    location: {
      line: number;
      column: number;
      endLine: number;
      endColumn: number;
    };
  }>;
}

// Attempt to load the parser dynamically
async function loadParser(): Promise<void> {
  try {
    // Try @isl-lang/parser first
    const parser = await import('@isl-lang/parser');
    parseISL = parser.parse;
    parserAvailable = true;
  } catch {
    try {
      // Fallback to @isl-lang/isl-core
      const core = await import('@isl-lang/isl-core');
      parseISL = core.parseISL as typeof parseISL;
      parserAvailable = true;
    } catch {
      // Parser not available, will use regex-based fallback
      parserAvailable = false;
    }
  }
}

// Initialize parser on module load
loadParser().catch(() => {/* ignore */});

// ============================================================================
// Diagnostics Provider
// ============================================================================

/**
 * ISL Diagnostics Provider
 * 
 * Provides real-time diagnostics for ISL files including:
 * - Parse errors from the ISL parser
 * - Semantic lint warnings (missing postconditions, version, etc.)
 * - Style warnings (naming conventions)
 */
export class ISLDiagnosticsProvider implements vscode.Disposable {
  private readonly diagnosticCollection: vscode.DiagnosticCollection;
  private readonly disposables: vscode.Disposable[] = [];
  private debounceTimers: Map<string, NodeJS.Timeout> = new Map();
  
  constructor() {
    this.diagnosticCollection = vscode.languages.createDiagnosticCollection(ISL_DIAGNOSTIC_SOURCE);
    this.disposables.push(this.diagnosticCollection);
  }

  /**
   * Register the diagnostics provider with VS Code.
   * Call this during extension activation.
   */
  public register(context: vscode.ExtensionContext): void {
    // Diagnose all open ISL files on activation
    vscode.workspace.textDocuments
      .filter(isISLDocument)
      .forEach((doc) => this.updateDiagnostics(doc));

    // Watch for document changes
    this.disposables.push(
      vscode.workspace.onDidChangeTextDocument((e) => {
        if (isISLDocument(e.document)) {
          this.debouncedUpdate(e.document);
        }
      })
    );

    // Watch for document opens
    this.disposables.push(
      vscode.workspace.onDidOpenTextDocument((doc) => {
        if (isISLDocument(doc)) {
          this.updateDiagnostics(doc);
        }
      })
    );

    // Watch for document closes
    this.disposables.push(
      vscode.workspace.onDidCloseTextDocument((doc) => {
        if (isISLDocument(doc)) {
          this.diagnosticCollection.delete(doc.uri);
          this.cancelDebounce(doc.uri.toString());
        }
      })
    );

    // Register all disposables with the context
    context.subscriptions.push(...this.disposables);
  }

  /**
   * Manually trigger diagnostics update for a document.
   */
  public async updateDiagnostics(document: vscode.TextDocument): Promise<void> {
    if (!isISLDocument(document)) {
      return;
    }

    const diagnostics: vscode.Diagnostic[] = [];
    const text = document.getText();

    // Run parser if available
    if (parserAvailable && parseISL) {
      const parseErrors = await this.runParser(text, document.uri.fsPath);
      diagnostics.push(...parseErrors);
    } else {
      // Fallback: regex-based syntax checking
      const fallbackErrors = this.runFallbackParser(text);
      diagnostics.push(...fallbackErrors);
    }

    // Run semantic lint checks
    const lintWarnings = this.runSemanticLint(text, document);
    diagnostics.push(...lintWarnings);

    this.diagnosticCollection.set(document.uri, diagnostics);
  }

  /**
   * Clear all diagnostics for a document.
   */
  public clearDiagnostics(uri: vscode.Uri): void {
    this.diagnosticCollection.delete(uri);
  }

  /**
   * Clear all ISL diagnostics.
   */
  public clearAll(): void {
    this.diagnosticCollection.clear();
  }

  /**
   * Get the diagnostic collection (for testing or external access).
   */
  public getDiagnosticCollection(): vscode.DiagnosticCollection {
    return this.diagnosticCollection;
  }

  public dispose(): void {
    this.debounceTimers.forEach((timer) => clearTimeout(timer));
    this.debounceTimers.clear();
    this.disposables.forEach((d) => d.dispose());
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private debouncedUpdate(document: vscode.TextDocument): void {
    const key = document.uri.toString();
    this.cancelDebounce(key);
    
    const timer = setTimeout(() => {
      this.debounceTimers.delete(key);
      this.updateDiagnostics(document);
    }, 300); // 300ms debounce
    
    this.debounceTimers.set(key, timer);
  }

  private cancelDebounce(key: string): void {
    const existing = this.debounceTimers.get(key);
    if (existing) {
      clearTimeout(existing);
      this.debounceTimers.delete(key);
    }
  }

  private async runParser(source: string, filename: string): Promise<vscode.Diagnostic[]> {
    if (!parseISL) return [];
    
    try {
      const result = parseISL(source, filename);
      return result.errors.map((error) => this.convertParserError(error));
    } catch (err) {
      // Parser threw an exception - create a general error
      const message = err instanceof Error ? err.message : String(err);
      return [
        new vscode.Diagnostic(
          new vscode.Range(0, 0, 0, 1),
          `Parser error: ${message}`,
          vscode.DiagnosticSeverity.Error
        ),
      ];
    }
  }

  private convertParserError(error: ParseResult['errors'][0]): vscode.Diagnostic {
    const range = new vscode.Range(
      Math.max(0, error.location.line - 1),
      Math.max(0, error.location.column - 1),
      Math.max(0, error.location.endLine - 1),
      Math.max(0, error.location.endColumn - 1)
    );

    const severity = this.convertSeverity(error.severity);
    const diagnostic = new vscode.Diagnostic(range, error.message, severity);
    diagnostic.code = error.code;
    diagnostic.source = ISL_DIAGNOSTIC_SOURCE;
    
    return diagnostic;
  }

  private convertSeverity(severity: string): vscode.DiagnosticSeverity {
    switch (severity) {
      case 'error':
        return vscode.DiagnosticSeverity.Error;
      case 'warning':
        return vscode.DiagnosticSeverity.Warning;
      case 'info':
        return vscode.DiagnosticSeverity.Information;
      case 'hint':
        return vscode.DiagnosticSeverity.Hint;
      default:
        return vscode.DiagnosticSeverity.Error;
    }
  }

  /**
   * Fallback parser using regex patterns when the full parser isn't available.
   */
  private runFallbackParser(text: string): vscode.Diagnostic[] {
    const diagnostics: vscode.Diagnostic[] = [];
    const lines = text.split('\n');

    // Track brace balance
    let braceBalance = 0;
    const braceStack: { line: number; col: number; type: string }[] = [];

    for (let lineNum = 0; lineNum < lines.length; lineNum++) {
      const line = lines[lineNum]!;
      
      // Check for unclosed strings
      const stringMatches = line.match(/"/g);
      if (stringMatches && stringMatches.length % 2 !== 0) {
        // Check if it's not a multi-line string continuation
        if (!line.trimEnd().endsWith('\\')) {
          diagnostics.push(
            this.createDiagnostic(
              ISLDiagnosticCode.PARSE_ERROR,
              'Unclosed string literal',
              lineNum,
              line.indexOf('"'),
              lineNum,
              line.length,
              vscode.DiagnosticSeverity.Error
            )
          );
        }
      }

      // Track brace balance
      for (let col = 0; col < line.length; col++) {
        const char = line[col];
        if (char === '{') {
          braceBalance++;
          braceStack.push({ line: lineNum, col, type: '{' });
        } else if (char === '}') {
          braceBalance--;
          if (braceBalance < 0) {
            diagnostics.push(
              this.createDiagnostic(
                ISLDiagnosticCode.MISSING_CLOSING_BRACE,
                'Unexpected closing brace',
                lineNum,
                col,
                lineNum,
                col + 1,
                vscode.DiagnosticSeverity.Error
              )
            );
            braceBalance = 0;
          } else {
            braceStack.pop();
          }
        }
      }
    }

    // Report unclosed braces
    for (const unclosed of braceStack) {
      diagnostics.push(
        this.createDiagnostic(
          ISLDiagnosticCode.MISSING_CLOSING_BRACE,
          'Unclosed brace',
          unclosed.line,
          unclosed.col,
          unclosed.line,
          unclosed.col + 1,
          vscode.DiagnosticSeverity.Error
        )
      );
    }

    return diagnostics;
  }

  /**
   * Run semantic lint checks on the ISL source.
   */
  private runSemanticLint(text: string, document: vscode.TextDocument): vscode.Diagnostic[] {
    const diagnostics: vscode.Diagnostic[] = [];
    const lines = text.split('\n');

    // Check for domain-level issues
    this.checkDomainIssues(text, lines, diagnostics);

    // Check for behavior-level issues
    this.checkBehaviorIssues(text, lines, diagnostics);

    return diagnostics;
  }

  private checkDomainIssues(
    text: string,
    lines: string[],
    diagnostics: vscode.Diagnostic[]
  ): void {
    // Check if domain has a version
    const domainMatch = text.match(/domain\s+(\w+)\s*\{/);
    if (domainMatch) {
      const hasVersion = /version\s*:\s*["'][^"']+["']/.test(text);
      if (!hasVersion) {
        const domainLine = this.findLineContaining(lines, 'domain ');
        if (domainLine !== -1) {
          diagnostics.push(
            this.createDiagnostic(
              ISLDiagnosticCode.MISSING_VERSION,
              `Domain '${domainMatch[1]}' is missing a version declaration`,
              domainLine,
              0,
              domainLine,
              lines[domainLine]!.length,
              vscode.DiagnosticSeverity.Warning
            )
          );
        }
      }
    }
  }

  private checkBehaviorIssues(
    text: string,
    lines: string[],
    diagnostics: vscode.Diagnostic[]
  ): void {
    // Find all behaviors
    const behaviorRegex = /behavior\s+(\w+)\s*\{/g;
    let match;

    while ((match = behaviorRegex.exec(text)) !== null) {
      const behaviorName = match[1];
      const behaviorStartIndex = match.index;
      const behaviorLine = this.getLineNumberFromIndex(text, behaviorStartIndex);
      
      // Find the behavior's closing brace
      const behaviorEndIndex = this.findMatchingBrace(text, behaviorStartIndex);
      if (behaviorEndIndex === -1) continue;

      const behaviorText = text.substring(behaviorStartIndex, behaviorEndIndex + 1);

      // Check for missing postconditions
      const hasPostconditions = /postconditions\s*\{/.test(behaviorText);
      const hasOutput = /output\s*\{/.test(behaviorText);
      
      if (!hasPostconditions && hasOutput) {
        diagnostics.push(
          this.createDiagnostic(
            ISLDiagnosticCode.MISSING_POSTCONDITIONS,
            `Behavior '${behaviorName}' has output but no postconditions block`,
            behaviorLine,
            0,
            behaviorLine,
            lines[behaviorLine]?.length ?? 0,
            vscode.DiagnosticSeverity.Warning
          )
        );
      }

      // Check for empty preconditions
      const emptyPreconditions = /preconditions\s*\{\s*\}/.test(behaviorText);
      if (emptyPreconditions) {
        const precondLine = this.findLineInRange(
          lines,
          behaviorLine,
          this.getLineNumberFromIndex(text, behaviorEndIndex),
          'preconditions'
        );
        if (precondLine !== -1) {
          diagnostics.push(
            this.createDiagnostic(
              ISLDiagnosticCode.EMPTY_PRECONDITIONS,
              'Preconditions block is empty',
              precondLine,
              0,
              precondLine,
              lines[precondLine]!.length,
              vscode.DiagnosticSeverity.Hint
            )
          );
        }
      }

      // Check for empty postconditions
      const emptyPostconditions = /postconditions\s*\{\s*\}/.test(behaviorText);
      if (emptyPostconditions) {
        const postcondLine = this.findLineInRange(
          lines,
          behaviorLine,
          this.getLineNumberFromIndex(text, behaviorEndIndex),
          'postconditions'
        );
        if (postcondLine !== -1) {
          diagnostics.push(
            this.createDiagnostic(
              ISLDiagnosticCode.EMPTY_POSTCONDITIONS,
              'Postconditions block is empty',
              postcondLine,
              0,
              postcondLine,
              lines[postcondLine]!.length,
              vscode.DiagnosticSeverity.Warning
            )
          );
        }
      }

      // Check for missing description
      const hasDescription = /description\s*:/.test(behaviorText);
      if (!hasDescription) {
        diagnostics.push(
          this.createDiagnostic(
            ISLDiagnosticCode.MISSING_DESCRIPTION,
            `Behavior '${behaviorName}' is missing a description`,
            behaviorLine,
            0,
            behaviorLine,
            lines[behaviorLine]?.length ?? 0,
            vscode.DiagnosticSeverity.Hint
          )
        );
      }

      // Check for error definitions missing 'when' clause
      const errorRegex = /(\w+)\s*\{[^}]*\}/g;
      const errorsBlockMatch = behaviorText.match(/errors\s*\{([^}]*(?:\{[^}]*\}[^}]*)*)\}/);
      if (errorsBlockMatch) {
        const errorsContent = errorsBlockMatch[1]!;
        const errorDefRegex = /(\w+)\s*\{([^}]*)\}/g;
        let errorMatch;
        
        while ((errorMatch = errorDefRegex.exec(errorsContent)) !== null) {
          const errorName = errorMatch[1];
          const errorBody = errorMatch[2]!;
          
          if (!errorBody.includes('when:')) {
            const errorLine = this.findLineContaining(lines, errorName!);
            if (errorLine !== -1) {
              diagnostics.push(
                this.createDiagnostic(
                  ISLDiagnosticCode.MISSING_ERROR_WHEN,
                  `Error '${errorName}' is missing a 'when' description`,
                  errorLine,
                  0,
                  errorLine,
                  lines[errorLine]!.length,
                  vscode.DiagnosticSeverity.Hint
                )
              );
            }
          }
        }
      }
    }
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  private createDiagnostic(
    code: ISLDiagnosticCode,
    message: string,
    startLine: number,
    startCol: number,
    endLine: number,
    endCol: number,
    severity: vscode.DiagnosticSeverity
  ): vscode.Diagnostic {
    const range = new vscode.Range(startLine, startCol, endLine, endCol);
    const diagnostic = new vscode.Diagnostic(range, message, severity);
    diagnostic.code = code;
    diagnostic.source = ISL_DIAGNOSTIC_SOURCE;
    return diagnostic;
  }

  private findLineContaining(lines: string[], searchText: string): number {
    for (let i = 0; i < lines.length; i++) {
      if (lines[i]!.includes(searchText)) {
        return i;
      }
    }
    return -1;
  }

  private findLineInRange(
    lines: string[],
    startLine: number,
    endLine: number,
    searchText: string
  ): number {
    for (let i = startLine; i <= endLine && i < lines.length; i++) {
      if (lines[i]!.includes(searchText)) {
        return i;
      }
    }
    return -1;
  }

  private getLineNumberFromIndex(text: string, index: number): number {
    const textBefore = text.substring(0, index);
    return (textBefore.match(/\n/g) || []).length;
  }

  private findMatchingBrace(text: string, startIndex: number): number {
    let depth = 0;
    let inString = false;
    let stringChar = '';

    for (let i = startIndex; i < text.length; i++) {
      const char = text[i];
      const prevChar = i > 0 ? text[i - 1] : '';

      // Handle string literals
      if ((char === '"' || char === "'") && prevChar !== '\\') {
        if (!inString) {
          inString = true;
          stringChar = char;
        } else if (char === stringChar) {
          inString = false;
        }
        continue;
      }

      if (inString) continue;

      if (char === '{') {
        depth++;
      } else if (char === '}') {
        depth--;
        if (depth === 0) {
          return i;
        }
      }
    }

    return -1;
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create and register the ISL diagnostics provider.
 * Use this in extension activation.
 * 
 * @example
 * ```typescript
 * // In extension.ts activate function:
 * import { createDiagnosticsProvider } from './isl-language/diagnostics';
 * 
 * export function activate(context: vscode.ExtensionContext) {
 *   const diagnosticsProvider = createDiagnosticsProvider();
 *   diagnosticsProvider.register(context);
 * }
 * ```
 */
export function createDiagnosticsProvider(): ISLDiagnosticsProvider {
  return new ISLDiagnosticsProvider();
}

/**
 * Check if the parser is available.
 * Useful for feature detection.
 */
export function isParserAvailable(): boolean {
  return parserAvailable;
}
