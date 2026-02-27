// ============================================================================
// Round-Trip Parse Stability Tests
//
// For each ISL fixture:
//   1. Parse to AST
//   2. Unparse AST back to ISL text
//   3. Re-parse the serialized text
//   4. Assert: AST1 (structure) deep-equals AST2 (structure)
//
// This guarantees parse stability: parse(unparse(parse(x))) === parse(x)
// ============================================================================

import { describe, it, expect } from 'vitest';
import { parse, unparse } from '../src/index.js';
import * as fs from 'fs';
import * as path from 'path';

const FIXTURES_DIR = path.join(__dirname, 'round-trip-fixtures');

/**
 * Strip location and internal keys from AST for structural comparison.
 */
function stripForCompare(obj: unknown): unknown {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(stripForCompare);

  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    if (
      key === 'location' ||
      key === '_memberKind' ||
      key === '_kind' ||
      key === '_section' ||
      key === '_prop'
    ) {
      continue;
    }
    result[key] = stripForCompare(value);
  }
  return result;
}

/**
 * Deep equality for AST comparison (ignoring locations).
 */
function astEqual(a: unknown, b: unknown): boolean {
  const sa = JSON.stringify(stripForCompare(a));
  const sb = JSON.stringify(stripForCompare(b));
  return sa === sb;
}

function getFixtureFiles(): string[] {
  if (!fs.existsSync(FIXTURES_DIR)) return [];
  return fs
    .readdirSync(FIXTURES_DIR)
    .filter((f) => f.endsWith('.isl'))
    .map((f) => path.join(FIXTURES_DIR, f))
    .sort();
}

describe('Round-Trip Parse Stability', () => {
  const files = getFixtureFiles();

  if (files.length === 0) {
    it.skip('no fixtures found', () => {});
    return;
  }

  for (const filePath of files) {
    const baseName = path.basename(filePath);

    describe(baseName, () => {
      it('parse -> unparse -> re-parse yields equivalent AST', () => {
        const source = fs.readFileSync(filePath, 'utf-8');

        // Step 1: Parse to AST
        const result1 = parse(source, filePath);
        expect(result1.success, `Parse failed: ${result1.errors.map((e) => e.message).join('; ')}`).toBe(true);
        expect(result1.domain).toBeDefined();
        const ast1 = result1.domain!;

        // Step 2: Unparse AST to ISL text
        const serialized = unparse(ast1);

        // Step 3: Re-parse the serialized text
        const result2 = parse(serialized, `${baseName}.roundtrip`);
        expect(result2.success, `Re-parse failed: ${result2.errors.map((e) => e.message).join('; ')}`).toBe(true);
        expect(result2.domain).toBeDefined();
        const ast2 = result2.domain!;

        // Step 4: Assert structural equality
        expect(astEqual(ast1, ast2), `AST mismatch for ${baseName}`).toBe(true);
      });
    });
  }
});
