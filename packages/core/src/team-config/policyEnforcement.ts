/**
 * Policy Enforcement Engine
 *
 * Checks a verification result against the resolved team policies
 * and returns structured violations.
 *
 * Checks:
 *   1. Spec coverage meets minimum threshold
 *   2. Spec quality meets minimum threshold
 *   3. All required checks were executed
 *   4. Critical paths have spec coverage
 *   5. No banned patterns found in source files
 *   6. Security policy requirements are met
 */

import type {
  ResolvedConfig,
  PolicyVerifyInput,
  PolicyResult,
  PolicyViolation,
  PolicySeverity,
  BannedPattern,
} from './teamConfigTypes.js';

// ─────────────────────────────────────────────────────────────────────────────
// Glob matching (simple minimatch-like for critical paths)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Convert a simple glob pattern to a RegExp.
 * Supports: **, *, ?
 */
function globToRegex(pattern: string): RegExp {
  const escaped = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')     // escape regex special chars
    .replace(/\*\*/g, '{{GLOBSTAR}}')          // placeholder for **
    .replace(/\*/g, '[^/]*')                   // * = any non-separator
    .replace(/\?/g, '[^/]')                    // ? = single non-separator
    .replace(/\{\{GLOBSTAR\}\}/g, '.*');       // ** = anything including /

  return new RegExp(`^${escaped}$`);
}

/**
 * Test whether a file path matches a glob pattern.
 * Normalises path separators to forward slash before matching.
 */
function matchesGlob(filePath: string, pattern: string): boolean {
  const normalised = filePath.replace(/\\/g, '/');
  return globToRegex(pattern).test(normalised);
}

// ─────────────────────────────────────────────────────────────────────────────
// Core enforcement
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Enforce team policies against a verification result.
 *
 * @param input  - Data about the verification run (coverage, quality, checks)
 * @param config - Resolved team + repo config
 * @returns PolicyResult with violations and pass/fail verdict
 */
export function enforceTeamPolicies(
  input: PolicyVerifyInput,
  config: ResolvedConfig,
): PolicyResult {
  const violations: PolicyViolation[] = [];
  const { policies } = config;

  // ── 1. Check coverage requirement ──────────────────────────────────────
  checkCoverage(input, policies.minCoverage, violations);

  // ── 2. Check spec quality requirement ──────────────────────────────────
  checkSpecQuality(input, policies.minSpecQuality, violations);

  // ── 3. Check required checks were executed ─────────────────────────────
  checkRequiredChecks(input, policies.requiredChecks, violations);

  // ── 4. Check critical paths have specs ─────────────────────────────────
  checkCriticalPaths(input, policies.criticalPaths, violations);

  // ── 5. Check banned patterns ───────────────────────────────────────────
  checkBannedPatterns(input, policies.bannedPatterns, violations);

  // ── 6. Build result ────────────────────────────────────────────────────
  return buildResult(violations);
}

// ─────────────────────────────────────────────────────────────────────────────
// Individual policy checks
// ─────────────────────────────────────────────────────────────────────────────

function checkCoverage(
  input: PolicyVerifyInput,
  minCoverage: number,
  violations: PolicyViolation[],
): void {
  if (minCoverage <= 0) return;

  if (input.coverage.percentage < minCoverage) {
    violations.push({
      policy: 'min_coverage',
      message: `Coverage ${input.coverage.percentage}% below minimum ${minCoverage}%`,
      severity: 'error',
    });
  }
}

function checkSpecQuality(
  input: PolicyVerifyInput,
  minSpecQuality: number,
  violations: PolicyViolation[],
): void {
  if (minSpecQuality <= 0) return;
  if (input.specQuality === undefined) return;

  if (input.specQuality < minSpecQuality) {
    violations.push({
      policy: 'min_spec_quality',
      message: `Spec quality ${input.specQuality} below minimum ${minSpecQuality}`,
      severity: 'error',
    });
  }
}

function checkRequiredChecks(
  input: PolicyVerifyInput,
  requiredChecks: string[],
  violations: PolicyViolation[],
): void {
  if (requiredChecks.length === 0) return;

  const ran = new Set(input.checksRun);
  const missing = requiredChecks.filter((check) => !ran.has(check));

  if (missing.length > 0) {
    violations.push({
      policy: 'required_checks',
      message: `Missing required checks: ${missing.join(', ')}`,
      severity: 'error',
    });
  }
}

function checkCriticalPaths(
  input: PolicyVerifyInput,
  criticalPaths: string[],
  violations: PolicyViolation[],
): void {
  if (criticalPaths.length === 0) return;

  const coveredSet = new Set(
    input.coverage.coveredFiles.map((f) => f.replace(/\\/g, '/')),
  );

  for (const pattern of criticalPaths) {
    // Find all source files matching this critical path pattern
    const matchingFiles = input.sourceFiles.filter((f) => matchesGlob(f, pattern));

    // Find which matching files are NOT covered by specs
    const uncovered = matchingFiles.filter((f) => !coveredSet.has(f.replace(/\\/g, '/')));

    if (uncovered.length > 0) {
      violations.push({
        policy: 'critical_path_coverage',
        message: `Critical path '${pattern}' has ${uncovered.length} uncovered file${uncovered.length === 1 ? '' : 's'}`,
        severity: 'error',
        files: uncovered,
      });
    }
  }
}

function checkBannedPatterns(
  input: PolicyVerifyInput,
  bannedPatterns: BannedPattern[],
  violations: PolicyViolation[],
): void {
  if (bannedPatterns.length === 0) return;
  if (!input.sourceContents || input.sourceContents.size === 0) return;

  for (const banned of bannedPatterns) {
    const matchedFiles: string[] = [];

    for (const [filePath, content] of input.sourceContents) {
      if (contentMatchesPattern(content, banned.pattern)) {
        matchedFiles.push(filePath);
      }
    }

    if (matchedFiles.length > 0) {
      violations.push({
        policy: 'banned_pattern',
        message: `Banned pattern '${banned.pattern}' found: ${banned.reason}`,
        severity: banned.severity,
        files: matchedFiles,
      });
    }
  }
}

/**
 * Test whether file content contains a banned pattern.
 * Tries the pattern as a regex first, falls back to literal string search.
 */
function contentMatchesPattern(content: string, pattern: string): boolean {
  try {
    const regex = new RegExp(pattern);
    return regex.test(content);
  } catch {
    // Pattern is not valid regex — treat as literal string search
    return content.includes(pattern);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Result builder
// ─────────────────────────────────────────────────────────────────────────────

function buildResult(violations: PolicyViolation[]): PolicyResult {
  const counts = countBySeverity(violations);

  return {
    violations,
    passed: counts.errors === 0,
    summary: counts,
  };
}

function countBySeverity(violations: PolicyViolation[]): {
  errors: number;
  warnings: number;
  infos: number;
} {
  let errors = 0;
  let warnings = 0;
  let infos = 0;

  for (const v of violations) {
    switch (v.severity) {
      case 'error':
        errors++;
        break;
      case 'warning':
        warnings++;
        break;
      case 'info':
        infos++;
        break;
    }
  }

  return { errors, warnings, infos };
}

// ─────────────────────────────────────────────────────────────────────────────
// Formatting (for CLI output)
// ─────────────────────────────────────────────────────────────────────────────

/** Severity → symbol for terminal output */
const SEVERITY_SYMBOLS: Record<PolicySeverity, string> = {
  error: '\u2716',     // ✖
  warning: '\u26A0',   // ⚠
  info: '\u2139',      // ℹ
};

/**
 * Format a PolicyResult into a human-readable report string.
 */
export function formatPolicyResult(result: PolicyResult, teamName?: string | null): string {
  const lines: string[] = [];

  // Header
  const header = teamName
    ? `Policy check (team: ${teamName})`
    : 'Policy check';
  lines.push(header);
  lines.push('─'.repeat(header.length));

  if (result.violations.length === 0) {
    lines.push('All policies passed.');
    return lines.join('\n');
  }

  // Group violations by severity
  for (const severity of ['error', 'warning', 'info'] as const) {
    const group = result.violations.filter((v) => v.severity === severity);
    if (group.length === 0) continue;

    for (const v of group) {
      lines.push(`  ${SEVERITY_SYMBOLS[severity]} [${v.policy}] ${v.message}`);
      if (v.files && v.files.length > 0) {
        const shown = v.files.slice(0, 5);
        for (const f of shown) {
          lines.push(`    - ${f}`);
        }
        if (v.files.length > 5) {
          lines.push(`    ... and ${v.files.length - 5} more`);
        }
      }
    }
  }

  // Summary
  lines.push('');
  const parts: string[] = [];
  if (result.summary.errors > 0) parts.push(`${result.summary.errors} error(s)`);
  if (result.summary.warnings > 0) parts.push(`${result.summary.warnings} warning(s)`);
  if (result.summary.infos > 0) parts.push(`${result.summary.infos} info(s)`);
  lines.push(`Result: ${result.passed ? 'PASSED' : 'FAILED'} — ${parts.join(', ')}`);

  return lines.join('\n');
}
