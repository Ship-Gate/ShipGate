/**
 * TypeScript/JavaScript import parser
 * Extracts import/require/export-from statements from source code.
 *
 * Uses structured line-by-line parsing (not pure regex) to handle
 * multi-line imports, dynamic imports, and CommonJS require.
 *
 * @module @isl-lang/hallucination-scanner/ts/import-parser
 */

import { isNodeBuiltin } from './builtins.js';
import type { TsImport, TsImportKind, SourceLocation } from './types.js';

/**
 * Parse all import/require/export-from statements from TS/JS source.
 */
export function parseImports(source: string, filePath: string): TsImport[] {
  const imports: TsImport[] = [];
  const lines = source.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const trimmed = line.trim();

    // Skip comments (simple heuristic — not a full parser)
    if (trimmed.startsWith('//')) continue;
    if (trimmed.startsWith('/*')) {
      // Skip block comments
      while (i < lines.length && !lines[i]!.includes('*/')) {
        i++;
      }
      continue;
    }

    // ── Static imports ──────────────────────────────────────────────
    // import X from 'y'
    // import { X } from 'y'
    // import * as X from 'y'
    // import 'y'  (side-effect)
    // import type { X } from 'y'
    if (trimmed.startsWith('import ') || trimmed.startsWith('import{')) {
      const isTypeOnly = trimmed.startsWith('import type ') || trimmed.startsWith('import type{');
      const kind: TsImportKind = isTypeOnly ? 'import-type' : 'import';

      // Collect multi-line import: accumulate until we find the 'from' + string or a bare string
      let fullStatement = line;
      let endLineIdx = i;
      // If it doesn't contain 'from' or a closing quote on this line, keep reading
      while (endLineIdx < lines.length - 1 && !hasModuleSpecifier(fullStatement) && !isSideEffectImport(fullStatement)) {
        endLineIdx++;
        fullStatement += '\n' + lines[endLineIdx]!;
      }

      const specifier = extractSpecifier(fullStatement);
      if (specifier) {
        const col = line.indexOf(specifier);
        imports.push(buildTsImport(specifier, kind, filePath, i + 1, col >= 0 ? col + 1 : 1, endLineIdx + 1, fullStatement));
      }

      i = endLineIdx;
      continue;
    }

    // ── Export-from ──────────────────────────────────────────────────
    // export { X } from 'y'
    // export * from 'y'
    // export type { X } from 'y'
    if ((trimmed.startsWith('export ') || trimmed.startsWith('export{')) && trimmed.includes('from')) {
      let fullStatement = line;
      let endLineIdx = i;
      while (endLineIdx < lines.length - 1 && !hasModuleSpecifier(fullStatement)) {
        endLineIdx++;
        fullStatement += '\n' + lines[endLineIdx]!;
      }

      const specifier = extractFromSpecifier(fullStatement);
      if (specifier) {
        const col = line.indexOf(specifier);
        imports.push(buildTsImport(specifier, 'export-from', filePath, i + 1, col >= 0 ? col + 1 : 1, endLineIdx + 1, fullStatement));
      }

      i = endLineIdx;
      continue;
    }

    // ── require() calls ─────────────────────────────────────────────
    // const x = require('y')
    // require('y')
    // const { a, b } = require('y')
    const requireMatches = [...trimmed.matchAll(/\brequire\s*\(\s*(['"`])([^'"`]+)\1\s*\)/g)];
    for (const m of requireMatches) {
      const specifier = m[2];
      if (specifier) {
        const col = line.indexOf(specifier);
        imports.push(buildTsImport(specifier, 'require', filePath, i + 1, col >= 0 ? col + 1 : 1, i + 1, line));
      }
    }

    // ── Dynamic import() ────────────────────────────────────────────
    // import('y')
    // await import('y')
    // Only match if NOT already handled as static import
    if (!trimmed.startsWith('import ') && !trimmed.startsWith('import{')) {
      const dynamicMatches = [...trimmed.matchAll(/\bimport\s*\(\s*(['"`])([^'"`]+)\1\s*\)/g)];
      for (const m of dynamicMatches) {
        const specifier = m[2];
        if (specifier) {
          const col = line.indexOf(specifier);
          imports.push(buildTsImport(specifier, 'dynamic', filePath, i + 1, col >= 0 ? col + 1 : 1, i + 1, line));
        }
      }
    }
  }

  return imports;
}

// ── Helpers ───────────────────────────────────────────────────────────────

/**
 * Check if a statement contains a module specifier (string after `from`).
 */
function hasModuleSpecifier(statement: string): boolean {
  return /from\s+['"`]/.test(statement) || isSideEffectImport(statement);
}

/**
 * Check if this is a side-effect import: import 'foo'
 */
function isSideEffectImport(statement: string): boolean {
  return /^import\s+['"`]/.test(statement.trim());
}

/**
 * Extract the module specifier from an import/require statement.
 * Handles: import X from 'y', import 'y', import type { X } from 'y'
 */
function extractSpecifier(statement: string): string | null {
  // Side-effect import: import 'foo'
  const sideEffect = statement.match(/import\s+(['"`])([^'"`]+)\1/);
  if (sideEffect?.[2]) return sideEffect[2];

  // from 'specifier'
  const fromMatch = statement.match(/from\s+(['"`])([^'"`]+)\1/);
  return fromMatch?.[2] ?? null;
}

/**
 * Extract the module specifier from an export-from statement.
 */
function extractFromSpecifier(statement: string): string | null {
  const fromMatch = statement.match(/from\s+(['"`])([^'"`]+)\1/);
  return fromMatch?.[2] ?? null;
}

/**
 * Determine package name from a specifier.
 * - "express" → "express"
 * - "express/json" → "express"
 * - "@scope/pkg" → "@scope/pkg"
 * - "@scope/pkg/sub" → "@scope/pkg"
 * - "./foo" → undefined (relative)
 * - "node:fs" → undefined (builtin)
 */
export function extractPackageName(specifier: string): string | undefined {
  // Relative
  if (specifier.startsWith('.') || specifier.startsWith('/')) return undefined;
  // Node builtin
  if (isNodeBuiltin(specifier)) return undefined;

  // Scoped: @scope/pkg or @scope/pkg/sub
  if (specifier.startsWith('@')) {
    const parts = specifier.split('/');
    if (parts.length >= 2) return `${parts[0]}/${parts[1]}`;
    return specifier;
  }

  // Bare: express or express/json
  const slash = specifier.indexOf('/');
  return slash === -1 ? specifier : specifier.slice(0, slash);
}

/**
 * Build a TsImport object from extracted data.
 */
function buildTsImport(
  specifier: string,
  kind: TsImportKind,
  file: string,
  line: number,
  column: number,
  endLine: number,
  raw: string,
): TsImport {
  const location: SourceLocation = { file, line, column, endLine };
  const isBuiltin = isNodeBuiltin(specifier);
  const isRelative = specifier.startsWith('.') || specifier.startsWith('/');
  const isScoped = specifier.startsWith('@');
  const packageName = extractPackageName(specifier);

  return {
    specifier,
    isBuiltin,
    isRelative,
    isScoped,
    packageName,
    kind,
    location,
    raw: raw.trim(),
  };
}
