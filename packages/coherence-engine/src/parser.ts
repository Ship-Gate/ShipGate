/**
 * Lightweight parser for TypeScript/JavaScript imports and exports.
 *
 * Extracts import specifiers and exported symbols from source code
 * using regex-based patterns. Handles @/ path aliases and relative paths.
 */

import type { ParsedImport, ParsedExport } from './types.js';

/**
 * Parse import statements from source code.
 */
export function parseImports(source: string): ParsedImport[] {
  const imports: ParsedImport[] = [];
  const lines = source.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!.trim();
    if (!line.startsWith('import') && !(line.startsWith('export') && line.includes('from'))) continue;

    // Skip comments
    if (line.startsWith('//')) continue;
    if (line.startsWith('/*')) {
      while (i < lines.length && !lines[i]!.includes('*/')) i++;
      continue;
    }

    // Multi-line: accumulate until we have a complete statement
    let full = line;
    let j = i;
    while (j < lines.length - 1 && !hasModuleSpecifier(full) && !isSideEffectImport(full)) {
      j++;
      full += '\n' + lines[j];
    }

    const specifier = extractSpecifier(full);
    if (!specifier) continue;

    const isTypeOnly = full.includes('import type') || full.includes('export type');
    const names = extractImportNames(full);

    imports.push({
      specifier,
      names,
      typeOnly: isTypeOnly,
      line: i + 1,
    });

    i = j;
  }

  return imports;
}

/**
 * Parse export statements from source code.
 */
export function parseExports(source: string): ParsedExport[] {
  const exports: ParsedExport[] = [];
  const seen = new Set<string>();

  const patterns: Array<{ regex: RegExp; isType: boolean }> = [
    // export function/const/let/class
    { regex: /^export\s+(?:async\s+)?(?:function|const|let|class)\s+(\w+)/, isType: false },
    // export type/interface
    { regex: /^export\s+(?:type|interface)\s+(\w+)/, isType: true },
    // export enum
    { regex: /^export\s+enum\s+(\w+)/, isType: false },
    // export default (anonymous - we track as "default")
    { regex: /^export\s+default\s+/, isType: false },
    // export { a, b, c } or export type { a, b }
    { regex: /^export\s+(?:type\s+)?\{([^}]+)\}/, isType: false },
  ];

  const lines = source.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!.trim();
    if (!line.startsWith('export')) continue;
    if (line.startsWith('//')) continue;

    for (const { regex, isType: baseIsType } of patterns) {
      const match = line.match(regex);
      if (match) {
        const isType = baseIsType || line.includes('export type');
        if (match[1]) {
          // Named exports: parse the braced list
          const names = match[1]
            .split(',')
            .map((s) => {
              const part = s.trim().split(/\s+as\s+/);
              return part[part.length - 1]!.trim();
            })
            .filter(Boolean);
          for (const name of names) {
            if (!seen.has(name)) {
              seen.add(name);
              exports.push({ name, isType, line: i + 1 });
            }
          }
        } else if (line.includes('export default')) {
          if (!seen.has('default')) {
            seen.add('default');
            exports.push({ name: 'default', isType: false, line: i + 1 });
          }
        } else {
          const name = match[1];
          if (name && !seen.has(name)) {
            seen.add(name);
            exports.push({ name, isType, line: i + 1 });
          }
        }
        break;
      }
    }
  }

  return exports;
}

function hasModuleSpecifier(statement: string): boolean {
  return /from\s+['"`]/.test(statement) || isSideEffectImport(statement);
}

function isSideEffectImport(statement: string): boolean {
  return /^import\s+['"`]/.test(statement.trim());
}

function extractSpecifier(statement: string): string | null {
  const sideEffect = statement.match(/import\s+(['"`])([^'"`]+)\1/);
  if (sideEffect?.[2]) return sideEffect[2];

  const fromMatch = statement.match(/from\s+(['"`])([^'"`]+)\1/);
  return fromMatch?.[2] ?? null;
}

function extractImportNames(statement: string): string[] {
  // import X from 'y' -> [X]
  const defaultMatch = statement.match(/import\s+(\w+)\s+from\s+['"`]/);
  if (defaultMatch?.[1]) return [defaultMatch[1]];

  // import { a, b as c } from 'y'
  const namedMatch = statement.match(/\{\s*([^}]+)\s*\}\s*from/);
  if (namedMatch?.[1]) {
    return namedMatch[1]
      .split(',')
      .map((s) => {
        const part = s.trim().split(/\s+as\s+/);
        return part[part.length - 1]!.trim();
      })
      .filter(Boolean);
  }

  // import * as X from 'y'
  const nsMatch = statement.match(/import\s+\*\s+as\s+(\w+)\s+from/);
  if (nsMatch?.[1]) return [nsMatch[1]];

  return [];
}

/**
 * Check if a specifier is a relative path or path alias (project-internal).
 */
export function isProjectImport(specifier: string): boolean {
  return specifier.startsWith('.') || specifier.startsWith('@/') || specifier.startsWith('@\\');
}

/**
 * Normalize a file path for manifest lookup (handle @/ alias).
 */
export function normalizePathForLookup(path: string, rootDir = 'src'): string {
  if (path.startsWith('@/')) {
    return path.replace(/^@\//, `${rootDir}/`).replace(/\/$/, '');
  }
  return path.replace(/\/$/, '');
}
