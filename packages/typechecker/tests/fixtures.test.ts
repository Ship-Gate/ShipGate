// ============================================================================
// Golden Test Fixtures for TypeChecker
// ============================================================================

import { describe, it, expect } from 'vitest';
import { readdir, readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from '@isl-lang/parser';
import { check } from '../src/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const fixturesDir = join(__dirname, 'fixtures');

/**
 * Normalize diagnostics for comparison (remove non-deterministic fields)
 */
function normalizeDiagnostics(diagnostics: unknown[]): unknown[] {
  return diagnostics.map((diag: unknown) => {
    const d = diag as Record<string, unknown>;
    // Remove source if it's just 'typechecker' (always the same)
    const normalized: Record<string, unknown> = {
      code: d.code,
      severity: d.severity,
      message: d.message,
      location: d.location,
    };
    
    if (d.relatedInformation) {
      normalized.relatedInformation = d.relatedInformation;
    }
    if (d.notes) {
      normalized.notes = d.notes;
    }
    if (d.help) {
      normalized.help = d.help;
    }
    
    return normalized;
  });
}

/**
 * Compare two diagnostic arrays
 */
function compareDiagnostics(actual: unknown[], expected: unknown[]): {
  match: boolean;
  diff?: string;
} {
  const normalizedActual = normalizeDiagnostics(actual);
  const normalizedExpected = normalizeDiagnostics(expected);
  
  if (normalizedActual.length !== normalizedExpected.length) {
    return {
      match: false,
      diff: `Expected ${normalizedExpected.length} diagnostics, got ${normalizedActual.length}`,
    };
  }
  
  // Sort by location for stable comparison
  const sortByLocation = (diags: unknown[]) => {
    return [...diags].sort((a, b) => {
      const locA = (a as { location: { file: string; line: number; column: number } }).location;
      const locB = (b as { location: { file: string; line: number; column: number } }).location;
      if (locA.file !== locB.file) return locA.file.localeCompare(locB.file);
      if (locA.line !== locB.line) return locA.line - locB.line;
      return locA.column - locB.column;
    });
  };
  
  const sortedActual = sortByLocation(normalizedActual);
  const sortedExpected = sortByLocation(normalizedExpected);
  
  for (let i = 0; i < sortedActual.length; i++) {
    const actualDiag = sortedActual[i] as Record<string, unknown>;
    const expectedDiag = sortedExpected[i] as Record<string, unknown>;
    
    // Compare key fields
    if (actualDiag.code !== expectedDiag.code) {
      return {
        match: false,
        diff: `Diagnostic ${i}: code mismatch. Expected '${expectedDiag.code}', got '${actualDiag.code}'`,
      };
    }
    
    if (actualDiag.severity !== expectedDiag.severity) {
      return {
        match: false,
        diff: `Diagnostic ${i}: severity mismatch. Expected '${expectedDiag.severity}', got '${actualDiag.severity}'`,
      };
    }
    
    // Message comparison (allow partial match for flexibility)
    const actualMsg = String(actualDiag.message || '');
    const expectedMsg = String(expectedDiag.message || '');
    if (!actualMsg.includes(expectedMsg) && !expectedMsg.includes(actualMsg)) {
      return {
        match: false,
        diff: `Diagnostic ${i}: message mismatch. Expected contains '${expectedMsg}', got '${actualMsg}'`,
      };
    }
    
    // Location comparison (file and line should match)
    const actualLoc = actualDiag.location as { file: string; line: number };
    const expectedLoc = expectedDiag.location as { file: string; line: number };
    if (actualLoc.file !== expectedLoc.file || actualLoc.line !== expectedLoc.line) {
      return {
        match: false,
        diff: `Diagnostic ${i}: location mismatch. Expected ${expectedLoc.file}:${expectedLoc.line}, got ${actualLoc.file}:${actualLoc.line}`,
      };
    }
  }
  
  return { match: true };
}

describe('TypeChecker Fixtures', () => {
  // Find all fixture files
  const fixtureFiles = await readdir(fixturesDir);
  const specFiles = fixtureFiles.filter(f => f.endsWith('.isl') && !f.includes('circular-a') && !f.includes('circular-b'));
  
  for (const specFile of specFiles) {
    const specPath = join(fixturesDir, specFile);
    const expectedPath = join(fixturesDir, specFile.replace('.isl', '.expected.json'));
    
    it(`should match expected diagnostics for ${specFile}`, async () => {
      // Read spec file
      const specContent = await readFile(specPath, 'utf-8');
      
      // Parse
      const parseResult = parse(specContent, specPath);
      if (!parseResult.success || !parseResult.domain) {
        throw new Error(`Parse failed for ${specFile}: ${parseResult.errors.map(e => e.message).join(', ')}`);
      }
      
      // Typecheck
      const result = check(parseResult.domain);
      
      // Read expected diagnostics
      let expectedDiagnostics: unknown[] = [];
      try {
        const expectedContent = await readFile(expectedPath, 'utf-8');
        expectedDiagnostics = JSON.parse(expectedContent);
      } catch (err) {
        // If expected file doesn't exist, expect no errors
        expectedDiagnostics = [];
      }
      
      // Compare
      const comparison = compareDiagnostics(result.diagnostics, expectedDiagnostics);
      
      if (!comparison.match) {
        console.error(`\nActual diagnostics for ${specFile}:`);
        console.error(JSON.stringify(result.diagnostics, null, 2));
        console.error(`\nExpected diagnostics:`);
        console.error(JSON.stringify(expectedDiagnostics, null, 2));
      }
      
      expect(comparison.match, comparison.diff).toBe(true);
    });
  }
});
