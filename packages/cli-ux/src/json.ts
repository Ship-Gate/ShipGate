/**
 * JSON Output Module
 *
 * Produces stable, schema-validated JSON output for CI/CD integration.
 */

import type { VerificationResult, JsonOutput } from './types.js';
import { validateJsonOutput, formatValidationErrors } from './schema.js';

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
export interface JsonOutputOptions {
  /** Pretty print with indentation */
  pretty?: boolean;
  /** Validate output against schema */
  validate?: boolean;
  /** Custom CLI version */
  cliVersion?: string;
}

const DEFAULT_JSON_OPTIONS: Required<JsonOutputOptions> = {
  pretty: true,
  validate: true,
  cliVersion: CLI_VERSION,
};

/**
 * Determine SHIP/NO_SHIP decision
 */
export function getDecision(result: VerificationResult): 'SHIP' | 'NO_SHIP' {
  // SHIP requires: success=true, score>=95, no critical failures
  if (!result.success) return 'NO_SHIP';
  if (result.score < 95) return 'NO_SHIP';

  const hasCritical = result.clauses.some(
    (c) => c.status === 'failed' && c.impact === 'critical'
  );
  if (hasCritical) return 'NO_SHIP';

  return 'SHIP';
}

/**
 * Create JSON output structure
 */
export function createJsonOutput(
  result: VerificationResult,
  options: JsonOutputOptions = {}
): JsonOutput {
  const opts = { ...DEFAULT_JSON_OPTIONS, ...options };

  return {
    schemaVersion: SCHEMA_VERSION,
    decision: getDecision(result),
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
export interface JsonFormatResult {
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
export function formatJson(
  result: VerificationResult,
  options: JsonOutputOptions = {}
): JsonFormatResult {
  const opts = { ...DEFAULT_JSON_OPTIONS, ...options };
  const jsonOutput = createJsonOutput(result, opts);

  // Validate if requested
  if (opts.validate) {
    const validation = validateJsonOutput(jsonOutput);
    if (!validation.success) {
      return {
        output: '',
        valid: false,
        errors: validation.errors ? formatValidationErrors(validation.errors) : ['Unknown validation error'],
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
export function printJson(
  result: VerificationResult,
  options: JsonOutputOptions = {}
): boolean {
  const formatted = formatJson(result, options);

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
export interface JsonParseResult {
  /** Parsed JSON output */
  data?: JsonOutput;
  /** Whether parsing succeeded */
  success: boolean;
  /** Parse/validation errors */
  errors?: string[];
}

/**
 * Parse JSON output from string
 */
export function parseJson(input: string): JsonParseResult {
  try {
    const parsed = JSON.parse(input);
    const validation = validateJsonOutput(parsed);

    if (!validation.success) {
      return {
        success: false,
        errors: validation.errors ? formatValidationErrors(validation.errors) : ['Unknown validation error'],
      };
    }

    return {
      success: true,
      data: validation.data as JsonOutput,
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
 * Extract key metrics from JSON output
 */
export interface KeyMetrics {
  decision: 'SHIP' | 'NO_SHIP';
  score: number;
  confidence: number;
  passed: number;
  failed: number;
  total: number;
}

/**
 * Get key metrics from verification result
 */
export function getKeyMetrics(result: VerificationResult): KeyMetrics {
  const passed = result.clauses.filter((c) => c.status === 'passed').length;
  const failed = result.clauses.filter((c) => c.status === 'failed').length;
  const total = result.clauses.length;

  return {
    decision: getDecision(result),
    score: result.score,
    confidence: result.confidence,
    passed,
    failed,
    total,
  };
}

/**
 * Create a minimal JSON output for quick checks
 */
export function createMinimalJson(result: VerificationResult): string {
  const metrics = getKeyMetrics(result);
  return JSON.stringify({
    decision: metrics.decision,
    score: metrics.score,
    passed: metrics.passed,
    failed: metrics.failed,
  });
}
