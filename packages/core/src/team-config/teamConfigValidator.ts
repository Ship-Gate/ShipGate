/**
 * Team Config Validator
 *
 * Validates raw parsed YAML against the team config schema.
 * Returns structured errors with field paths and suggestions.
 * Supports both camelCase and snake_case keys in YAML.
 */

import type {
  TeamConfig,
  TeamPolicies,
  BannedPattern,
  SecurityPolicy,
  SpecTemplate,
  PolicySeverity,
  TeamConfigValidationError,
  TeamConfigValidationResult,
} from './teamConfigTypes.js';

// ─────────────────────────────────────────────────────────────────────────────
// Allowed values
// ─────────────────────────────────────────────────────────────────────────────

const VALID_SEVERITIES: readonly PolicySeverity[] = ['error', 'warning', 'info'];

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Remove keys with `undefined` values so spreading over defaults works correctly.
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

function isObject(val: unknown): val is Record<string, unknown> {
  return typeof val === 'object' && val !== null && !Array.isArray(val);
}

// ─────────────────────────────────────────────────────────────────────────────
// Validation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Validate raw parsed YAML/JSON against the team config schema.
 */
export function validateTeamConfig(raw: unknown): TeamConfigValidationResult {
  const errors: TeamConfigValidationError[] = [];

  if (!isObject(raw)) {
    return {
      valid: false,
      errors: [{ path: '', message: 'Team config must be a YAML mapping (object)' }],
    };
  }

  const obj = raw as Record<string, unknown>;

  // ── version (required) ──────────────────────────────────────────────────
  if (obj.version === undefined) {
    errors.push({ path: 'version', message: 'version is required and must be 1' });
  } else if (obj.version !== 1) {
    errors.push({ path: 'version', message: 'version must be 1', got: obj.version });
  }

  // ── team (required) ─────────────────────────────────────────────────────
  if (obj.team === undefined) {
    errors.push({ path: 'team', message: 'team is required (string identifier for this team)' });
  } else if (typeof obj.team !== 'string' || obj.team.trim().length === 0) {
    errors.push({ path: 'team', message: 'team must be a non-empty string', got: obj.team });
  }

  // ── policies (required) ─────────────────────────────────────────────────
  if (obj.policies === undefined) {
    errors.push({ path: 'policies', message: 'policies is required' });
  } else if (!isObject(obj.policies)) {
    errors.push({ path: 'policies', message: 'policies must be a mapping (object)' });
  } else {
    validatePolicies(obj.policies as Record<string, unknown>, errors);
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  const config = normalizeTeamConfig(obj);
  return { valid: true, errors: [], config };
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-validators
// ─────────────────────────────────────────────────────────────────────────────

function validatePolicies(
  policies: Record<string, unknown>,
  errors: TeamConfigValidationError[],
): void {
  // min_coverage / minCoverage
  const minCov = policies.min_coverage ?? policies.minCoverage;
  if (minCov !== undefined) {
    if (typeof minCov !== 'number' || minCov < 0 || minCov > 100) {
      errors.push({
        path: 'policies.min_coverage',
        message: 'policies.min_coverage must be a number between 0 and 100',
        got: minCov,
      });
    }
  }

  // min_spec_quality / minSpecQuality
  const minQuality = policies.min_spec_quality ?? policies.minSpecQuality;
  if (minQuality !== undefined) {
    if (typeof minQuality !== 'number' || minQuality < 0 || minQuality > 100) {
      errors.push({
        path: 'policies.min_spec_quality',
        message: 'policies.min_spec_quality must be a number between 0 and 100',
        got: minQuality,
      });
    }
  }

  // required_checks / requiredChecks
  const reqChecks = policies.required_checks ?? policies.requiredChecks;
  if (reqChecks !== undefined) {
    if (!Array.isArray(reqChecks)) {
      errors.push({
        path: 'policies.required_checks',
        message: 'policies.required_checks must be an array of strings',
      });
    } else {
      for (let i = 0; i < reqChecks.length; i++) {
        if (typeof reqChecks[i] !== 'string') {
          errors.push({
            path: `policies.required_checks[${i}]`,
            message: `policies.required_checks[${i}] must be a string`,
            got: reqChecks[i],
          });
        }
      }
    }
  }

  // critical_paths / criticalPaths
  const critPaths = policies.critical_paths ?? policies.criticalPaths;
  if (critPaths !== undefined) {
    if (!Array.isArray(critPaths)) {
      errors.push({
        path: 'policies.critical_paths',
        message: 'policies.critical_paths must be an array of glob patterns',
      });
    } else {
      for (let i = 0; i < critPaths.length; i++) {
        if (typeof critPaths[i] !== 'string') {
          errors.push({
            path: `policies.critical_paths[${i}]`,
            message: `policies.critical_paths[${i}] must be a string`,
            got: critPaths[i],
          });
        }
      }
    }
  }

  // banned_patterns / bannedPatterns
  const banned = policies.banned_patterns ?? policies.bannedPatterns;
  if (banned !== undefined) {
    if (!Array.isArray(banned)) {
      errors.push({
        path: 'policies.banned_patterns',
        message: 'policies.banned_patterns must be an array',
      });
    } else {
      for (let i = 0; i < banned.length; i++) {
        validateBannedPattern(banned[i], i, errors);
      }
    }
  }

  // security
  if (policies.security !== undefined) {
    if (!isObject(policies.security)) {
      errors.push({
        path: 'policies.security',
        message: 'policies.security must be a mapping (object)',
      });
    } else {
      validateSecurity(policies.security as Record<string, unknown>, errors);
    }
  }

  // spec_templates / specTemplates
  const templates = policies.spec_templates ?? policies.specTemplates;
  if (templates !== undefined) {
    if (!Array.isArray(templates)) {
      errors.push({
        path: 'policies.spec_templates',
        message: 'policies.spec_templates must be an array',
      });
    } else {
      for (let i = 0; i < templates.length; i++) {
        validateSpecTemplate(templates[i], i, errors);
      }
    }
  }
}

function validateBannedPattern(
  item: unknown,
  index: number,
  errors: TeamConfigValidationError[],
): void {
  const prefix = `policies.banned_patterns[${index}]`;

  if (!isObject(item)) {
    errors.push({ path: prefix, message: `${prefix} must be an object with pattern, reason, severity` });
    return;
  }

  const obj = item as Record<string, unknown>;

  if (typeof obj.pattern !== 'string' || obj.pattern.length === 0) {
    errors.push({ path: `${prefix}.pattern`, message: `${prefix}.pattern is required and must be a non-empty string`, got: obj.pattern });
  }

  if (typeof obj.reason !== 'string' || obj.reason.length === 0) {
    errors.push({ path: `${prefix}.reason`, message: `${prefix}.reason is required and must be a non-empty string`, got: obj.reason });
  }

  if (obj.severity !== undefined) {
    if (typeof obj.severity !== 'string' || !VALID_SEVERITIES.includes(obj.severity as PolicySeverity)) {
      errors.push({
        path: `${prefix}.severity`,
        message: `${prefix}.severity must be one of: ${VALID_SEVERITIES.join(', ')}`,
        got: obj.severity,
      });
    }
  }
}

function validateSecurity(
  security: Record<string, unknown>,
  errors: TeamConfigValidationError[],
): void {
  const boolFields = [
    ['require_rate_limiting', 'requireRateLimiting'],
    ['require_error_consistency', 'requireErrorConsistency'],
    ['require_password_hashing', 'requirePasswordHashing'],
  ] as const;

  for (const [snake, camel] of boolFields) {
    const val = security[snake] ?? security[camel];
    if (val !== undefined && typeof val !== 'boolean') {
      errors.push({
        path: `policies.security.${snake}`,
        message: `policies.security.${snake} must be a boolean`,
        got: val,
      });
    }
  }
}

function validateSpecTemplate(
  item: unknown,
  index: number,
  errors: TeamConfigValidationError[],
): void {
  const prefix = `policies.spec_templates[${index}]`;

  if (!isObject(item)) {
    errors.push({ path: prefix, message: `${prefix} must be an object with name and url` });
    return;
  }

  const obj = item as Record<string, unknown>;

  if (typeof obj.name !== 'string' || obj.name.length === 0) {
    errors.push({ path: `${prefix}.name`, message: `${prefix}.name is required and must be a non-empty string`, got: obj.name });
  }

  if (typeof obj.url !== 'string' || obj.url.length === 0) {
    errors.push({ path: `${prefix}.url`, message: `${prefix}.url is required and must be a non-empty string`, got: obj.url });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Normalization (snake_case → camelCase)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Normalize raw config, supporting both camelCase and snake_case keys.
 */
function normalizeTeamConfig(obj: Record<string, unknown>): TeamConfig {
  const policies = obj.policies as Record<string, unknown>;

  return {
    version: 1,
    team: (obj.team as string).trim(),
    policies: normalizePolicies(policies),
  };
}

function normalizePolicies(p: Record<string, unknown>): TeamPolicies {
  const banned = (p.banned_patterns ?? p.bannedPatterns) as Array<Record<string, unknown>> | undefined;
  const templates = (p.spec_templates ?? p.specTemplates) as Array<Record<string, unknown>> | undefined;
  const security = p.security as Record<string, unknown> | undefined;

  return stripUndefined({
    minCoverage: (p.min_coverage ?? p.minCoverage) as number | undefined,
    minSpecQuality: (p.min_spec_quality ?? p.minSpecQuality) as number | undefined,
    requiredChecks: (p.required_checks ?? p.requiredChecks) as string[] | undefined,
    criticalPaths: (p.critical_paths ?? p.criticalPaths) as string[] | undefined,
    bannedPatterns: banned?.map(normalizeBannedPattern),
    security: security ? normalizeSecurity(security) : undefined,
    specTemplates: templates?.map(normalizeSpecTemplate),
  }) as TeamPolicies;
}

function normalizeBannedPattern(obj: Record<string, unknown>): BannedPattern {
  return {
    pattern: obj.pattern as string,
    reason: obj.reason as string,
    severity: (obj.severity as PolicySeverity) ?? 'error',
  };
}

function normalizeSecurity(s: Record<string, unknown>): SecurityPolicy {
  return stripUndefined({
    requireRateLimiting: (s.require_rate_limiting ?? s.requireRateLimiting) as boolean | undefined,
    requireErrorConsistency: (s.require_error_consistency ?? s.requireErrorConsistency) as boolean | undefined,
    requirePasswordHashing: (s.require_password_hashing ?? s.requirePasswordHashing) as boolean | undefined,
  }) as SecurityPolicy;
}

function normalizeSpecTemplate(obj: Record<string, unknown>): SpecTemplate {
  return {
    name: obj.name as string,
    url: obj.url as string,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Error formatting
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Format validation errors into a human-readable string.
 *
 * Example output:
 *   Error in .shipgate-team.yml:
 *     policies.min_coverage must be a number between 0 and 100
 *     Got: "high"
 */
export function formatTeamConfigErrors(
  errors: TeamConfigValidationError[],
  filePath?: string,
): string {
  const header = filePath
    ? `Error in ${filePath}:`
    : 'Error in .shipgate-team.yml:';

  const lines = [header];
  for (const err of errors) {
    lines.push(`  ${err.message}`);
    if (err.got !== undefined) {
      lines.push(`  Got: ${JSON.stringify(err.got)}`);
    }
  }
  return lines.join('\n');
}
