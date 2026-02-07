/**
 * ISL Core
 * 
 * The "thin waist" API for the Intent Specification Language.
 * 
 * This package provides the essential compiler flow:
 * - parse: Parse ISL source into AST
 * - check: Type check and semantic analysis
 * - fmt: Format AST back to source
 * - lint: Style and best-practice checks
 * - imports: Import resolution
 * - verification: Verify implementations against specs
 * - testgen: Generate tests from specs
 */

// ============================================================================
// Core Parser APIs
// ============================================================================

export * from './lexer/index.js';
export * from './ast/index.js';
export * from './parser/index.js';

// ============================================================================
// Type Checker APIs
// ============================================================================

export * from './check/index.js';

// ============================================================================
// Formatter APIs
// ============================================================================

export * from './fmt/index.js';

// ============================================================================
// Linter APIs
// ============================================================================

export * from './lint/index.js';

// ============================================================================
// Import Resolution APIs (Legacy)
// ============================================================================

export * from './imports/index.js';

// ============================================================================
// Module Resolution System
// ============================================================================

export * as modules from './modules/index.js';

// ============================================================================
// Verification APIs
// ============================================================================

export * as verification from './isl-agent/verification/index.js';

// ============================================================================
// Test Generation APIs (Experimental)
// ============================================================================

export * as testgen from './testgen/index.js';

// ============================================================================
// Adapters (AST Type Conversion)
// ============================================================================

export * as adapters from './adapters/index.js';

// ============================================================================
// High-Level Convenience APIs
// ============================================================================

import { tokenize, type LexerError, type Token } from './lexer/index.js';
import { parse as parseTokens, type ParseError } from './parser/index.js';
import { check as typeCheck, type CheckResult, type CheckOptions } from './check/index.js';
import { format as formatAST, type FormatOptions } from './fmt/index.js';
import { lint as lintAST, type LintResult, type LintOptions } from './lint/index.js';
import type { DomainDeclaration } from './ast/index.js';

// ============================================================================
// Lexer Result
// ============================================================================

export interface LexResult {
  tokens: Token[];
  errors: LexerError[];
}

/**
 * Lex ISL source code into tokens
 */
export function lexISL(source: string, filename?: string): LexResult {
  return tokenize(source, filename);
}

// ============================================================================
// Parse Result
// ============================================================================

export interface ParseResult {
  ast: DomainDeclaration | null;
  errors: Array<LexerError | ParseError>;
}

/**
 * Parse ISL source code into an AST
 */
export function parseISL(source: string, filename?: string): ParseResult {
  const { tokens, errors: lexerErrors } = tokenize(source, filename);
  
  if (lexerErrors.length > 0) {
    return { ast: null, errors: lexerErrors };
  }
  
  const { ast, errors: parseErrors } = parseTokens(tokens);
  
  return { ast, errors: parseErrors };
}

// ============================================================================
// Full Pipeline Result
// ============================================================================

export interface CompileResult {
  /** Parse result */
  parse: ParseResult;
  /** Check result (if parse succeeded) */
  check?: CheckResult;
  /** Lint result (if parse succeeded) */
  lint?: LintResult;
  /** Formatted source (if parse succeeded) */
  formatted?: string;
  /** Overall success */
  success: boolean;
}

/**
 * Run the full ISL compilation pipeline
 */
export function compile(
  source: string,
  options?: {
    check?: CheckOptions;
    lint?: LintOptions;
    format?: FormatOptions;
    filename?: string;
  }
): CompileResult {
  const parseResult = parseISL(source, options?.filename);
  
  if (!parseResult.ast) {
    return {
      parse: parseResult,
      success: false,
    };
  }

  const checkResult = typeCheck(parseResult.ast, options?.check);
  const lintResult = lintAST(parseResult.ast, options?.lint);
  const formatted = formatAST(parseResult.ast, options?.format);

  const hasErrors = !checkResult.valid || lintResult.errorCount > 0;

  return {
    parse: parseResult,
    check: checkResult,
    lint: lintResult,
    formatted,
    success: !hasErrors,
  };
}

// ============================================================================
// Version Information
// ============================================================================

/** Package version */
export const VERSION = '0.1.0';

/** API version for compatibility checks */
export const API_VERSION = 1;
