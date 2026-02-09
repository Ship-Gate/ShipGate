/**
 * Team Config Types
 *
 * Type definitions for team-level configuration that lets organizations
 * enforce ISL policies across multiple repositories.
 *
 * File: .shipgate-team.yml — committed to org-level repo or downloaded from dashboard
 */

// ─────────────────────────────────────────────────────────────────────────────
// Severity
// ─────────────────────────────────────────────────────────────────────────────

/** Severity level for policy violations and banned patterns */
export type PolicySeverity = 'error' | 'warning' | 'info';

// ─────────────────────────────────────────────────────────────────────────────
// Policy sub-types
// ─────────────────────────────────────────────────────────────────────────────

/** A banned source-code pattern */
export interface BannedPattern {
  /** The regex or literal pattern to search for */
  pattern: string;
  /** Human-readable reason this pattern is banned */
  reason: string;
  /** Severity when this pattern is detected */
  severity: PolicySeverity;
}

/** Security policy requirements */
export interface SecurityPolicy {
  /** All API behaviors must include rate limits */
  requireRateLimiting: boolean;
  /** Auth errors must not leak information */
  requireErrorConsistency: boolean;
  /** Password storage must use bcrypt/argon2 */
  requirePasswordHashing: boolean;
}

/** An org-specific ISL spec template reference */
export interface SpecTemplate {
  /** Template identifier (e.g. "api-endpoint") */
  name: string;
  /** URL to download the template from */
  url: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Team Policies
// ─────────────────────────────────────────────────────────────────────────────

/** Complete team policies configuration */
export interface TeamPolicies {
  /** Minimum percentage of critical files that must have specs (0–100) */
  minCoverage: number;
  /** Minimum spec quality score (0–100) */
  minSpecQuality: number;
  /** Check names that must be run on every repo */
  requiredChecks: string[];
  /** Glob patterns for paths that must always have specs */
  criticalPaths: string[];
  /** Source-code patterns that are banned across the org */
  bannedPatterns: BannedPattern[];
  /** Security policy requirements */
  security: SecurityPolicy;
  /** Org-specific ISL spec templates */
  specTemplates: SpecTemplate[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Team Config (root type for .shipgate-team.yml)
// ─────────────────────────────────────────────────────────────────────────────

/** Root team config type — loaded from .shipgate-team.yml */
export interface TeamConfig {
  /** Config schema version (must be 1) */
  version: 1;
  /** Team/org identifier (e.g. "acme-engineering") */
  team: string;
  /** Team-wide policies */
  policies: TeamPolicies;
}

// ─────────────────────────────────────────────────────────────────────────────
// Resolved Config (merged team + repo)
// ─────────────────────────────────────────────────────────────────────────────

/** Result of merging team and repo configs together */
export interface ResolvedConfig {
  /** Team name (null when no team config is found) */
  team: string | null;
  /** Merged policies */
  policies: TeamPolicies;
  /** Where the config was loaded from */
  source: {
    teamConfigPath: string | null;
    repoConfigPath: string | null;
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Policy Enforcement
// ─────────────────────────────────────────────────────────────────────────────

/** A single policy violation found during enforcement */
export interface PolicyViolation {
  /** Policy identifier (e.g. 'min_coverage', 'critical_path_coverage') */
  policy: string;
  /** Human-readable description of the violation */
  message: string;
  /** Severity of this violation */
  severity: PolicySeverity;
  /** Affected files (if applicable) */
  files?: string[];
}

/** Result of running policy enforcement */
export interface PolicyResult {
  /** All violations found */
  violations: PolicyViolation[];
  /** Whether the check passed (no error-severity violations) */
  passed: boolean;
  /** Violation summary counts */
  summary: {
    errors: number;
    warnings: number;
    infos: number;
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Input type for enforcement (abstract — caller provides the data)
// ─────────────────────────────────────────────────────────────────────────────

/** Spec coverage info for a repo */
export interface CoverageInfo {
  /** Overall spec coverage percentage (0–100) */
  percentage: number;
  /** Files that have ISL specs */
  coveredFiles: string[];
  /** Files that do NOT have ISL specs */
  uncoveredFiles: string[];
}

/** Input that the policy enforcement engine consumes */
export interface PolicyVerifyInput {
  /** Spec coverage data */
  coverage: CoverageInfo;
  /** Average spec quality score (0–100), if available */
  specQuality?: number;
  /** Names of checks that were actually run */
  checksRun: string[];
  /** All source file paths in the repo */
  sourceFiles: string[];
  /** Map of filePath → fileContent for banned-pattern scanning */
  sourceContents?: ReadonlyMap<string, string>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Validation
// ─────────────────────────────────────────────────────────────────────────────

/** A single validation error from config parsing */
export interface TeamConfigValidationError {
  /** Dot-separated path to the invalid field (e.g. "policies.min_coverage") */
  path: string;
  /** Human-readable error message */
  message: string;
  /** The value that was provided (for error reporting) */
  got?: unknown;
}

/** Result of validating raw YAML against the team config schema */
export interface TeamConfigValidationResult {
  /** Whether the config is valid */
  valid: boolean;
  /** Validation errors (empty when valid) */
  errors: TeamConfigValidationError[];
  /** Parsed config (only set when valid) */
  config?: TeamConfig;
}

/** Result of loading a team config file */
export interface LoadTeamConfigResult {
  /** Fully-resolved team config with defaults applied */
  config: TeamConfig;
  /** Path to the config file (null if using defaults) */
  configPath: string | null;
  /** Whether the config was loaded from a file or fell back to defaults */
  source: 'file' | 'defaults';
  /** Validation errors (only populated if config was invalid) */
  errors?: TeamConfigValidationError[];
}
