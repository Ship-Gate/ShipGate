/**
 * Team Config Schema
 *
 * Default values and constants for the team config schema.
 * Provides sensible out-of-the-box policies that organisations
 * can override via .shipgate-team.yml.
 */

import type {
  TeamPolicies,
  TeamConfig,
  SecurityPolicy,
} from './teamConfigTypes.js';

// ─────────────────────────────────────────────────────────────────────────────
// Config file names (in search priority order)
// ─────────────────────────────────────────────────────────────────────────────

/** File names recognised as team config, in priority order */
export const TEAM_CONFIG_FILE_NAMES = [
  '.shipgate-team.yml',
  '.shipgate-team.yaml',
  'shipgate-team.config.yml',
  'shipgate-team.config.yaml',
] as const;

// ─────────────────────────────────────────────────────────────────────────────
// Allowed check names (for validation)
// ─────────────────────────────────────────────────────────────────────────────

/** Well-known check identifiers that can appear in required_checks */
export const KNOWN_CHECKS = [
  'hallucination-detection',
  'secret-scanning',
  'fake-feature-detection',
  'vulnerability-scanning',
  'spec-quality',
  'coverage',
] as const;

// ─────────────────────────────────────────────────────────────────────────────
// Defaults
// ─────────────────────────────────────────────────────────────────────────────

/** Default security policy values */
export const DEFAULT_SECURITY_POLICY: SecurityPolicy = {
  requireRateLimiting: false,
  requireErrorConsistency: false,
  requirePasswordHashing: false,
};

/** Default team policies — permissive baseline */
export const DEFAULT_TEAM_POLICIES: TeamPolicies = {
  minCoverage: 0,
  minSpecQuality: 0,
  requiredChecks: [],
  criticalPaths: [],
  bannedPatterns: [],
  security: { ...DEFAULT_SECURITY_POLICY },
  specTemplates: [],
};

/** Default team config returned when no .shipgate-team.yml is found */
export const DEFAULT_TEAM_CONFIG: TeamConfig = {
  version: 1,
  team: '',
  policies: { ...DEFAULT_TEAM_POLICIES },
};

// ─────────────────────────────────────────────────────────────────────────────
// Merge helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Merge a partial policies object over defaults, producing a fully-resolved
 * TeamPolicies with every field populated.
 */
export function applyPolicyDefaults(partial: Partial<TeamPolicies>): TeamPolicies {
  return {
    minCoverage: partial.minCoverage ?? DEFAULT_TEAM_POLICIES.minCoverage,
    minSpecQuality: partial.minSpecQuality ?? DEFAULT_TEAM_POLICIES.minSpecQuality,
    requiredChecks: partial.requiredChecks ?? [...DEFAULT_TEAM_POLICIES.requiredChecks],
    criticalPaths: partial.criticalPaths ?? [...DEFAULT_TEAM_POLICIES.criticalPaths],
    bannedPatterns: partial.bannedPatterns ?? [...DEFAULT_TEAM_POLICIES.bannedPatterns],
    security: {
      ...DEFAULT_SECURITY_POLICY,
      ...partial.security,
    },
    specTemplates: partial.specTemplates ?? [...DEFAULT_TEAM_POLICIES.specTemplates],
  };
}

/**
 * Apply full defaults to a partial TeamConfig.
 */
export function applyTeamConfigDefaults(partial: Partial<TeamConfig>): TeamConfig {
  return {
    version: 1,
    team: partial.team ?? DEFAULT_TEAM_CONFIG.team,
    policies: applyPolicyDefaults(partial.policies ?? {}),
  };
}

/**
 * Deep-merge two TeamPolicies objects.
 * Values from `override` take precedence over `base`.
 * Arrays are replaced (not concatenated) when overridden.
 */
export function mergeTeamPolicies(
  base: TeamPolicies,
  override: Partial<TeamPolicies>,
): TeamPolicies {
  return {
    minCoverage: override.minCoverage ?? base.minCoverage,
    minSpecQuality: override.minSpecQuality ?? base.minSpecQuality,
    requiredChecks: override.requiredChecks ?? base.requiredChecks,
    criticalPaths: override.criticalPaths ?? base.criticalPaths,
    bannedPatterns: override.bannedPatterns ?? base.bannedPatterns,
    security: {
      ...base.security,
      ...override.security,
    },
    specTemplates: override.specTemplates ?? base.specTemplates,
  };
}

/**
 * Generate a starter .shipgate-team.yml template string
 * for bootstrapping a new team config.
 */
export function generateTeamConfigTemplate(teamName: string): string {
  return `# ShipGate Team Configuration
# Commit this to your org-level repo or place in each repository root.

version: 1
team: "${teamName}"

policies:
  min_coverage: 70                    # % of critical files must have specs
  min_spec_quality: 60                # minimum spec quality score

  required_checks:
    - hallucination-detection
    - secret-scanning
    - fake-feature-detection

  critical_paths:                     # ALL repos must spec these
    - "**/auth/**"
    - "**/payment*/**"
    - "**/api/admin/**"

  banned_patterns:
    - pattern: "eval("
      reason: "Use of eval is prohibited"
      severity: error
    - pattern: "TODO.*hack"
      reason: "Temporary hacks must not ship"
      severity: warning

  security:
    require_rate_limiting: true       # all API behaviors must have rate limits
    require_error_consistency: true   # auth errors must not leak info
    require_password_hashing: true    # password storage must use bcrypt/argon2

  spec_templates: []                  # org-specific behavior templates
    # - name: "api-endpoint"
    #   url: "https://specs.acme.com/templates/api-endpoint.isl"
`;
}
