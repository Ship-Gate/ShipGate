/**
 * Team Config Module
 *
 * Provides team-level configuration for enforcing ISL policies
 * across multiple repositories — min coverage, required checks,
 * banned patterns, and shared rulesets.
 *
 * Usage:
 *   import {
 *     resolveConfig,
 *     enforceTeamPolicies,
 *     loadTeamConfig,
 *   } from '@isl-lang/core/team-config';
 *
 *   const config = await resolveConfig(repoRoot);
 *   const result = enforceTeamPolicies(verifyInput, config);
 */

// ── Types ────────────────────────────────────────────────────────────────────
export type {
  PolicySeverity,
  BannedPattern,
  SecurityPolicy,
  SpecTemplate,
  TeamPolicies,
  TeamConfig,
  ResolvedConfig,
  PolicyViolation,
  PolicyResult,
  CoverageInfo,
  PolicyVerifyInput,
  TeamConfigValidationError,
  TeamConfigValidationResult,
  LoadTeamConfigResult,
} from './teamConfigTypes.js';

// ── Schema / Defaults ────────────────────────────────────────────────────────
export {
  TEAM_CONFIG_FILE_NAMES,
  KNOWN_CHECKS,
  DEFAULT_SECURITY_POLICY,
  DEFAULT_TEAM_POLICIES,
  DEFAULT_TEAM_CONFIG,
  applyPolicyDefaults,
  applyTeamConfigDefaults,
  mergeTeamPolicies,
  generateTeamConfigTemplate,
} from './teamConfigSchema.js';

// ── Validation ───────────────────────────────────────────────────────────────
export {
  validateTeamConfig,
  formatTeamConfigErrors,
} from './teamConfigValidator.js';

// ── Loader ───────────────────────────────────────────────────────────────────
export {
  loadTeamConfig,
  loadTeamConfigFromFile,
  parseTeamConfigString,
  TeamConfigError,
} from './teamConfigLoader.js';

// ── Config Resolution ────────────────────────────────────────────────────────
export {
  resolveConfig,
  resolveConfigSync,
} from './teamConfigResolver.js';
export type { ResolveConfigOptions } from './teamConfigResolver.js';

// ── Policy Enforcement ───────────────────────────────────────────────────────
export {
  enforceTeamPolicies,
  formatPolicyResult,
} from './policyEnforcement.js';
