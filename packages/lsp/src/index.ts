/**
 * ISL Language Server Protocol
 * 
 * Language server implementation for ISL.
 */

// Parser
export {
  parse,
  tokenize,
  IslParser,
  KEYWORDS,
  BUILTIN_TYPES,
  type Token,
  type TokenType,
  type Symbol,
  type SymbolKind,
  type Position,
  type Range,
  type Location,
  type ParseResult,
  type ParseError,
  type Reference,
} from './parser.js';

// Completions
export {
  getCompletions,
  getCompletionContext,
  type CompletionContext,
} from './completions.js';

// Hover
export {
  getHover,
  type HoverResult,
} from './hover.js';

// Diagnostics
export {
  getDiagnostics,
  getRules,
  type DiagnosticRule,
} from './diagnostics.js';
