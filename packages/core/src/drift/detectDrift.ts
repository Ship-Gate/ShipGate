/**
 * Drift Detector — Main Entry Point
 *
 * Orchestrates the four drift detection strategies to produce a DriftReport
 * for a spec ↔ implementation pair, and provides batch scanning across
 * an entire project directory.
 */

import { readFile, stat, readdir } from 'fs/promises';
import { join, basename, extname, relative, resolve } from 'path';
import type { Domain } from '@isl-lang/parser';
import type {
  DriftReport,
  DriftIndicator,
  DriftConfig,
  DriftScanSummary,
  SpecImplPair,
} from './driftTypes.js';
import { DEFAULT_DRIFT_CONFIG } from './driftTypes.js';
import { extractFunctions, extractImports } from './extract.js';
import {
  detectTimestampDrift,
  detectSignatureDrift,
  detectBehaviorDrift,
  detectDependencyDrift,
} from './strategies.js';
import { calculateDriftScore, scoreSeverity } from './score.js';

// ============================================================================
// SINGLE PAIR DETECTION
// ============================================================================

/**
 * Detect drift between a single ISL spec file and its implementation.
 *
 * Runs all four strategies (timestamp, signature, behavior, dependency)
 * and produces a unified DriftReport with a composite score.
 *
 * @param specFile - Path to the ISL spec file
 * @param implFile - Path to the implementation file
 * @returns DriftReport describing the spec ↔ code alignment
 *
 * @example
 * ```typescript
 * const report = await detectDrift('specs/auth.isl', 'src/auth/login.ts');
 * if (report.driftScore > 50) {
 *   console.warn(`High drift: ${report.driftScore}/100`);
 * }
 * ```
 */
export async function detectDrift(
  specFile: string,
  implFile: string,
): Promise<DriftReport> {
  // Read both files
  const [specContent, implContent, specStat, implStat] = await Promise.all([
    readFile(specFile, 'utf-8'),
    readFile(implFile, 'utf-8'),
    stat(specFile),
    stat(implFile),
  ]);

  const specMtime = specStat.mtime;
  const implMtime = implStat.mtime;

  // Parse the ISL spec (best-effort — if parsing fails, we still run
  // strategies that don't need the AST)
  const domain = tryParseSpec(specContent);

  // Extract implementation structure
  const implFunctions = extractFunctions(implContent);
  const implImports = extractImports(implContent);

  // Run all four strategies
  const indicators: DriftIndicator[] = [
    ...detectTimestampDrift(specFile, implFile, specMtime, implMtime),
    ...detectSignatureDrift(specFile, implFile, domain, implFunctions),
    ...detectBehaviorDrift(specFile, implFile, domain, implFunctions),
    ...detectDependencyDrift(specFile, implFile, domain, implImports),
  ];

  const driftScore = calculateDriftScore(indicators);

  return {
    file: implFile,
    spec: specFile,
    driftScore,
    severity: scoreSeverity(driftScore),
    lastCodeChange: implMtime,
    lastSpecChange: specMtime,
    indicators,
  };
}

// ============================================================================
// BATCH SCANNING
// ============================================================================

/**
 * Scan a directory for all spec ↔ implementation pairs and check for drift.
 *
 * Uses convention-based matching: a spec named `login.isl` is matched
 * against implementation files like `login.ts`, `login.tsx`, etc.
 *
 * @param config - Drift detection configuration
 * @returns Summary of all drift reports
 *
 * @example
 * ```typescript
 * const summary = await scanForDrift({ rootDir: '/path/to/project' });
 * console.log(`${summary.drifted} of ${summary.totalSpecs} specs may need updating.`);
 * ```
 */
export async function scanForDrift(
  config: DriftConfig,
): Promise<DriftScanSummary> {
  const startTime = Date.now();
  const rootDir = resolve(config.rootDir);

  // Find all spec files
  const specFiles = await findFiles(rootDir, config.specPatterns ?? [...DEFAULT_DRIFT_CONFIG.specPatterns], config.ignorePatterns ?? [...DEFAULT_DRIFT_CONFIG.ignorePatterns]);

  // Find all implementation files
  const implFiles = await findFiles(rootDir, config.implPatterns ?? [...DEFAULT_DRIFT_CONFIG.implPatterns], config.ignorePatterns ?? [...DEFAULT_DRIFT_CONFIG.ignorePatterns]);

  // Build pairs
  const pairs = matchSpecsToImpls(specFiles, implFiles);

  // Run drift detection on each pair
  const reports: DriftReport[] = [];
  for (const pair of pairs) {
    try {
      const report = await detectDrift(pair.specFile, pair.implFile);
      reports.push(report);
    } catch {
      // If a pair fails (e.g., file not readable), skip it
    }
  }

  const threshold = config.highThreshold ?? DEFAULT_DRIFT_CONFIG.highThreshold;

  return {
    totalSpecs: reports.length,
    inSync: reports.filter((r) => r.driftScore === 0).length,
    drifted: reports.filter((r) => r.driftScore > 0).length,
    highDrift: reports.filter((r) => r.driftScore >= threshold).length,
    averageScore:
      reports.length > 0
        ? Math.round(reports.reduce((sum, r) => sum + r.driftScore, 0) / reports.length)
        : 0,
    reports,
    timestamp: new Date(),
    durationMs: Date.now() - startTime,
  };
}

// ============================================================================
// SPEC MATCHING
// ============================================================================

/**
 * Find the matching spec file for an implementation file.
 *
 * Searches for a spec with the same base name (e.g., `login.ts` → `login.isl`).
 *
 * @param implFile - Path to the implementation file
 * @param specDir  - Directory containing spec files (optional, defaults to searching upward)
 * @returns Path to the matching spec file, or undefined
 */
export async function findMatchingSpec(
  implFile: string,
  specDir?: string,
): Promise<string | undefined> {
  const implBase = basename(implFile, extname(implFile));

  if (specDir) {
    const candidate = join(specDir, `${implBase}.isl`);
    if (await fileExists(candidate)) return candidate;
  }

  // Search in common spec locations relative to the file
  const implDir = join(implFile, '..');
  const candidates = [
    join(implDir, `${implBase}.isl`),
    join(implDir, '..', 'specs', `${implBase}.isl`),
    join(implDir, '..', `${implBase}.isl`),
    join(implDir, 'specs', `${implBase}.isl`),
  ];

  for (const candidate of candidates) {
    if (await fileExists(candidate)) return candidate;
  }

  return undefined;
}

/**
 * Match spec files to implementation files by name convention.
 */
export function matchSpecsToImpls(
  specFiles: string[],
  implFiles: string[],
): SpecImplPair[] {
  const pairs: SpecImplPair[] = [];

  // Build a map of base name → impl files
  const implMap = new Map<string, string[]>();
  for (const implFile of implFiles) {
    const base = basename(implFile, extname(implFile)).toLowerCase();
    const existing = implMap.get(base) ?? [];
    existing.push(implFile);
    implMap.set(base, existing);
  }

  for (const specFile of specFiles) {
    const specBase = basename(specFile, '.isl').toLowerCase();
    const matching = implMap.get(specBase);

    if (matching && matching.length > 0) {
      // Prefer the first match (typically there's only one)
      pairs.push({
        specFile,
        implFile: matching[0],
      });
    }
  }

  return pairs;
}

// ============================================================================
// FILE UTILITIES
// ============================================================================

/**
 * Recursively find files matching patterns in a directory.
 *
 * Uses a simple recursive readdir — avoids external dependencies.
 */
async function findFiles(
  dir: string,
  patterns: string[],
  ignorePatterns: string[],
): Promise<string[]> {
  const results: string[] = [];

  // Extract file extensions from glob patterns for fast matching
  const extensions = patterns
    .map((p) => {
      const match = p.match(/\*(\.\w+)$/);
      return match ? match[1] : null;
    })
    .filter((ext): ext is string => ext !== null);

  await walkDir(dir, extensions, ignorePatterns, results);
  return results;
}

/**
 * Recursive directory walker.
 */
async function walkDir(
  dir: string,
  extensions: string[],
  ignorePatterns: string[],
  results: string[],
): Promise<void> {
  try {
    const entries = await readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = join(dir, entry.name);

      // Check ignore patterns
      if (shouldIgnore(fullPath, ignorePatterns)) continue;

      if (entry.isDirectory()) {
        await walkDir(fullPath, extensions, ignorePatterns, results);
      } else if (entry.isFile()) {
        const ext = extname(entry.name);
        if (extensions.length === 0 || extensions.includes(ext)) {
          results.push(fullPath);
        }
      }
    }
  } catch {
    // Directory not readable — skip
  }
}

/**
 * Check if a path should be ignored.
 */
function shouldIgnore(filePath: string, ignorePatterns: string[]): boolean {
  const normalized = filePath.replace(/\\/g, '/');
  return ignorePatterns.some((pattern) => {
    const cleaned = pattern.replace(/\*\*/g, '').replace(/\*/g, '');
    return normalized.includes(cleaned.replace(/\//g, '/').replace(/^\/|\/$/g, ''));
  });
}

/**
 * Check if a file exists.
 */
async function fileExists(filePath: string): Promise<boolean> {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
}

// ============================================================================
// SPEC PARSING
// ============================================================================

/**
 * Attempt to parse an ISL spec. Returns the Domain if successful,
 * or undefined if parsing fails. This is a best-effort operation —
 * drift detection continues even without a parsed AST.
 */
function tryParseSpec(content: string): Domain | undefined {
  try {
    // Dynamic import to avoid hard dependency on parser at module level.
    // In practice the parser is a workspace dependency of @isl-lang/core.
    //
    // We use a lightweight regex extraction as fallback when the parser
    // isn't available or fails.
    return parseSpecLightweight(content);
  } catch {
    return undefined;
  }
}

/**
 * Lightweight spec parser that extracts domain structure from ISL source
 * using regex patterns. This is NOT a full parser — it extracts just enough
 * structure for drift detection.
 */
function parseSpecLightweight(content: string): Domain | undefined {
  const lines = content.split('\n');

  // Find domain declaration
  const domainMatch = content.match(/domain\s+(\w+)\s*@\s*"([^"]+)"/);
  if (!domainMatch) return undefined;

  const domainName = domainMatch[1];
  const domainVersion = domainMatch[2];

  // Extract behaviors
  const behaviors: Domain['behaviors'] = [];
  const behaviorRegex = /behavior\s+(\w+)/g;
  let match: RegExpExecArray | null;

  while ((match = behaviorRegex.exec(content)) !== null) {
    const behaviorName = match[1];
    const offset = content.slice(0, match.index).split('\n').length;

    // Extract input fields for this behavior
    const inputFields = extractBehaviorInputFields(content, match.index);

    behaviors.push({
      kind: 'Behavior',
      name: {
        kind: 'Identifier',
        name: behaviorName,
        location: { file: '', line: offset, column: 0, endLine: offset, endColumn: 0 },
      },
      input: {
        kind: 'InputSpec',
        fields: inputFields,
        location: { file: '', line: offset, column: 0, endLine: offset, endColumn: 0 },
      },
      output: {
        kind: 'OutputSpec',
        success: { kind: 'PrimitiveType', name: 'String', location: { file: '', line: 0, column: 0, endLine: 0, endColumn: 0 } },
        errors: [],
        location: { file: '', line: 0, column: 0, endLine: 0, endColumn: 0 },
      },
      preconditions: [],
      postconditions: [],
      invariants: [],
      temporal: [],
      security: [],
      compliance: [],
      location: { file: '', line: offset, column: 0, endLine: offset, endColumn: 0 },
    } as Domain['behaviors'][number]);
  }

  // Extract uses
  const uses: Domain['uses'] = [];
  const useRegex = /use\s+(\S+)/g;
  while ((match = useRegex.exec(content)) !== null) {
    const moduleName = match[1].replace(/;$/, '');
    const offset = content.slice(0, match.index).split('\n').length;
    uses.push({
      kind: 'UseStatement',
      module: {
        kind: 'Identifier',
        name: moduleName,
        location: { file: '', line: offset, column: 0, endLine: offset, endColumn: 0 },
      },
      location: { file: '', line: offset, column: 0, endLine: offset, endColumn: 0 },
    } as Domain['uses'][number]);
  }

  return {
    kind: 'Domain',
    name: {
      kind: 'Identifier',
      name: domainName,
      location: { file: '', line: 1, column: 0, endLine: 1, endColumn: 0 },
    },
    version: {
      kind: 'StringLiteral',
      value: domainVersion,
      location: { file: '', line: 1, column: 0, endLine: 1, endColumn: 0 },
    },
    uses,
    imports: [],
    types: [],
    entities: [],
    behaviors,
    invariants: [],
    policies: [],
    views: [],
    scenarios: [],
    chaos: [],
    location: { file: '', line: 1, column: 0, endLine: lines.length, endColumn: 0 },
  };
}

/**
 * Extract input field names from a behavior block in ISL source.
 */
function extractBehaviorInputFields(
  content: string,
  behaviorStart: number,
): Domain['behaviors'][number]['input']['fields'] {
  // Find the input block after the behavior declaration
  const afterBehavior = content.slice(behaviorStart, behaviorStart + 2000);
  const inputMatch = afterBehavior.match(/input\s*\{([^}]*)\}/s);
  if (!inputMatch) return [];

  const inputBlock = inputMatch[1];
  const fields: Domain['behaviors'][number]['input']['fields'] = [];
  const fieldRegex = /(\w+)\s*:\s*(\w+)/g;
  let fieldMatch: RegExpExecArray | null;

  while ((fieldMatch = fieldRegex.exec(inputBlock)) !== null) {
    fields.push({
      kind: 'Field',
      name: {
        kind: 'Identifier',
        name: fieldMatch[1],
        location: { file: '', line: 0, column: 0, endLine: 0, endColumn: 0 },
      },
      type: {
        kind: 'PrimitiveType',
        name: 'String',
        location: { file: '', line: 0, column: 0, endLine: 0, endColumn: 0 },
      },
      optional: false,
      annotations: [],
      location: { file: '', line: 0, column: 0, endLine: 0, endColumn: 0 },
    } as Domain['behaviors'][number]['input']['fields'][number]);
  }

  return fields;
}
