/**
 * ISL Core
 * 
 * Parser, AST, and semantic analysis for the Intent Specification Language.
 */

export * from './lexer/index.js';
export * from './ast/index.js';
export * from './parser/index.js';
export * as verification from './isl-agent/verification/index.js';

import { tokenize, type LexerError } from './lexer/index.js';
import { parse, type ParseError } from './parser/index.js';
import type { DomainDeclaration } from './ast/index.js';

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
  
  const { ast, errors: parseErrors } = parse(tokens);
  
  return { ast, errors: parseErrors };
}
