/**
 * Lightweight Code Extraction
 *
 * Extracts function signatures, imports, and structural info from
 * TypeScript/JavaScript source files using regex-based patterns.
 * Intentionally avoids heavy AST parsing for speed.
 */

import type { ExtractedFunction, ExtractedImport } from './driftTypes.js';

// ============================================================================
// FUNCTION EXTRACTION
// ============================================================================

/**
 * Regex patterns for extracting function signatures.
 *
 * Covers:
 *   - export [async] function name(params): ReturnType
 *   - export const name = [async] (params): ReturnType =>
 *   - [async] function name(params): ReturnType (non-exported)
 *   - class method: [async] name(params): ReturnType
 */
const FUNCTION_PATTERNS: RegExp[] = [
  // export [async] function name(params)[: ReturnType]
  /^(export\s+)?(?:async\s+)?function\s+(\w+)\s*\(([^)]*)\)(?:\s*:\s*([^\s{]+(?:<[^>]+>)?))?\s*\{/gm,

  // export const name = [async] (params)[: ReturnType] =>
  /^(export\s+)?const\s+(\w+)\s*=\s*(?:async\s+)?\(([^)]*)\)(?:\s*:\s*([^\s=]+(?:<[^>]+>)?))?\s*=>/gm,

  // class method: [public|private|protected] [async] name(params)[: ReturnType]
  /^\s+(?:public|private|protected)?\s*(?:async\s+)?(\w+)\s*\(([^)]*)\)(?:\s*:\s*([^\s{]+(?:<[^>]+>)?))?\s*\{/gm,
];

/**
 * Extract function signatures from source code (lightweight, regex-based).
 *
 * @param source - The source code to analyze
 * @returns Array of extracted function signatures
 */
export function extractFunctions(source: string): ExtractedFunction[] {
  const functions: ExtractedFunction[] = [];
  const lines = source.split('\n');
  const seen = new Set<string>();

  // Pattern 1: export [async] function name(...)
  const fnRegex = /^(export\s+)?(async\s+)?function\s+(\w+)\s*\(([^)]*)\)(?:\s*:\s*([^\s{]+(?:<[^>]+>)?))?/;

  // Pattern 2: export const name = [async] (...) =>
  const arrowRegex = /^(export\s+)?const\s+(\w+)\s*=\s*(async\s+)?\(([^)]*)\)(?:\s*:\s*([^\s=]+(?:<[^>]+>)?))?/;

  // Pattern 3: class method
  const methodRegex = /^\s+(?:public|private|protected)?\s*(async\s+)?(\w+)\s*\(([^)]*)\)(?:\s*:\s*([^\s{]+(?:<[^>]+>)?))?/;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;

    // Skip comments and empty lines
    if (line.trimStart().startsWith('//') || line.trimStart().startsWith('*') || line.trim() === '') {
      continue;
    }

    let match: RegExpMatchArray | null;

    // Try function declaration
    match = line.match(fnRegex);
    if (match) {
      const name = match[3];
      if (!seen.has(name)) {
        seen.add(name);
        functions.push({
          name,
          params: parseParams(match[4]),
          returnType: match[5]?.trim() ?? '',
          exported: !!match[1],
          async: !!match[2],
          line: lineNum,
        });
      }
      continue;
    }

    // Try arrow function
    match = line.match(arrowRegex);
    if (match) {
      const name = match[2];
      if (!seen.has(name)) {
        seen.add(name);
        functions.push({
          name,
          params: parseParams(match[4]),
          returnType: match[5]?.trim() ?? '',
          exported: !!match[1],
          async: !!match[3],
          line: lineNum,
        });
      }
      continue;
    }

    // Try class method
    match = line.match(methodRegex);
    if (match) {
      const name = match[2];
      // Skip constructor and common non-function matches
      if (name === 'constructor' || name === 'if' || name === 'for' || name === 'while' || name === 'switch') {
        continue;
      }
      if (!seen.has(name)) {
        seen.add(name);
        functions.push({
          name,
          params: parseParams(match[3]),
          returnType: match[4]?.trim() ?? '',
          exported: false,
          async: !!match[1],
          line: lineNum,
        });
      }
    }
  }

  return functions;
}

// ============================================================================
// IMPORT EXTRACTION
// ============================================================================

/**
 * Extract import statements from source code.
 *
 * @param source - The source code to analyze
 * @returns Array of extracted imports
 */
export function extractImports(source: string): ExtractedImport[] {
  const imports: ExtractedImport[] = [];
  const lines = source.split('\n');

  // Single-line import: import { a, b } from 'module'
  const singleLineRegex = /^(import\s+type\s+)?import\s*(?:(\w+),?\s*)?(?:\{([^}]+)\})?\s*from\s*['"]([^'"]+)['"]/;

  // import type { a, b } from 'module'
  const typeImportRegex = /^import\s+type\s+(?:\{([^}]+)\})?\s*from\s*['"]([^'"]+)['"]/;

  // import defaultExport from 'module'
  const defaultImportRegex = /^import\s+(\w+)\s+from\s*['"]([^'"]+)['"]/;

  // import 'module' (side-effect)
  const sideEffectRegex = /^import\s*['"]([^'"]+)['"]/;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const lineNum = i + 1;

    if (!line.startsWith('import')) continue;

    let match: RegExpMatchArray | null;

    // Type import
    match = line.match(typeImportRegex);
    if (match) {
      imports.push({
        source: match[2],
        names: match[1] ? parseImportNames(match[1]) : [],
        typeOnly: true,
        line: lineNum,
      });
      continue;
    }

    // Named + default import
    match = line.match(singleLineRegex);
    if (match) {
      imports.push({
        source: match[4],
        names: match[3] ? parseImportNames(match[3]) : [],
        defaultImport: match[2] || undefined,
        typeOnly: !!match[1],
        line: lineNum,
      });
      continue;
    }

    // Default import only
    match = line.match(defaultImportRegex);
    if (match) {
      imports.push({
        source: match[2],
        names: [],
        defaultImport: match[1],
        typeOnly: false,
        line: lineNum,
      });
      continue;
    }

    // Side-effect import
    match = line.match(sideEffectRegex);
    if (match) {
      imports.push({
        source: match[1],
        names: [],
        typeOnly: false,
        line: lineNum,
      });
    }
  }

  return imports;
}

// ============================================================================
// STRUCTURAL EXTRACTION
// ============================================================================

/**
 * Extract exported names from source code (functions, classes, constants, types).
 *
 * @param source - The source code to analyze
 * @returns Array of exported symbol names
 */
export function extractExportedNames(source: string): string[] {
  const names: string[] = [];
  const lines = source.split('\n');

  const exportRegex = /^export\s+(?:async\s+)?(?:function|const|let|class|type|interface|enum)\s+(\w+)/;

  for (const line of lines) {
    const match = line.match(exportRegex);
    if (match) {
      names.push(match[1]);
    }
  }

  return names;
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Parse a parameter list string into individual parameter names.
 *
 * @param raw - Raw parameter string (e.g., "a: string, b: number")
 * @returns Array of parameter names
 */
function parseParams(raw: string): string[] {
  if (!raw || !raw.trim()) return [];

  return raw
    .split(',')
    .map((p) => {
      const trimmed = p.trim();
      // Extract just the parameter name (before `:` or `=`)
      const name = trimmed.split(/[?:=]/)[0].trim();
      // Remove destructuring brackets
      return name.replace(/[{}[\]]/g, '').trim();
    })
    .filter((name) => name.length > 0);
}

/**
 * Parse import names from a destructured import block.
 *
 * @param raw - Raw import names string (e.g., "readFile, writeFile as wf")
 * @returns Array of imported names (using local alias if present)
 */
function parseImportNames(raw: string): string[] {
  return raw
    .split(',')
    .map((item) => {
      const trimmed = item.trim();
      // Handle `original as alias`
      const aliasMatch = trimmed.match(/\w+\s+as\s+(\w+)/);
      if (aliasMatch) return aliasMatch[1];
      return trimmed;
    })
    .filter((name) => name.length > 0);
}
