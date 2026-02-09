/**
 * ISL Core
 *
 * The "thin waist" API for the Intent Specification Language.
 * Parse path: delegates to @isl-lang/parser and adapts to DomainDeclaration.
 */

// ============================================================================
// Lexer (tokens + tokenize for lexISL)
// ============================================================================

export * from './lexer/index.js';
export * from './ast/index.js';
export * from './parser/index.js';

// ============================================================================
// Type Checker, Formatter, Linter, Imports, Modules, Verification, Testgen
// ============================================================================

export * from './check/index.js';
export * from './fmt/index.js';
export * from './lint/index.js';
export * from './imports/index.js';
export * as modules from './modules/index.js';
export * as verification from './isl-agent/verification/index.js';
export * as testgen from './testgen/index.js';
export * as adapters from './adapters/index.js';

// ============================================================================
// High-Level Convenience APIs (parseISL delegates to parser + adapter)
// ============================================================================

import { parse } from '@isl-lang/parser';
import { domainToDomainDeclaration, locationToSpan } from './adapters/index.js';
import { check as typeCheck, type CheckResult, type CheckOptions } from './check/index.js';
import { format as formatAST, type FormatOptions } from './fmt/index.js';
import { lint as lintAST, type LintResult, type LintOptions } from './lint/index.js';
import type { DomainDeclaration } from './ast/index.js';
import type { ParseError } from './parse-error.js';
import type { Diagnostic } from '@isl-lang/parser';

export type { ParseError } from './parse-error.js';

// ============================================================================
// Lexer Result (unchanged)
// ============================================================================

import { tokenize, type LexerError, type Token } from './lexer/index.js';

export interface LexResult {
  tokens: Token[];
  errors: LexerError[];
}

export function lexISL(source: string, filename?: string): LexResult {
  return tokenize(source, filename);
}

// ============================================================================
// Parse Result & parseISL (delegates to @isl-lang/parser + adapter)
// ============================================================================

export interface ParseResult {
  ast: DomainDeclaration | null;
  errors: ParseError[];
}

function toParseError(d: Diagnostic): ParseError {
  return {
    message: d.message,
    span: locationToSpan(d.location),
  };
}

/**
 * Parse ISL source into DomainDeclaration (canonical path: @isl-lang/parser + adapter).
 */
export function parseISL(source: string, filename?: string): ParseResult {
  const result = parse(source, filename);
  if (!result.success || !result.domain) {
    return {
      ast: null,
      errors: result.errors.map(toParseError),
    };
  }
  return {
    ast: domainToDomainDeclaration(result.domain),
    errors: [],
  };
}

// ============================================================================
// Full Pipeline Result
// ============================================================================

export interface CompileResult {
  parse: ParseResult;
  check?: CheckResult;
  lint?: LintResult;
  formatted?: string;
  success: boolean;
}

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
    return { parse: parseResult, success: false };
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
// Version
// ============================================================================

export const VERSION = '0.1.0';
export const API_VERSION = 1;
