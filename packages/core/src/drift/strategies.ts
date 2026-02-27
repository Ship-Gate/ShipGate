/**
 * Drift Detection Strategies
 *
 * Four strategies for detecting spec ↔ implementation drift:
 *   1. Timestamp-based  — spec older than code → potential drift
 *   2. Signature-based  — function signatures changed since spec was written
 *   3. Behavior-based   — new code paths exist that spec doesn't cover
 *   4. Dependency-based — imports/dependencies changed
 */

import type { Behavior, Domain, InputSpec } from '@isl-lang/parser';
import type {
  DriftIndicator,
  ExtractedFunction,
  ExtractedImport,
  CodeLocation,
} from './driftTypes.js';

// ============================================================================
// 1. TIMESTAMP STRATEGY
// ============================================================================

/**
 * Detect drift based on file modification timestamps.
 *
 * If the implementation was modified after the spec, the spec may be stale.
 * Severity scales with how long ago the spec was last updated relative to code.
 *
 * @param specFile  - Path to the ISL spec
 * @param implFile  - Path to the implementation
 * @param specMtime - Last modification time of the spec
 * @param implMtime - Last modification time of the implementation
 * @returns Array of timestamp-based drift indicators
 */
export function detectTimestampDrift(
  specFile: string,
  implFile: string,
  specMtime: Date,
  implMtime: Date,
): DriftIndicator[] {
  const indicators: DriftIndicator[] = [];

  if (implMtime <= specMtime) {
    return indicators;
  }

  const daysDiff = daysBetween(specMtime, implMtime);

  if (daysDiff > 0) {
    indicators.push({
      type: 'structural_change',
      description: `Code modified ${daysDiff} day${daysDiff !== 1 ? 's' : ''} after spec`,
      severity: daysDiff > 30 ? 'high' : daysDiff > 7 ? 'medium' : 'low',
      codeLocation: { file: implFile, line: 0 },
      specLocation: { file: specFile, line: 0 },
    });
  }

  return indicators;
}

// ============================================================================
// 2. SIGNATURE STRATEGY
// ============================================================================

/**
 * Detect drift by comparing function signatures against spec behaviors.
 *
 * For each exported function in the implementation, check whether a
 * matching ISL behavior exists and whether its input fields align.
 *
 * @param specFile    - Path to the ISL spec
 * @param implFile    - Path to the implementation
 * @param domain      - Parsed ISL domain (may be undefined if parse fails)
 * @param implFns     - Extracted function signatures from implementation
 * @returns Array of signature-based drift indicators
 */
export function detectSignatureDrift(
  specFile: string,
  implFile: string,
  domain: Domain | undefined,
  implFns: ExtractedFunction[],
): DriftIndicator[] {
  const indicators: DriftIndicator[] = [];

  if (!domain) return indicators;

  const behaviors = domain.behaviors ?? [];
  const exportedFns = implFns.filter((fn) => fn.exported);

  for (const fn of exportedFns) {
    const matchingBehavior = findMatchingBehavior(fn.name, behaviors);

    if (!matchingBehavior) {
      // Not every exported function needs a behavior — skip internal helpers.
      // But if the function looks like a behavior (not prefixed with _ or internal),
      // flag it.
      if (!isLikelyHelper(fn.name)) {
        indicators.push({
          type: 'new_behavior',
          description: `Function '${fn.name}' has no matching ISL behavior`,
          severity: 'medium',
          codeLocation: { file: implFile, line: fn.line },
        });
      }
    } else if (signaturesConflict(fn, matchingBehavior)) {
      indicators.push({
        type: 'signature_change',
        description: `'${fn.name}' signature differs from spec behavior '${matchingBehavior.name.name}'`,
        severity: 'high',
        codeLocation: { file: implFile, line: fn.line },
        specLocation: {
          file: specFile,
          line: matchingBehavior.location?.line ?? 0,
        },
      });
    }
  }

  return indicators;
}

// ============================================================================
// 3. BEHAVIOR STRATEGY
// ============================================================================

/**
 * Detect drift by checking whether spec behaviors still have matching
 * implementations.
 *
 * A behavior in the spec that has no corresponding function in the
 * implementation is a "removed behavior" — the spec promises something
 * the code no longer provides.
 *
 * @param specFile  - Path to the ISL spec
 * @param implFile  - Path to the implementation
 * @param domain    - Parsed ISL domain
 * @param implFns   - Extracted function signatures from implementation
 * @returns Array of behavior-based drift indicators
 */
export function detectBehaviorDrift(
  specFile: string,
  implFile: string,
  domain: Domain | undefined,
  implFns: ExtractedFunction[],
): DriftIndicator[] {
  const indicators: DriftIndicator[] = [];

  if (!domain) return indicators;

  const behaviors = domain.behaviors ?? [];
  const fnNames = new Set(implFns.map((fn) => fn.name.toLowerCase()));

  for (const behavior of behaviors) {
    const behaviorName = behavior.name.name;
    const normalized = normalizeName(behaviorName);

    // Check if any function matches this behavior
    const hasMatch = fnNames.has(normalized) ||
      implFns.some((fn) => normalizeName(fn.name) === normalized);

    if (!hasMatch) {
      indicators.push({
        type: 'removed_behavior',
        description: `Spec behavior '${behaviorName}' has no matching implementation`,
        severity: 'high',
        codeLocation: { file: implFile, line: 0 },
        specLocation: {
          file: specFile,
          line: behavior.location?.line ?? 0,
        },
      });
    }
  }

  return indicators;
}

// ============================================================================
// 4. DEPENDENCY STRATEGY
// ============================================================================

/**
 * Detect drift by analyzing import changes.
 *
 * If the implementation imports modules that the spec doesn't reference
 * (e.g., a new payment provider), it may indicate new behavior the spec
 * should describe.
 *
 * Focuses on "significant" imports — not internal utilities or type imports,
 * but external packages and domain-relevant modules.
 *
 * @param specFile    - Path to the ISL spec
 * @param implFile    - Path to the implementation
 * @param domain      - Parsed ISL domain
 * @param implImports - Extracted imports from implementation
 * @returns Array of dependency-based drift indicators
 */
export function detectDependencyDrift(
  specFile: string,
  implFile: string,
  domain: Domain | undefined,
  implImports: ExtractedImport[],
): DriftIndicator[] {
  const indicators: DriftIndicator[] = [];

  // Collect "significant" non-type imports (external packages, domain modules)
  const significantImports = implImports.filter((imp) => {
    // Skip type-only imports
    if (imp.typeOnly) return false;
    // Skip relative imports to sibling utilities
    if (imp.source.startsWith('./') || imp.source.startsWith('../')) return false;
    // Skip Node.js built-ins
    if (isNodeBuiltin(imp.source)) return false;
    return true;
  });

  if (significantImports.length === 0) return indicators;

  // Extract spec "uses" / "imports" for comparison
  const specDeps = new Set<string>();
  if (domain) {
    for (const use of domain.uses ?? []) {
      const moduleName = use.module.kind === 'Identifier'
        ? use.module.name
        : use.module.value;
      specDeps.add(moduleName.toLowerCase());
    }
    for (const imp of domain.imports ?? []) {
      specDeps.add(imp.from.value.toLowerCase());
    }
  }

  // Flag external packages not referenced in spec
  for (const imp of significantImports) {
    const pkgName = imp.source.toLowerCase();
    // If the spec has no domain (parsing failed), or this import isn't referenced
    if (!domain || !specDeps.has(pkgName)) {
      // Only flag packages that look domain-relevant (not dev tools)
      if (isDomainRelevantPackage(imp.source)) {
        indicators.push({
          type: 'dependency_change',
          description: `Import '${imp.source}' not referenced in ISL spec`,
          severity: 'low',
          codeLocation: { file: implFile, line: imp.line },
        });
      }
    }
  }

  return indicators;
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Find a behavior in the spec that matches a function name.
 * Uses normalized names (camelCase ↔ kebab-case ↔ snake_case).
 */
export function findMatchingBehavior(
  fnName: string,
  behaviors: Behavior[],
): Behavior | undefined {
  const normalized = normalizeName(fnName);

  return behaviors.find((b) => {
    const behaviorNorm = normalizeName(b.name.name);
    return behaviorNorm === normalized;
  });
}

/**
 * Check if a function signature conflicts with a behavior's input spec.
 *
 * A "conflict" means the function has parameters the behavior doesn't
 * describe, or vice versa. This is a lightweight heuristic — not a
 * full type-checker.
 */
export function signaturesConflict(
  fn: ExtractedFunction,
  behavior: Behavior,
): boolean {
  const inputFields = behavior.input?.fields ?? [];
  const specParamNames = new Set(
    inputFields.map((f) => f.name.name.toLowerCase()),
  );
  const implParamNames = new Set(fn.params.map((p) => p.toLowerCase()));

  // If the function has no params and the spec has no input, they agree
  if (implParamNames.size === 0 && specParamNames.size === 0) {
    return false;
  }

  // Check for significant param count mismatch
  const sizeDiff = Math.abs(implParamNames.size - specParamNames.size);
  if (sizeDiff >= 2) {
    return true;
  }

  // Check for params in impl but not in spec
  let mismatches = 0;
  for (const param of implParamNames) {
    if (!specParamNames.has(param)) {
      mismatches++;
    }
  }

  // Allow 1 extra param (common for options/config objects)
  return mismatches >= 2;
}

/**
 * Normalize a name for comparison across naming conventions.
 *
 * Converts camelCase, PascalCase, snake_case, and kebab-case
 * to a single lowercase form.
 */
export function normalizeName(name: string): string {
  return name
    .replace(/([a-z])([A-Z])/g, '$1_$2')  // camelCase → camel_Case
    .replace(/[-\s]+/g, '_')               // kebab-case → kebab_case
    .toLowerCase()
    .replace(/_+/g, '_')                   // collapse multiple underscores
    .replace(/^_|_$/g, '');                // trim leading/trailing _
}

/**
 * Check if a function name looks like a helper (prefixed with _ or
 * common utility patterns like get*, set*, is*, validate*, format*, etc.).
 */
function isLikelyHelper(name: string): boolean {
  if (name.startsWith('_')) return true;
  const helperPrefixes = ['get', 'set', 'is', 'has', 'to', 'from', 'parse', 'format', 'validate', 'normalize'];
  // Check the original name (not lowered) so we can detect camelCase boundary
  return helperPrefixes.some((prefix) => {
    const lower = name.toLowerCase();
    if (lower === prefix) return true;
    if (!lower.startsWith(prefix)) return false;
    // The character after the prefix should be uppercase (camelCase boundary)
    // or an underscore (snake_case boundary)
    const boundary = name[prefix.length];
    return boundary !== undefined && (/[A-Z_]/.test(boundary));
  });
}

/**
 * Check if a module name is a Node.js built-in.
 */
function isNodeBuiltin(source: string): boolean {
  const builtins = new Set([
    'fs', 'path', 'os', 'http', 'https', 'url', 'util', 'crypto',
    'stream', 'events', 'buffer', 'child_process', 'cluster', 'dns',
    'net', 'readline', 'tls', 'zlib', 'assert', 'querystring',
    'string_decoder', 'timers', 'tty', 'v8', 'vm', 'worker_threads',
    'fs/promises', 'node:fs', 'node:path', 'node:os', 'node:http',
    'node:crypto', 'node:url', 'node:util', 'node:stream', 'node:events',
    'node:fs/promises', 'node:child_process', 'node:worker_threads',
  ]);
  return builtins.has(source);
}

/**
 * Check if a package name looks domain-relevant (vs. dev tooling).
 *
 * We flag packages like 'stripe', 'auth0', 'redis' but skip
 * tooling like 'chalk', 'ora', 'tsup'.
 */
function isDomainRelevantPackage(source: string): boolean {
  const devTools = new Set([
    'chalk', 'ora', 'tsup', 'typescript', 'vitest', 'jest', 'prettier',
    'eslint', 'rimraf', 'glob', 'minimatch', 'commander', 'yargs',
    'debug', 'dotenv', 'chokidar', 'picomatch', 'fast-glob',
  ]);
  const baseName = source.startsWith('@')
    ? source.split('/').slice(0, 2).join('/')
    : source.split('/')[0];
  return !devTools.has(baseName);
}

/**
 * Calculate the number of full days between two dates.
 */
export function daysBetween(earlier: Date, later: Date): number {
  const ms = later.getTime() - earlier.getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}
