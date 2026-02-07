/**
 * Parse Rust `use` statements from source
 * @module @isl-lang/hallucination-scanner/rust/use-parser
 */

import type { RustUse, SourceLocation } from './types.js';

/**
 * Regex to match Rust use statements.
 * Handles: use, pub use, pub(crate) use, etc.
 * Captures the full path including braces and globs.
 */
const USE_STMT =
  /^\s*(?:pub(?:\s*\([^)]*\))?\s+)?use\s+([a-zA-Z_][a-zA-Z0-9_]*(?:::[a-zA-Z_*][a-zA-Z0-9_]*)*(?:::\{[^}]*\})?(?:::\*)?)\s*(?:as\s+[a-zA-Z_][a-zA-Z0-9_]*)?\s*;/gm;

/**
 * Regex to match `extern crate` declarations (pre-2018 edition or explicit re-exports)
 */
const EXTERN_CRATE =
  /^\s*(?:pub(?:\s*\([^)]*\))?\s+)?extern\s+crate\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*(?:as\s+([a-zA-Z_][a-zA-Z0-9_]*))?\s*;/gm;

/**
 * Strip comments and string literals from a line for safer path extraction.
 * We run regex on full source and then derive line/column from match index.
 */
function getLineColumn(content: string, index: number): { line: number; column: number } {
  const before = content.slice(0, index);
  const line = (before.match(/\n/g) ?? []).length + 1;
  const lastNewline = before.lastIndexOf('\n');
  const column = lastNewline === -1 ? index + 1 : index - lastNewline;
  return { line, column };
}

/**
 * Extract root (first segment) from a use path and classify it
 */
function classifyPath(path: string): { root: string; isStd: boolean; isCrate: boolean; isRelative: boolean } {
  const first = path.split('::')[0];
  const isStd = first === 'std';
  const isCrate = first === 'crate';
  const isRelative = first === 'super' || first === 'self';
  return { root: first, isStd, isCrate, isRelative };
}

/**
 * Expand brace groups in use paths, e.g. "std::collections::{HashMap, BTreeMap}"
 * into ["std::collections::HashMap", "std::collections::BTreeMap"]
 */
function expandBraces(fullPath: string): string[] {
  const braceMatch = fullPath.match(/^(.+)::\{([^}]+)\}$/);
  if (!braceMatch) return [fullPath];

  const prefix = braceMatch[1];
  const items = braceMatch[2].split(',').map((s) => s.trim()).filter(Boolean);
  return items.map((item) => {
    if (item === 'self') return prefix;
    return `${prefix}::${item}`;
  });
}

/**
 * Parse all `use` statements from Rust source
 */
export function parseUseStatements(source: string, filePath: string): RustUse[] {
  const results: RustUse[] = [];
  let match: RegExpExecArray | null;

  // Reset regex state
  USE_STMT.lastIndex = 0;

  while ((match = USE_STMT.exec(source)) !== null) {
    const fullPath = match[1].trim();
    const expanded = expandBraces(fullPath);

    const start = getLineColumn(source, match.index);
    const end = getLineColumn(source, match.index + match[0].length);

    for (const usePath of expanded) {
      const pathForRoot = usePath.replace(/::\*$/, '');
      const pathSegments = pathForRoot.split('::').filter(Boolean);
      const root = pathSegments[0] ?? usePath;
      const { isStd, isCrate, isRelative } = classifyPath(pathForRoot);

      results.push({
        path: usePath,
        root,
        isStd,
        isCrate,
        isRelative,
        location: {
          file: filePath,
          line: start.line,
          column: start.column,
          endLine: end.line,
          endColumn: end.column,
        },
        raw: match[0],
      });
    }
  }

  return results;
}

/**
 * Parse `extern crate` declarations from Rust source
 */
export function parseExternCrates(source: string, filePath: string): { name: string; alias?: string; location: SourceLocation }[] {
  const results: { name: string; alias?: string; location: SourceLocation }[] = [];
  EXTERN_CRATE.lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = EXTERN_CRATE.exec(source)) !== null) {
    const name = match[1];
    const alias = match[2];
    const start = getLineColumn(source, match.index);
    const end = getLineColumn(source, match.index + match[0].length);
    results.push({
      name,
      alias,
      location: { file: filePath, line: start.line, column: start.column, endLine: end.line, endColumn: end.column },
    });
  }

  return results;
}

/**
 * Extract external crate names from a list of RustUse (exclude std, crate, super, self)
 */
export function externalCratesFromUses(uses: RustUse[]): Set<string> {
  const set = new Set<string>();
  for (const u of uses) {
    if (!u.isStd && !u.isCrate && !u.isRelative) {
      set.add(u.root);
    }
  }
  return set;
}
