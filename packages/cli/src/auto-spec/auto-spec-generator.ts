/**
 * AutoSpecGenerator — Generate lightweight ISL specs for utility files
 *
 * Produces `utility` blocks with exports, dependencies, and invariants.
 * Used for Tier 3 (Relaxed) verification — export-only, no behavioral checks.
 *
 * @module @isl-lang/cli/auto-spec
 */

import { readFile } from 'fs/promises';
import { basename } from 'path';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface ExtractedExport {
  name: string;
  kind: 'function' | 'type' | 'constant' | 'class';
}

export interface ExtractedDependency {
  specifier: string;
  isDefault?: boolean;
}

export interface AutoSpecResult {
  islContent: string;
  exports: ExtractedExport[];
  dependencies: ExtractedDependency[];
  confidence: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Export Extraction (regex-based, no TS compiler required)
// ─────────────────────────────────────────────────────────────────────────────

function extractExports(source: string): ExtractedExport[] {
  const exports: ExtractedExport[] = [];
  const seen = new Set<string>();

  // export function fn / export async function fn
  const fnRegex = /export\s+(async\s+)?function\s+(\w+)/g;
  let m: RegExpExecArray | null;
  while ((m = fnRegex.exec(source)) !== null) {
    if (!seen.has(m[2])) {
      seen.add(m[2]);
      exports.push({ name: m[2], kind: 'function' });
    }
  }

  // export const X = / export let X =
  const constRegex = /export\s+(?:const|let)\s+(\w+)/g;
  while ((m = constRegex.exec(source)) !== null) {
    if (!seen.has(m[1])) {
      seen.add(m[1]);
      exports.push({ name: m[1], kind: 'constant' });
    }
  }

  // export type X / export interface X / export class X
  const typeRegex = /export\s+(?:type|interface|class)\s+(\w+)/g;
  while ((m = typeRegex.exec(source)) !== null) {
    if (!seen.has(m[1])) {
      seen.add(m[1]);
      const kind = /export\s+class\s+/.test(source.slice(Math.max(0, m.index - 20), m.index + 20)) ? 'class' : 'type';
      exports.push({ name: m[1], kind });
    }
  }

  // export { a, b, c } or export { a as b }
  const namedRegex = /export\s+\{\s*([^}]+)\s*\}/g;
  while ((m = namedRegex.exec(source)) !== null) {
    const items = m[1].split(',').map((s) => s.trim().split(/\s+as\s+/)[0].trim());
    for (const name of items) {
      if (name && /^\w+$/.test(name) && !seen.has(name)) {
        seen.add(name);
        exports.push({ name, kind: 'function' }); // default to function for named exports
      }
    }
  }

  // export default function fn
  const defaultFnRegex = /export\s+default\s+function\s+(\w+)/g;
  while ((m = defaultFnRegex.exec(source)) !== null) {
    if (!seen.has(m[1])) {
      seen.add(m[1]);
      exports.push({ name: m[1], kind: 'function' });
    }
  }

  return exports;
}

function extractDependencies(source: string): ExtractedDependency[] {
  const deps: ExtractedDependency[] = [];
  const seen = new Set<string>();

  // import X from "Y" / import { a, b } from "Y"
  const importRegex = /import\s+(?:(?:\{[^}]*\}|\*\s+as\s+\w+|\w+)\s+from\s+)?["']([^"']+)["']/g;
  let m: RegExpExecArray | null;
  while ((m = importRegex.exec(source)) !== null) {
    const specifier = m[1].trim();
    if (specifier && !seen.has(specifier) && !specifier.startsWith('.')) {
      seen.add(specifier);
      deps.push({ specifier });
    }
  }

  // require("Y")
  const requireRegex = /require\s*\(\s*["']([^"']+)["']\s*\)/g;
  while ((m = requireRegex.exec(source)) !== null) {
    const specifier = m[1].trim();
    if (specifier && !seen.has(specifier)) {
      seen.add(specifier);
      deps.push({ specifier });
    }
  }

  return deps;
}

// ─────────────────────────────────────────────────────────────────────────────
// ISL Utility Block Generation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generate a lightweight ISL spec for a utility file.
 * Uses `utility` blocks with exports, dependencies, and invariants.
 */
export async function generateUtilitySpec(
  codeFilePath: string,
  source?: string
): Promise<AutoSpecResult | null> {
  const content = source ?? (await readFile(codeFilePath, 'utf-8'));
  const exports = extractExports(content);
  const dependencies = extractDependencies(content);

  if (exports.length === 0 && dependencies.length === 0) {
    return null;
  }

  const domainBase = basename(codeFilePath).replace(/\.[^.]+$/, '');
  const domainName = domainBase
    .split(/[-_.]/)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join('');

  const lines: string[] = [];
  lines.push('# @tier 3 — Auto-generated utility spec (export-only verification)');
  lines.push('# exports: ' + exports.map((e) => e.name).join(', '));
  lines.push('# dependencies: ' + dependencies.map((d) => d.specifier).join(', '));
  lines.push('');
  lines.push(`domain ${domainName} {`);
  lines.push('  version: "1.0.0"');
  // Types for exported types/interfaces
  const typeExports = exports.filter((e) => e.kind === 'type' || e.kind === 'class');
  if (typeExports.length > 0) {
    lines.push('');
    for (const e of typeExports) {
      lines.push(`  type ${e.name} = String`);
    }
  }
  lines.push('');
  lines.push('  invariants exports_present {');
  lines.push('    - true');
  lines.push('  }');
  lines.push('}');
  lines.push('');

  // Confidence: higher when we have more exports
  let confidence = 0.5;
  if (exports.length > 0) confidence += 0.2 * Math.min(exports.length, 5);
  if (dependencies.length > 0) confidence += 0.1;
  confidence = Math.min(confidence, 0.9);

  return {
    islContent: lines.join('\n'),
    exports,
    dependencies,
    confidence,
  };
}

/**
 * Check if a file is a utility file (Tier 3) based on path patterns.
 */
export function isUtilityFile(filePath: string): boolean {
  const lower = filePath.toLowerCase().replace(/\\/g, '/');
  const utilPatterns = [
    /\/db\.ts$/,
    /\/validators?\.ts$/,
    /\/errors?\.ts$/,
    /\/middleware\.ts$/,
    /\/config\.ts$/,
    /\/utils?\.ts$/,
    /\/lib\/.*\.ts$/,
    /\/helpers?\.ts$/,
    /\/constants?\.ts$/,
    /\/types\.ts$/,
  ];
  return utilPatterns.some((p) => p.test(lower));
}
