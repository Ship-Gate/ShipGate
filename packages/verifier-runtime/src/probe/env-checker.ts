/**
 * Environment Variable Checker
 *
 * Verifies that environment variables declared in the Truthpack env index
 * actually exist at runtime, are non-empty, and are not placeholder values.
 */

import type {
  TruthpackEnvVar,
  EnvCheckResult,
  ProbeStatus,
} from './types.js';

// ── Public API ─────────────────────────────────────────────────────────────

export interface EnvCheckOptions {
  /** Custom env object to check against (defaults to process.env). */
  env?: Record<string, string | undefined>;
  /** Skip sensitive variables (default: false). */
  skipSensitive?: boolean;
  /** Verbose logging. */
  verbose?: boolean;
}

/**
 * Check all environment variables from the Truthpack.
 */
export function checkEnvVars(
  variables: TruthpackEnvVar[],
  options: EnvCheckOptions = {},
): EnvCheckResult[] {
  const env = options.env ?? (process.env as Record<string, string | undefined>);
  return variables.map((v) => checkSingleEnvVar(v, env, options));
}

/**
 * Check a single environment variable.
 */
export function checkSingleEnvVar(
  variable: TruthpackEnvVar,
  env: Record<string, string | undefined>,
  options: EnvCheckOptions = {},
): EnvCheckResult {
  if (options.skipSensitive && variable.sensitive) {
    return {
      variable,
      status: 'skip',
      exists: false,
      hasValue: false,
      isPlaceholder: false,
      error: 'Sensitive variable skipped',
    };
  }

  const value = env[variable.name];
  const exists = value !== undefined;
  const hasValue = exists && value.trim().length > 0;
  const isPlaceholder = hasValue ? detectPlaceholder(value) : false;

  let status: ProbeStatus;
  if (!exists) {
    status = variable.required ? 'fail' : 'warn';
  } else if (!hasValue) {
    status = variable.required ? 'fail' : 'warn';
  } else if (isPlaceholder) {
    status = 'warn';
  } else {
    status = 'pass';
  }

  if (options.verbose) {
    const icon = status === 'pass' ? '+' : status === 'fail' ? 'x' : '~';
    process.stderr.write(
      `  [env] [${icon}] ${variable.name} : ${status}${isPlaceholder ? ' (placeholder)' : ''}\n`,
    );
  }

  return {
    variable,
    status,
    exists,
    hasValue,
    isPlaceholder,
  };
}

// ── Placeholder Detection ──────────────────────────────────────────────────

const PLACEHOLDER_PATTERNS: RegExp[] = [
  /^your[_-]?/i,
  /^changeme$/i,
  /^replace[_-]?me$/i,
  /^xxx+$/i,
  /^todo$/i,
  /^fixme$/i,
  /^placeholder$/i,
  /^example$/i,
  /^test$/i,
  /^dummy$/i,
  /^fake$/i,
  /^sample$/i,
  /^sk_test_/i,
  /^pk_test_/i,
  /^insert[_-]?here$/i,
  /^<.*>$/,           // <YOUR_KEY_HERE>
  /^\[.*\]$/,         // [YOUR_KEY_HERE]
  /^\{.*\}$/,         // {YOUR_KEY_HERE}
];

/**
 * Detect if an env var value looks like a placeholder.
 */
function detectPlaceholder(value: string): boolean {
  const trimmed = value.trim();

  for (const pattern of PLACEHOLDER_PATTERNS) {
    if (pattern.test(trimmed)) return true;
  }

  return false;
}

/**
 * Get summary statistics for env check results.
 */
export function summarizeEnvResults(results: EnvCheckResult[]): {
  total: number;
  checked: number;
  passed: number;
  failed: number;
  skipped: number;
  placeholders: number;
} {
  return {
    total: results.length,
    checked: results.filter((r) => r.status !== 'skip').length,
    passed: results.filter((r) => r.status === 'pass').length,
    failed: results.filter((r) => r.status === 'fail').length,
    skipped: results.filter((r) => r.status === 'skip').length,
    placeholders: results.filter((r) => r.isPlaceholder).length,
  };
}
