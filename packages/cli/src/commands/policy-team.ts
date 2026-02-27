/**
 * Policy Team Commands
 *
 * CLI commands for team-level policy configuration:
 *   isl policy check   — validate repo against team policies
 *   isl policy init    — generate .shipgate-team.yml template
 *
 * Usage:
 *   isl policy check --team-config .shipgate-team.yml
 *   isl policy init --team "acme-engineering"
 */

import { writeFile, readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { resolve, join } from 'path';
import chalk from 'chalk';
import {
  resolveConfig,
  enforceTeamPolicies,
  formatPolicyResult,
  generateTeamConfigTemplate,
  TeamConfigError,
} from '@isl-lang/core';
import type {
  PolicyResult,
  PolicyVerifyInput,
  ResolvedConfig,
} from '@isl-lang/core';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface PolicyCheckOptions {
  /** Explicit path to team config file */
  teamConfig?: string;
  /** Repository root directory (default: cwd) */
  directory?: string;
  /** JSON output */
  json?: boolean;
  /** Verbose output */
  verbose?: boolean;
}

export interface PolicyCheckResult {
  /** Whether the policy check passed */
  passed: boolean;
  /** Policy enforcement result */
  policyResult: PolicyResult;
  /** Resolved config used */
  config: ResolvedConfig;
}

export interface PolicyInitOptions {
  /** Team name for the generated config */
  team?: string;
  /** Directory to write the config file (default: cwd) */
  directory?: string;
  /** Overwrite if file already exists */
  force?: boolean;
}

export interface PolicyInitResult {
  /** Whether the init succeeded */
  success: boolean;
  /** Path to the generated file */
  filePath: string | null;
  /** Error message if it failed */
  error?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Policy Check Command
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Validate the current repo against team policies.
 *
 * Loads the team config, builds a PolicyVerifyInput from repo state,
 * and runs policy enforcement.
 */
export async function policyCheck(options: PolicyCheckOptions = {}): Promise<PolicyCheckResult> {
  const repoRoot = resolve(options.directory ?? process.cwd());

  // Resolve merged config (team + repo)
  const config = await resolveConfig(repoRoot, {
    teamConfigPath: options.teamConfig ? resolve(options.teamConfig) : undefined,
  });

  // Build a PolicyVerifyInput from repo scanning
  // For now, we build a minimal input — the full integration with verify
  // results would connect to the existing verify pipeline.
  const input = await buildPolicyInput(repoRoot);

  // Run enforcement
  const policyResult = enforceTeamPolicies(input, config);

  return { passed: policyResult.passed, policyResult, config };
}

/**
 * Build a minimal PolicyVerifyInput by scanning the repo.
 * This provides enough data for policy checks without running
 * the full verify pipeline.
 */
async function buildPolicyInput(repoRoot: string): Promise<PolicyVerifyInput> {
  // For now, provide a minimal input.
  // A full implementation would scan for .isl spec files and
  // match them to source files to compute coverage.
  return {
    coverage: {
      percentage: 0,
      coveredFiles: [],
      uncoveredFiles: [],
    },
    checksRun: [],
    sourceFiles: [],
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Policy Init Command
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generate a .shipgate-team.yml template.
 */
export async function policyInit(options: PolicyInitOptions = {}): Promise<PolicyInitResult> {
  const dir = resolve(options.directory ?? process.cwd());
  const filePath = join(dir, '.shipgate-team.yml');

  // Check if already exists
  if (existsSync(filePath) && !options.force) {
    return {
      success: false,
      filePath,
      error: `.shipgate-team.yml already exists. Use --force to overwrite.`,
    };
  }

  const teamName = options.team ?? 'my-team';
  const template = generateTeamConfigTemplate(teamName);

  await writeFile(filePath, template, 'utf-8');

  return { success: true, filePath };
}

// ─────────────────────────────────────────────────────────────────────────────
// Output Formatting
// ─────────────────────────────────────────────────────────────────────────────

export function printPolicyCheckResult(result: PolicyCheckResult, options?: { verbose?: boolean }): void {
  const output = formatPolicyResult(result.policyResult, result.config.team);

  if (result.config.source.teamConfigPath && options?.verbose) {
    console.log(chalk.gray(`Team config: ${result.config.source.teamConfigPath}`));
    console.log('');
  }

  // Colourize the output
  for (const line of output.split('\n')) {
    if (line.includes('\u2716')) {
      console.log(chalk.red(line));
    } else if (line.includes('\u26A0')) {
      console.log(chalk.yellow(line));
    } else if (line.includes('\u2139')) {
      console.log(chalk.blue(line));
    } else if (line.includes('FAILED')) {
      console.log(chalk.bold.red(line));
    } else if (line.includes('PASSED') || line.includes('All policies passed')) {
      console.log(chalk.bold.green(line));
    } else {
      console.log(line);
    }
  }
}

export function printPolicyInitResult(result: PolicyInitResult): void {
  if (result.success) {
    console.log(chalk.bold.green('Created .shipgate-team.yml'));
    console.log(chalk.gray(`  Path: ${result.filePath}`));
    console.log('');
    console.log(chalk.gray('Edit the file to configure your team policies,'));
    console.log(chalk.gray('then run `isl policy check` to validate.'));
  } else {
    console.log(chalk.red(result.error ?? 'Failed to create team config'));
  }
}

export function getPolicyCheckExitCode(result: PolicyCheckResult): number {
  return result.passed ? 0 : 1;
}
