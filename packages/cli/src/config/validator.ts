/**
 * ShipGate Configuration Validator
 *
 * Validates raw parsed YAML against the ShipGate config schema.
 * Returns structured errors with field paths and suggestions.
 */

import type { ShipGateConfig, FailOnLevel, SpeclessMode } from './schema.js';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface ValidationError {
  /** Dot-separated path to the invalid field (e.g. "ci.failOn") */
  path: string;
  /** Human-readable error message */
  message: string;
  /** The value that was provided */
  got?: unknown;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  /** Parsed config (only set when valid) */
  config?: ShipGateConfig;
}

// ─────────────────────────────────────────────────────────────────────────────
// Allowed values
// ─────────────────────────────────────────────────────────────────────────────

const VALID_FAIL_ON: readonly FailOnLevel[] = ['error', 'warning', 'unspecced'];
const VALID_SPECLESS_MODE: readonly SpeclessMode[] = ['on', 'off', 'warn-only'];

// ─────────────────────────────────────────────────────────────────────────────
// Validation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Validate raw parsed YAML/JSON against the ShipGate config schema.
 */
export function validateConfig(raw: unknown): ValidationResult {
  const errors: ValidationError[] = [];

  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return {
      valid: false,
      errors: [{ path: '', message: 'Config must be a YAML mapping (object)' }],
    };
  }

  const obj = raw as Record<string, unknown>;

  // ── version (required) ──────────────────────────────────────────────────
  if (obj.version === undefined) {
    errors.push({ path: 'version', message: 'version is required and must be 1' });
  } else if (obj.version !== 1) {
    errors.push({
      path: 'version',
      message: 'version must be 1',
      got: obj.version,
    });
  }

  // ── ci (optional object) ────────────────────────────────────────────────
  if (obj.ci !== undefined) {
    if (typeof obj.ci !== 'object' || obj.ci === null || Array.isArray(obj.ci)) {
      errors.push({ path: 'ci', message: 'ci must be a mapping (object)' });
    } else {
      const ci = obj.ci as Record<string, unknown>;

      // ci.failOn | ci.fail_on (support snake_case)
      const failOnRaw = ci.failOn ?? ci.fail_on;
      if (failOnRaw !== undefined) {
        if (typeof failOnRaw !== 'string' || !VALID_FAIL_ON.includes(failOnRaw as FailOnLevel)) {
          errors.push({
            path: 'ci.failOn',
            message: `ci.failOn must be one of: ${VALID_FAIL_ON.join(', ')}`,
            got: failOnRaw,
          });
        }
      }

      // ci.requireIsl | ci.require_isl
      const requireIslRaw = ci.requireIsl ?? ci.require_isl;
      if (requireIslRaw !== undefined) {
        if (!Array.isArray(requireIslRaw)) {
          errors.push({ path: 'ci.requireIsl', message: 'ci.requireIsl must be an array of glob patterns' });
        } else {
          for (let i = 0; i < requireIslRaw.length; i++) {
            if (typeof requireIslRaw[i] !== 'string') {
              errors.push({
                path: `ci.requireIsl[${i}]`,
                message: `ci.requireIsl[${i}] must be a string`,
                got: requireIslRaw[i],
              });
            }
          }
        }
      }

      // ci.ignore
      if (ci.ignore !== undefined) {
        if (!Array.isArray(ci.ignore)) {
          errors.push({ path: 'ci.ignore', message: 'ci.ignore must be an array of glob patterns' });
        } else {
          for (let i = 0; i < ci.ignore.length; i++) {
            if (typeof ci.ignore[i] !== 'string') {
              errors.push({
                path: `ci.ignore[${i}]`,
                message: `ci.ignore[${i}] must be a string`,
                got: ci.ignore[i],
              });
            }
          }
        }
      }

      // ci.speclessMode | ci.specless_mode
      const speclessRaw = ci.speclessMode ?? ci.specless_mode;
      if (speclessRaw !== undefined) {
        if (typeof speclessRaw !== 'string' || !VALID_SPECLESS_MODE.includes(speclessRaw as SpeclessMode)) {
          errors.push({
            path: 'ci.speclessMode',
            message: `ci.speclessMode must be one of: ${VALID_SPECLESS_MODE.join(', ')}`,
            got: speclessRaw,
          });
        }
      }
    }
  }

  // ── scanning (optional object) ──────────────────────────────────────────
  if (obj.scanning !== undefined) {
    if (typeof obj.scanning !== 'object' || obj.scanning === null || Array.isArray(obj.scanning)) {
      errors.push({ path: 'scanning', message: 'scanning must be a mapping (object)' });
    } else {
      const scanning = obj.scanning as Record<string, unknown>;
      const boolFields = ['hallucinations', 'fakeFeatures', 'fake_features', 'secrets', 'vulnerabilities'] as const;

      for (const field of boolFields) {
        if (scanning[field] !== undefined && typeof scanning[field] !== 'boolean') {
          const canonical = field.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
          errors.push({
            path: `scanning.${canonical}`,
            message: `scanning.${canonical} must be a boolean`,
            got: scanning[field],
          });
        }
      }
    }
  }

  // ── generate (optional object) ──────────────────────────────────────────
  if (obj.generate !== undefined) {
    if (typeof obj.generate !== 'object' || obj.generate === null || Array.isArray(obj.generate)) {
      errors.push({ path: 'generate', message: 'generate must be a mapping (object)' });
    } else {
      const gen = obj.generate as Record<string, unknown>;

      if (gen.output !== undefined && typeof gen.output !== 'string') {
        errors.push({
          path: 'generate.output',
          message: 'generate.output must be a string',
          got: gen.output,
        });
      }

      const minConf = gen.minConfidence ?? gen.min_confidence;
      if (minConf !== undefined) {
        if (typeof minConf !== 'number' || minConf < 0 || minConf > 1) {
          errors.push({
            path: 'generate.minConfidence',
            message: 'generate.minConfidence must be a number between 0 and 1',
            got: minConf,
          });
        }
      }
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  // Build typed config from the raw object, normalizing snake_case keys
  const config = normalizeConfig(obj);
  return { valid: true, errors: [], config };
}

// ─────────────────────────────────────────────────────────────────────────────
// Normalization (snake_case → camelCase)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Normalize raw config, supporting both camelCase and snake_case keys.
 * Only includes fields that are explicitly defined (not undefined) so that
 * spreading over defaults works correctly.
 */
function normalizeConfig(obj: Record<string, unknown>): ShipGateConfig {
  const ci = obj.ci as Record<string, unknown> | undefined;
  const scanning = obj.scanning as Record<string, unknown> | undefined;
  const generate = obj.generate as Record<string, unknown> | undefined;

  const config: ShipGateConfig = {
    version: 1,
  };

  if (ci) {
    config.ci = stripUndefined({
      failOn: (ci.failOn ?? ci.fail_on) as FailOnLevel | undefined,
      requireIsl: (ci.requireIsl ?? ci.require_isl) as string[] | undefined,
      ignore: ci.ignore as string[] | undefined,
      speclessMode: (ci.speclessMode ?? ci.specless_mode) as SpeclessMode | undefined,
    });
  }

  if (scanning) {
    config.scanning = stripUndefined({
      hallucinations: scanning.hallucinations as boolean | undefined,
      fakeFeatures: (scanning.fakeFeatures ?? scanning.fake_features) as boolean | undefined,
      secrets: scanning.secrets as boolean | undefined,
      vulnerabilities: scanning.vulnerabilities as boolean | undefined,
    });
  }

  if (generate) {
    config.generate = stripUndefined({
      output: generate.output as string | undefined,
      minConfidence: (generate.minConfidence ?? generate.min_confidence) as number | undefined,
    });
  }

  return config;
}

/**
 * Remove keys with `undefined` values from an object, so spreading
 * over defaults doesn't clobber them.
 */
function stripUndefined<T extends Record<string, unknown>>(obj: T): T {
  const result = {} as T;
  for (const key of Object.keys(obj) as Array<keyof T>) {
    if (obj[key] !== undefined) {
      result[key] = obj[key];
    }
  }
  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// Error formatting
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Format validation errors into a human-readable string.
 *
 * Example output:
 *   Error in .shipgate.yml:
 *     ci.failOn must be one of: error, warning, unspecced
 *     Got: "strict"
 */
export function formatValidationErrors(errors: ValidationError[], filePath?: string): string {
  const header = filePath
    ? `Error in ${filePath}:`
    : 'Error in .shipgate.yml:';

  const lines = [header];
  for (const err of errors) {
    lines.push(`  ${err.message}`);
    if (err.got !== undefined) {
      lines.push(`  Got: ${JSON.stringify(err.got)}`);
    }
  }
  return lines.join('\n');
}
