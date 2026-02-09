/**
 * Team Config Resolver
 *
 * Merges team-level and repo-level policies into a single ResolvedConfig.
 *
 * Priority: repo overrides > team config > defaults
 *
 * The resolver supports loading team config from:
 *   1. File in repo root (.shipgate-team.yml)
 *   2. File in parent directory (monorepo)
 *   3. Explicit file path
 */

import type {
  TeamPolicies,
  ResolvedConfig,
} from './teamConfigTypes.js';
import { loadTeamConfig, loadTeamConfigFromFile } from './teamConfigLoader.js';
import { DEFAULT_TEAM_POLICIES, mergeTeamPolicies } from './teamConfigSchema.js';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

/** Options for resolving config */
export interface ResolveConfigOptions {
  /** Explicit path to team config file (skips search) */
  teamConfigPath?: string;

  /** Explicit repo-level policy overrides (from .shipgate.yml policies section) */
  repoPolicyOverrides?: Partial<TeamPolicies>;

  /** Path to repo config file (for provenance tracking) */
  repoConfigPath?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Resolver
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Resolve the effective team policies for a given repository.
 *
 * Merge order (last wins):
 *   1. Built-in defaults (permissive baseline)
 *   2. Team config (.shipgate-team.yml)
 *   3. Repo-level overrides (from .shipgate.yml or CLI flags)
 *
 * @param repoRoot - Repository root directory
 * @param options  - Optional overrides and explicit paths
 */
export async function resolveConfig(
  repoRoot: string,
  options: ResolveConfigOptions = {},
): Promise<ResolvedConfig> {
  // ── 1. Load team config ────────────────────────────────────────────────
  const teamResult = options.teamConfigPath
    ? await loadTeamConfigFromFile(options.teamConfigPath)
    : await loadTeamConfig(repoRoot);

  const teamPolicies = teamResult.source === 'file'
    ? teamResult.config.policies
    : DEFAULT_TEAM_POLICIES;

  const teamName = teamResult.source === 'file'
    ? teamResult.config.team
    : null;

  // ── 2. Apply defaults to team policies ─────────────────────────────────
  const baselinePolicies = mergeTeamPolicies(DEFAULT_TEAM_POLICIES, teamPolicies);

  // ── 3. Apply repo-level overrides ──────────────────────────────────────
  const finalPolicies = options.repoPolicyOverrides
    ? mergeTeamPolicies(baselinePolicies, options.repoPolicyOverrides)
    : baselinePolicies;

  return {
    team: teamName,
    policies: finalPolicies,
    source: {
      teamConfigPath: teamResult.configPath,
      repoConfigPath: options.repoConfigPath ?? null,
    },
  };
}

/**
 * Resolve config synchronously from pre-loaded data (no file I/O).
 * Useful in tests or when configs have already been loaded.
 */
export function resolveConfigSync(
  teamPolicies: Partial<TeamPolicies> | null,
  repoPolicyOverrides?: Partial<TeamPolicies>,
  teamName?: string,
): ResolvedConfig {
  const baseline = teamPolicies
    ? mergeTeamPolicies(DEFAULT_TEAM_POLICIES, teamPolicies)
    : { ...DEFAULT_TEAM_POLICIES };

  const finalPolicies = repoPolicyOverrides
    ? mergeTeamPolicies(baseline, repoPolicyOverrides)
    : baseline;

  return {
    team: teamName ?? null,
    policies: finalPolicies,
    source: {
      teamConfigPath: null,
      repoConfigPath: null,
    },
  };
}
