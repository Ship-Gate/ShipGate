/**
 * Spec Generation — generate ISL specifications from TypeScript source.
 *
 * Performs static analysis of the source file (no AI, no runtime execution)
 * to extract exported functions and interfaces, then emits a starter ISL spec.
 *
 * @internal — consumers import from the root `@shipgate/sdk` entry.
 */

import * as fs from 'node:fs/promises';
import * as nodePath from 'node:path';
import type { GeneratedSpec } from './types.js';

// ============================================================================
// TypeScript type → ISL type mapping
// ============================================================================

const TS_TO_ISL: Record<string, string> = {
  string: 'String',
  number: 'Int',
  boolean: 'Boolean',
  Date: 'Timestamp',
  void: 'Void',
  undefined: 'Void',
  bigint: 'Int',
};

function mapType(tsType: string): string {
  const cleaned = tsType.trim();

  // Promise<X> → unwrap to X
  const promiseMatch = /^Promise<(.+)>$/.exec(cleaned);
  if (promiseMatch?.[1]) {
    return mapType(promiseMatch[1]);
  }

  // Array<X> or X[] → List<X>
  const arrayMatch = /^(?:Array<(.+)>|(.+)\[\])$/.exec(cleaned);
  if (arrayMatch) {
    const inner = arrayMatch[1] ?? arrayMatch[2] ?? 'unknown';
    return `List<${mapType(inner)}>`;
  }

  return TS_TO_ISL[cleaned] ?? cleaned;
}

// ============================================================================
// Parameter extraction
// ============================================================================

interface Param {
  name: string;
  type: string;
}

function parseParams(raw: string): Param[] {
  if (!raw.trim()) return [];

  const params: Param[] = [];
  let depth = 0;
  let current = '';

  // Split on commas, but respect generic depth <...>
  for (const ch of raw) {
    if (ch === '<' || ch === '(') depth++;
    else if (ch === '>' || ch === ')') depth--;

    if (ch === ',' && depth === 0) {
      params.push(parseOneParam(current));
      current = '';
    } else {
      current += ch;
    }
  }
  if (current.trim()) {
    params.push(parseOneParam(current));
  }

  return params.filter((p) => p.name.length > 0);
}

function parseOneParam(raw: string): Param {
  const trimmed = raw.trim();
  const colonIdx = trimmed.indexOf(':');
  if (colonIdx === -1) {
    return { name: trimmed.replace(/\?$/, ''), type: 'unknown' };
  }
  const name = trimmed.slice(0, colonIdx).trim().replace(/\?$/, '');
  const type = trimmed.slice(colonIdx + 1).trim();
  return { name, type: mapType(type) };
}

// ============================================================================
// Helpers
// ============================================================================

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function indent(text: string, level: number): string {
  const pad = '  '.repeat(level);
  return text
    .split('\n')
    .map((line) => (line.trim() ? pad + line : line))
    .join('\n');
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Generate an ISL specification from a TypeScript/JavaScript source file.
 *
 * Performs **static analysis only** — no AI models, no runtime execution.
 * Extracts exported functions (→ behaviors) and interfaces (→ entities)
 * to produce a starter ISL spec that can be refined by the developer.
 *
 * @param sourcePath - Path to the source file to analyze
 * @returns Generated ISL spec, confidence level, and any warnings
 *
 * @example
 * ```typescript
 * const spec = await generateSpecFromSource('src/auth/login.ts');
 * console.log(spec.isl);
 * // domain Login version "0.1.0" { ... }
 *
 * console.log(spec.confidence);
 * // 0.4 — static analysis only, refine manually
 * ```
 */
export async function generateSpecFromSource(
  sourcePath: string,
): Promise<GeneratedSpec> {
  const source = await fs.readFile(sourcePath, 'utf-8');
  const basename = nodePath.basename(sourcePath, nodePath.extname(sourcePath));
  const domainName = capitalize(basename);

  const warnings: string[] = [];
  const behaviorBlocks: string[] = [];
  const entityBlocks: string[] = [];

  // ── Extract exported functions → behaviors ──────────────────────────
  const funcRe =
    /export\s+(?:async\s+)?function\s+(\w+)\s*\(([^)]*)\)(?:\s*:\s*([^{]+))?\s*\{/g;
  let match: RegExpExecArray | null;

  while ((match = funcRe.exec(source)) !== null) {
    const fnName = match[1] ?? 'Unknown';
    const paramsStr = match[2] ?? '';
    const returnType = match[3]?.trim();

    const params = parseParams(paramsStr);
    const inputLines =
      params.length > 0
        ? params.map((p) => `    ${p.name}: ${p.type}`).join('\n')
        : '    // no input parameters detected';

    const outputType = returnType ? mapType(returnType) : 'Boolean';

    behaviorBlocks.push(
      [
        `  behavior ${capitalize(fnName)} {`,
        `    input {`,
        inputLines,
        `    }`,
        `    output {`,
        `      success: ${outputType}`,
        `    }`,
        `    postconditions {`,
        `      success {`,
        `        result != null`,
        `      }`,
        `    }`,
        `  }`,
      ].join('\n'),
    );
  }

  // ── Extract exported interfaces → entities ──────────────────────────
  const ifaceRe = /export\s+interface\s+(\w+)\s*\{([^}]*)\}/g;

  while ((match = ifaceRe.exec(source)) !== null) {
    const ifaceName = match[1] ?? 'Unknown';
    const body = match[2] ?? '';

    const fields = body
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith('//') && !l.startsWith('*'))
      .map((l) => {
        const cleaned = l.replace(/;$/, '').replace(/,$/, '');
        const colonIdx = cleaned.indexOf(':');
        if (colonIdx === -1) return null;

        const fieldName = cleaned.slice(0, colonIdx).trim().replace(/\?$/, '');
        const fieldType = mapType(cleaned.slice(colonIdx + 1).trim());
        return `    ${fieldName}: ${fieldType}`;
      })
      .filter(Boolean);

    if (fields.length > 0) {
      entityBlocks.push(
        [`  entity ${ifaceName} {`, ...fields, `  }`].join('\n'),
      );
    }
  }

  // ── Compose ISL ─────────────────────────────────────────────────────
  if (behaviorBlocks.length === 0 && entityBlocks.length === 0) {
    warnings.push('No exported functions or interfaces found in source file');
  }
  if (behaviorBlocks.length === 0) {
    warnings.push(
      'No behaviors detected; spec may need manual behavior definitions',
    );
  }

  const confidence =
    behaviorBlocks.length > 0
      ? Math.min(0.8, 0.3 + behaviorBlocks.length * 0.1)
      : 0.1;

  const sections = [
    ...entityBlocks,
    ...(entityBlocks.length > 0 && behaviorBlocks.length > 0 ? [''] : []),
    ...behaviorBlocks,
  ];

  const isl = [
    `domain ${domainName} version "0.1.0" {`,
    '',
    ...sections,
    '',
    '}',
  ].join('\n');

  return Object.freeze({
    isl,
    confidence,
    warnings: Object.freeze(warnings),
  });
}
