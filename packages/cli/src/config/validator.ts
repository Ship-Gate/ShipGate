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
  // Accept: 1, "1", "1.0" (unified v1 / demo schema)
  const validVersions = [1, '1', '1.0'];
  if (obj.version === undefined) {
    errors.push({ path: 'version', message: 'version is required and must be 1 or "1.0"' });
  } else if (!validVersions.includes(obj.version as number | string)) {
    errors.push({
      path: 'version',
      message: 'version must be 1, "1", or "1.0"',
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

  // ── guardrails (optional object) ──────────────────────────────────────
  if (obj.guardrails !== undefined) {
    if (typeof obj.guardrails !== 'object' || obj.guardrails === null || Array.isArray(obj.guardrails)) {
      errors.push({ path: 'guardrails', message: 'guardrails must be a mapping (object)' });
    } else {
      const gr = obj.guardrails as Record<string, unknown>;
      const boolFields = [
        ['allowAutoSpecShip', 'allow_auto_spec_ship'],
        ['allowNoTestExecution', 'allow_no_test_execution'],
        ['allowEmptyCategories', 'allow_empty_categories'],
        ['allowUnvalidatedAiRules', 'allow_unvalidated_ai_rules'],
      ] as const;

      for (const [camel, snake] of boolFields) {
        const val = gr[camel] ?? gr[snake];
        if (val !== undefined && typeof val !== 'boolean') {
          errors.push({
            path: `guardrails.${camel}`,
            message: `guardrails.${camel} must be a boolean`,
            got: val,
          });
        }
      }
    }
  }

  // ── specs (optional object, demo schema) ───────────────────────────────
  if (obj.specs !== undefined) {
    if (typeof obj.specs !== 'object' || obj.specs === null || Array.isArray(obj.specs)) {
      errors.push({ path: 'specs', message: 'specs must be a mapping (object)' });
    } else {
      const specs = obj.specs as Record<string, unknown>;
      if (specs.include !== undefined) {
        if (!Array.isArray(specs.include)) {
          errors.push({ path: 'specs.include', message: 'specs.include must be an array of glob patterns' });
        } else {
          for (let i = 0; i < specs.include.length; i++) {
            if (typeof specs.include[i] !== 'string') {
              errors.push({
                path: `specs.include[${i}]`,
                message: `specs.include[${i}] must be a string`,
                got: specs.include[i],
              });
            }
          }
        }
      }
    }
  }

  // ── verify (optional object, demo schema) ───────────────────────────────
  if (obj.verify !== undefined) {
    if (typeof obj.verify !== 'object' || obj.verify === null || Array.isArray(obj.verify)) {
      errors.push({ path: 'verify', message: 'verify must be a mapping (object)' });
    } else {
      const verify = obj.verify as Record<string, unknown>;
      if (verify.strict !== undefined && typeof verify.strict !== 'boolean') {
        errors.push({
          path: 'verify.strict',
          message: 'verify.strict must be a boolean',
          got: verify.strict,
        });
      }
      if (verify.policies !== undefined) {
        if (typeof verify.policies !== 'object' || verify.policies === null || Array.isArray(verify.policies)) {
          errors.push({ path: 'verify.policies', message: 'verify.policies must be a mapping (object)' });
        } else {
          const policies = verify.policies as Record<string, unknown>;
          for (const [key, val] of Object.entries(policies)) {
            if (val !== undefined && val !== null && typeof val === 'object' && !Array.isArray(val)) {
              const policy = val as Record<string, unknown>;
              if (policy.enabled !== undefined && typeof policy.enabled !== 'boolean') {
                errors.push({
                  path: `verify.policies.${key}.enabled`,
                  message: `verify.policies.${key}.enabled must be a boolean`,
                  got: policy.enabled,
                });
              }
            }
          }
        }
      }
    }
  }

  // ── evidence (optional object, demo schema) ─────────────────────────────
  if (obj.evidence !== undefined) {
    if (typeof obj.evidence !== 'object' || obj.evidence === null || Array.isArray(obj.evidence)) {
      errors.push({ path: 'evidence', message: 'evidence must be a mapping (object)' });
    } else {
      const evidence = obj.evidence as Record<string, unknown>;
      const outputDir = evidence.output_dir ?? evidence.outputDir;
      if (outputDir !== undefined && typeof outputDir !== 'string') {
        errors.push({
          path: 'evidence.output_dir',
          message: 'evidence.output_dir must be a string',
          got: outputDir,
        });
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

  const guardrails = obj.guardrails as Record<string, unknown> | undefined;
  if (guardrails) {
    config.guardrails = stripUndefined({
      allowAutoSpecShip: (guardrails.allowAutoSpecShip ?? guardrails.allow_auto_spec_ship) as boolean | undefined,
      allowNoTestExecution: (guardrails.allowNoTestExecution ?? guardrails.allow_no_test_execution) as boolean | undefined,
      allowEmptyCategories: (guardrails.allowEmptyCategories ?? guardrails.allow_empty_categories) as boolean | undefined,
      allowUnvalidatedAiRules: (guardrails.allowUnvalidatedAiRules ?? guardrails.allow_unvalidated_ai_rules) as boolean | undefined,
    });
  }

  // ── specs (demo schema: specs.include → internal spec include globs) ─────
  const specs = obj.specs as Record<string, unknown> | undefined;
  if (specs?.include) {
    config.specs = stripUndefined({
      include: specs.include as string[],
    });
  }

  // ── verify (demo schema: verify.strict, verify.policies → internal) ──────
  const verify = obj.verify as Record<string, unknown> | undefined;
  if (verify) {
    const policies = verify.policies as Record<string, Record<string, unknown>> | undefined;
    const policyToggles: Record<string, { enabled?: boolean }> = {};
    if (policies && typeof policies === 'object' && !Array.isArray(policies)) {
      for (const [key, val] of Object.entries(policies)) {
        if (val && typeof val === 'object' && !Array.isArray(val)) {
          policyToggles[key] = { enabled: val.enabled as boolean | undefined };
        }
      }
    }
    config.verify = stripUndefined({
      strict: verify.strict as boolean | undefined,
      ...(Object.keys(policyToggles).length > 0 ? { policies: policyToggles } : {}),
    });
  }

  // ── evidence (demo schema: evidence.output_dir → internal) ──────────────
  const evidence = obj.evidence as Record<string, unknown> | undefined;
  if (evidence) {
    const outputDir = evidence.output_dir ?? evidence.outputDir;
    if (outputDir !== undefined) {
      config.evidence = stripUndefined({
        output_dir: outputDir as string,
      });
    }
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
