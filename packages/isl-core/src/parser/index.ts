/**
 * Parser API - delegates to canonical @isl-lang/parser.
 * Re-exports parse and related types for backward compatibility.
 */

export { parse, parseFile, Parser } from '@isl-lang/parser';
export type { ParseResult } from '@isl-lang/parser';
export type { ParseError } from '../parse-error.js';
