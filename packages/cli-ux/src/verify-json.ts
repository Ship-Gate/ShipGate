/**
 * Verification JSON Output Module
 *
 * Produces stable, schema-validated JSON output for `isl verify --json`.
 */

import type { VerifyResult, VerifyJsonOutput, OverallVerdict } from './verify-types.js';
import { validateVerifyJsonOutput, formatVerifyValidationErrors } from './verify-schema.js';
import { getVerifyExitCode } from './verify-renderer.js';

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const SCHEMA_VERSION = '1.0' as const;
const CLI_VERSION = '0.1.0';

// ─────────────────────────────────────────────────────────────────────────────
// JSON Output Generation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Options for JSON output
 */
export interface VerifyJsonOptions {
  /** Pretty print with indentation */
  pretty?: boolean;
  /** Validate output against schema */
  validate?: boolean;
  /** Custom CLI version */
  cliVersion?: string;
}

const DEFAULT_VERIFY_JSON_OPTIONS: Required<VerifyJsonOptions> = {
  pretty: true,
  validate: true,
  cliVersion: CLI_VERSION,
};

/**
 * Create JSON output structure
 */
export function createVerifyJsonOutput(
  result: VerifyResult,
  options: VerifyJsonOptions = {}
): VerifyJsonOutput {
  const opts = { ...DEFAULT_VERIFY_JSON_OPTIONS, ...options };

  return {
    schemaVersion: SCHEMA_VERSION,
    verdict: result.verdict,
    exitCode: getVerifyExitCode(result),
    result,
    meta: {
      cliVersion: opts.cliVersion,
      nodeVersion: process.version,
      platform: process.platform,
      timestamp: new Date().toISOString(),
    },
  };
}

/**
 * Result of JSON formatting
 */
export interface VerifyJsonFormatResult {
  /** JSON string output */
  output: string;
  /** Whether validation passed */
  valid: boolean;
  /** Validation errors if any */
  errors?: string[];
}

/**
 * Format verification result as JSON
 */
export function formatVerifyJson(
  result: VerifyResult,
  options: VerifyJsonOptions = {}
): VerifyJsonFormatResult {
  const opts = { ...DEFAULT_VERIFY_JSON_OPTIONS, ...options };
  const jsonOutput = createVerifyJsonOutput(result, opts);

  // Validate if requested
  if (opts.validate) {
    const validation = validateVerifyJsonOutput(jsonOutput);
    if (!validation.success) {
      return {
        output: '',
        valid: false,
        errors: validation.errors
          ? formatVerifyValidationErrors(validation.errors)
          : ['Unknown validation error'],
      };
    }
  }

  // Format output
  const output = opts.pretty
    ? JSON.stringify(jsonOutput, null, 2)
    : JSON.stringify(jsonOutput);

  return {
    output,
    valid: true,
  };
}

/**
 * Print JSON output to console
 */
export function printVerifyJson(
  result: VerifyResult,
  options: VerifyJsonOptions = {}
): boolean {
  const formatted = formatVerifyJson(result, options);

  if (!formatted.valid) {
    process.stderr.write(`JSON validation failed:\n`);
    for (const error of formatted.errors || []) {
      process.stderr.write(`  - ${error}\n`);
    }
    return false;
  }

  process.stdout.write(formatted.output + '\n');
  return true;
}

// ─────────────────────────────────────────────────────────────────────────────
// Parsing
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Parse result of JSON parsing
 */
export interface VerifyJsonParseResult {
  /** Parsed JSON output */
  data?: VerifyJsonOutput;
  /** Whether parsing succeeded */
  success: boolean;
  /** Parse/validation errors */
  errors?: string[];
}

/**
 * Parse JSON output from string
 */
export function parseVerifyJson(input: string): VerifyJsonParseResult {
  try {
    const parsed = JSON.parse(input);
    const validation = validateVerifyJsonOutput(parsed);

    if (!validation.success) {
      return {
        success: false,
        errors: validation.errors
          ? formatVerifyValidationErrors(validation.errors)
          : ['Unknown validation error'],
      };
    }

    return {
      success: true,
      data: validation.data,
    };
  } catch (e) {
    return {
      success: false,
      errors: [`JSON parse error: ${e instanceof Error ? e.message : 'Unknown error'}`],
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Utilities
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Key metrics from verification result
 */
export interface VerifyKeyMetrics {
  verdict: OverallVerdict;
  exitCode: 0 | 1 | 2;
  total: number;
  proven: number;
  failed: number;
  unknown: number;
}

/**
 * Get key metrics from verification result
 */
export function getVerifyKeyMetrics(result: VerifyResult): VerifyKeyMetrics {
  return {
    verdict: result.verdict,
    exitCode: getVerifyExitCode(result),
    total: result.summary.total,
    proven: result.summary.proven,
    failed: result.summary.failed,
    unknown: result.summary.unknown,
  };
}

/**
 * Create a minimal JSON output for quick checks
 */
export function createMinimalVerifyJson(result: VerifyResult): string {
  const metrics = getVerifyKeyMetrics(result);
  return JSON.stringify({
    verdict: metrics.verdict,
    exitCode: metrics.exitCode,
    proven: metrics.proven,
    failed: metrics.failed,
    unknown: metrics.unknown,
  });
}
