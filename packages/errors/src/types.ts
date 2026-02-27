// ============================================================================
// ISL Unified Error Types
// ============================================================================

/**
 * Source location information for error reporting
 */
export interface SourceLocation {
  file: string;
  line: number;
  column: number;
  endLine: number;
  endColumn: number;
}

/**
 * Position in a file (1-indexed)
 */
export interface Position {
  line: number;
  column: number;
}

/**
 * Diagnostic severity levels
 */
export type DiagnosticSeverity = 'error' | 'warning' | 'info' | 'hint';

/**
 * Related information for an error (e.g., "previously defined here")
 */
export interface RelatedInformation {
  message: string;
  location: SourceLocation;
}

/**
 * Suggested code fix
 */
export interface CodeFix {
  /** Title shown in IDE */
  title: string;
  /** Text edits to apply */
  edits: TextEdit[];
  /** Is this the preferred fix? */
  isPreferred?: boolean;
}

/**
 * Text edit for a code fix
 */
export interface TextEdit {
  range: { start: Position; end: Position };
  newText: string;
}

/**
 * Error category for grouping
 */
export type ErrorCategory =
  | 'lexer'      // L: Lexical analysis errors
  | 'parser'     // P: Syntax/parsing errors
  | 'type'       // T: Type checking errors
  | 'semantic'   // S: Semantic analysis errors
  | 'eval'       // E: Runtime evaluation errors
  | 'verify'     // V: Verification errors (pre/post conditions)
  | 'config'     // C: Configuration errors
  | 'io';        // I: Input/output errors

/**
 * Unified diagnostic interface for all ISL errors
 */
export interface Diagnostic {
  /** Unique error code (e.g., E0012) */
  code: string;
  
  /** Error category */
  category: ErrorCategory;
  
  /** Severity level */
  severity: DiagnosticSeverity;
  
  /** Human-readable error message */
  message: string;
  
  /** Source location */
  location: SourceLocation;
  
  /** Component that generated the error */
  source: 'lexer' | 'parser' | 'typechecker' | 'evaluator' | 'verifier' | 'cli' | 'lsp';
  
  /** Related information (e.g., "defined here") */
  relatedInformation?: RelatedInformation[];
  
  /** Suggested fix */
  fix?: CodeFix;
  
  /** Additional notes (displayed with "= note:") */
  notes?: string[];
  
  /** Help suggestions (displayed with "= help:") */
  help?: string[];
  
  /** Tags for IDE features */
  tags?: DiagnosticTag[];
}

export type DiagnosticTag = 'unnecessary' | 'deprecated';

/**
 * Error explanation for `isl explain <code>`
 */
export interface ErrorExplanation {
  /** Error code */
  code: string;
  
  /** Category */
  category: ErrorCategory;
  
  /** Short title */
  title: string;
  
  /** Detailed explanation */
  explanation: string;
  
  /** Common causes */
  causes: string[];
  
  /** How to fix */
  solutions: string[];
  
  /** Example of problematic code */
  badExample?: {
    code: string;
    description: string;
  };
  
  /** Example of correct code */
  goodExample?: {
    code: string;
    description: string;
  };
  
  /** See also (related error codes) */
  seeAlso?: string[];
}

/**
 * Source file content for snippet extraction
 */
export interface SourceFile {
  path: string;
  content: string;
  lines: string[];
}

/**
 * Options for error formatting
 */
export interface FormatOptions {
  /** Enable ANSI colors */
  colors: boolean;
  
  /** Number of context lines before/after error */
  contextLines: number;
  
  /** Show error codes */
  showCodes: boolean;
  
  /** Show notes and help */
  showHelp: boolean;
  
  /** Maximum errors to show */
  maxErrors: number;
  
  /** Show related information */
  showRelated: boolean;
  
  /** Terminal width for wrapping */
  terminalWidth: number;
}

/**
 * Default format options
 */
export const DEFAULT_FORMAT_OPTIONS: FormatOptions = {
  colors: true,
  contextLines: 2,
  showCodes: true,
  showHelp: true,
  maxErrors: 10,
  showRelated: true,
  terminalWidth: 80,
};

/**
 * Result of parsing with collected errors
 */
export interface DiagnosticResult<T> {
  /** The parsed value (may be partial on error) */
  value?: T;
  
  /** Collected diagnostics */
  diagnostics: Diagnostic[];
  
  /** Whether parsing/checking succeeded */
  success: boolean;
}
