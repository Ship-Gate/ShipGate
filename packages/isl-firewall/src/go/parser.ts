/**
 * Go import parser using tree-sitter (real parsing, no regex).
 * Extracts import paths from Go source for ghost-import detection.
 *
 * @module @isl-lang/firewall/go
 */

import Parser from 'tree-sitter';
import Go from 'tree-sitter-go';

export interface GoImportSpec {
  /** Import path as in source (e.g. "fmt", "github.com/foo/bar") */
  path: string;
  /** 0-based byte offset of the path in source */
  startIndex: number;
  /** 0-based byte offset of the end of the path in source */
  endIndex: number;
  /** 1-based line number */
  line: number;
  /** 1-based column number */
  column: number;
}

export interface GoParseResult {
  success: true;
  imports: GoImportSpec[];
}

export interface GoParseError {
  success: false;
  message: string;
  /** Parse errors from tree-sitter if any */
  errors?: Array<{ message: string; offset: number }>;
}

let parserInstance: Parser | null = null;

function getParser(): Parser {
  if (!parserInstance) {
    parserInstance = new Parser();
    parserInstance.setLanguage(Go as unknown as Parser.Language);
  }
  return parserInstance;
}

/**
 * Extract the string value from a quoted literal node (strip quotes and unescape).
 */
function stringLiteralText(source: string, node: Parser.SyntaxNode): string {
  const raw = source.slice(node.startIndex, node.endIndex);
  if (raw.length < 2) return raw;
  const quote = raw[0];
  if (quote !== '"' && quote !== '`') return raw;
  if (quote === '`') {
    return raw.slice(1, -1);
  }
  // Double-quoted: unescape \\ and \"
  let out = '';
  for (let i = 1; i < raw.length - 1; i++) {
    if (raw[i] === '\\' && i + 1 < raw.length - 1) {
      const next = raw[i + 1];
      if (next === '\\') out += '\\';
      else if (next === '"') out += '"';
      else out += raw[i + 1];
      i++;
    } else {
      out += raw[i];
    }
  }
  return out;
}

/**
 * Walk node and all descendants; call fn for each.
 */
function walk(node: Parser.SyntaxNode, fn: (n: Parser.SyntaxNode) => void): void {
  fn(node);
  for (let i = 0; i < node.childCount; i++) {
    const child = node.child(i);
    if (child) walk(child, fn);
  }
}

/**
 * Parse Go source and return all import paths using the tree-sitter Go grammar.
 * No regex is used for import extraction.
 */
export function parseGoImports(source: string): GoParseResult | GoParseError {
  const parser = getParser();
  const tree = parser.parse(source);

  const imports: GoImportSpec[] = [];

  walk(tree.rootNode, (node) => {
    if (node.type !== 'import_declaration') return;

    // import_declaration has: import_spec or import_spec_list (multiple import_spec).
    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i);
      if (!child) continue;
      if (child.type === 'import_spec') {
        const spec = collectImportSpec(source, child);
        if (spec) imports.push(spec);
      } else if (child.type === 'import_spec_list') {
        for (let j = 0; j < child.childCount; j++) {
          const specNode = child.child(j);
          if (specNode?.type === 'import_spec') {
            const spec = collectImportSpec(source, specNode);
            if (spec) imports.push(spec);
          }
        }
      }
    }
  });

  return { success: true, imports };
}

function collectImportSpec(source: string, node: Parser.SyntaxNode): GoImportSpec | null {
  // import_spec has field "path" (required): interpreted_string_literal or raw_string_literal
  for (let i = 0; i < node.childCount; i++) {
    const c = node.child(i);
    if (!c) continue;
    if (c.type === 'interpreted_string_literal' || c.type === 'raw_string_literal') {
      const path = stringLiteralText(source, c);
      const line = (source.slice(0, c.startIndex).match(/\n/g) ?? []).length + 1;
      const lastNewline = source.lastIndexOf('\n', c.startIndex);
      const column = lastNewline === -1 ? c.startIndex + 1 : c.startIndex - lastNewline;
      return {
        path,
        startIndex: c.startIndex,
        endIndex: c.endIndex,
        line,
        column,
      };
    }
  }
  return null;
}

/**
 * Check if a file path is a Go file (for language detection).
 */
export function isGoFile(filePath: string): boolean {
  return filePath.endsWith('.go');
}
