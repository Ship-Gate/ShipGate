/**
 * Parse error type for isl-core API compatibility.
 * Used when delegating to @isl-lang/parser and mapping its diagnostics to this shape.
 */

import type { SourceSpan } from './lexer/tokens.js';

export interface ParseError {
  message: string;
  span: SourceSpan;
}
